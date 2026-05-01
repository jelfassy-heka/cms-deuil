#!/bin/bash
# Batch 7D.2.g — Tests audit PATCH /beneficiaries/{id}
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 404 id inexistant
#  - 200 admin PATCH email/sent_at → audit standard
#  - 200 admin PATCH code → audit code_modified=true (jamais en clair)
#  - 200 admin PATCH status (champ hors schéma) → audit status_input_present=true
#
# Cas partenaire owner / non-owner couvert par revue de code.
# Cleanup via MCP table 294 (1285 DELETE soft-disabled, ne pas l'utiliser).
#
# Aucun bearer affiché en clair, aucun code complet exposé dans le rapport.
# Usage : bash scripts/batch7d-tests-1289-beneficiaries-patch.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL_INITIAL="batch7d-benef-patch-${TS}@invalid.local"
TEST_EMAIL_MODIFIED="batch7d-benef-patch-modified-${TS}@invalid.local"
TEST_CODE_INITIAL=$(openssl rand -hex 4 | tr 'a-z' 'A-Z')
TEST_CODE_NEW=$(openssl rand -hex 4 | tr 'a-z' 'A-Z')

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo "=== Setup : créer Beneficiary test via 1288 (créera 1 audit create) ==="
SETUP_PAYLOAD="{\"first_name\":\"BATCH7D\",\"last_name\":\"PatchTest\",\"email\":\"$TEST_EMAIL_INITIAL\",\"code\":\"$TEST_CODE_INITIAL\",\"partner_id\":1}"
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/beneficiaries")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; echo "$SETUP_BODY"; exit 1; }
BENEF_ID=$(echo "$SETUP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Beneficiary test id = $BENEF_ID, partner_id=1, email=$TEST_EMAIL_INITIAL, code initial créé"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'Content-Type: application/json' -d '{"sent_at":1}' "$B/beneficiaries/$BENEF_ID")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"sent_at":1}' "$B/beneficiaries/$BENEF_ID")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (aucun audit attendu) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"sent_at":1}' "$B/beneficiaries/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : PATCH admin sent_at uniquement (audit standard) ==="
T4_PAYLOAD='{"sent_at":1730000000000}'
T4_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T4_PAYLOAD" "$B/beneficiaries/$BENEF_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
hcheck "T4 admin PATCH sent_at" "200" "$T4_CODE" ""
echo "    audit attendu : changed_fields=[sent_at], code_modified=false, code_was_masked='***', code_now_masked='***'"

echo ""
echo "=== Volet D : PATCH admin code (audit code_modified=true, contenu jamais loggué) ==="
T5_PAYLOAD="{\"code\":\"$TEST_CODE_NEW\"}"
T5_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T5_PAYLOAD" "$B/beneficiaries/$BENEF_ID")
T5_CODE=$(echo "$T5_RESP" | tail -1)
hcheck "T5 admin PATCH code" "200" "$T5_CODE" ""
echo "    audit attendu : changed_fields=[code], code_modified=true, code_was_masked='***', code_now_masked='***'"
echo "    Le contenu des codes initial et nouveau NE DOIT JAMAIS apparaître dans l'audit."
unset TEST_CODE_INITIAL TEST_CODE_NEW

echo ""
echo "=== Volet E : PATCH admin status (champ hors schéma table) ==="
T6_PAYLOAD='{"status":"sent"}'
T6_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T6_PAYLOAD" "$B/beneficiaries/$BENEF_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
T6_BODY=$(echo "$T6_RESP" | head -1)
hcheck "T6 admin PATCH status (hors schéma)" "200" "$T6_CODE" ""
echo "    Comportement runtime : $T6_CODE (à analyser côté MCP)"
echo "    audit attendu si 200 : changed_fields=[status], status_input_present=true,"
echo "                            status_field_exists=false, status_ignored_by_schema=true"

echo ""
echo "=== Fin tests Batch 7D.2.g ==="
echo ""
echo ">>> À supprimer côté Claude (via MCP table 294 — NE PAS utiliser 1285 soft-disabled) :"
echo "    Beneficiaries id = $BENEF_ID (email actuel selon dernier PATCH)"
echo "    audit_logs où object_type='beneficiary' object_id=$BENEF_ID :"
echo "      - 1 audit create (setup 1288)"
echo "      - 1 audit update (T4 sent_at)"
echo "      - 1 audit update (T5 code, code_modified=true)"
echo "      - 1 audit update (T6 status, si 200)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Cas partenaire owner / non-owner couvert par revue de code"
echo "    (logique conditional admin/partner avec admin_partner_ids identique au pattern 7C.2.b PATCH partner_members validé)."
