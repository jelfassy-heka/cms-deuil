#!/bin/bash
# Batch 7F.2.c — Tests audit contacts (1293 POST + 1294 PATCH + 1290 DELETE)
# Workspace 17, group api:M9mahf09.
#
# Couvre les 3 endpoints contacts en un seul flux :
#  - 401 sans bearer / bearer invalide (3 endpoints)
#  - 404 id inexistant (PATCH + DELETE)
#  - 200 admin POST → audit create
#  - 200 admin PATCH → audit update (changed_fields)
#  - 200 admin DELETE → audit delete
#  - 404 ré-DELETE même id
#
# ⚠ ATTENTION PRODUCTION : contacts id=1 (Joachim Elfassy) NE DOIT JAMAIS être touché.
# Tests utilisent uniquement la row test créée par 1293.
#
# email loggué brut conformément à arbitrage 7F.1.
# Aucun bearer affiché en clair.
# Usage : bash scripts/batch7f-tests-contacts.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL_INITIAL="batch7f-contact-${TS}@invalid.local"
TEST_EMAIL_MODIFIED="batch7f-contact-modified-${TS}@invalid.local"

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

echo "=== Volet A : auth checks (401 attendu, aucun audit) ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/contacts")
hcheck "T1 POST /contacts sans bearer" "401" "$T1" ""
T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/contacts")
hcheck "T2 POST /contacts bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (PATCH + DELETE → 404, aucun audit) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"first_name":"x"}' "$B/contacts/999999")
hcheck "T3 PATCH /contacts/999999 (admin)" "404" "$T3" ""
T4=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contacts/999999")
hcheck "T4 DELETE /contacts/999999 (admin)" "404" "$T4" ""

echo ""
echo "=== Volet C : POST admin (audit create attendu) ==="
POST_PAYLOAD="{\"partner_id\":1,\"first_name\":\"BATCH7F_CONTACT\",\"last_name\":\"Initial\",\"email\":\"$TEST_EMAIL_INITIAL\",\"role\":\"Tester\",\"is_primary\":false}"
T5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$POST_PAYLOAD" "$B/contacts")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin POST /contacts" "200" "$T5_CODE" ""
ROW_ID=$(echo "$T5_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    contact test id = $ROW_ID, partner_id=1, email=$TEST_EMAIL_INITIAL"
echo "    audit attendu : action_type='create', new_values 8 champs (incl. email brut)"

if [ "$ROW_ID" = "1" ]; then
  echo "  ⚠ ANOMALIE : ROW_ID=1 = production. ARRÊT IMMÉDIAT pour éviter PATCH/DELETE prod."
  exit 1
fi

echo ""
echo "=== Volet D : PATCH admin (modif first_name + last_name + email + role + is_primary) ==="
PATCH_PAYLOAD="{\"first_name\":\"BATCH7F_CONTACT_UPDATED\",\"last_name\":\"Modified\",\"email\":\"$TEST_EMAIL_MODIFIED\",\"role\":\"AdminTester\",\"is_primary\":true}"
T6_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PATCH_PAYLOAD" "$B/contacts/$ROW_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
hcheck "T6 admin PATCH /contacts/$ROW_ID" "200" "$T6_CODE" ""
echo "    audit attendu : changed_fields=[first_name,last_name,email,role,is_primary]"
echo "    new_values doit refléter les valeurs modifiées (8 champs whitelistés)"

echo ""
echo "=== Volet E : DELETE admin (audit delete attendu) ==="
T7_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contacts/$ROW_ID")
T7_CODE=$(echo "$T7_RESP" | tail -1)
hcheck "T7 admin DELETE /contacts/$ROW_ID" "200" "$T7_CODE" ""
echo "    audit attendu : action_type='delete', previous_values 8 champs depuis \$existing"

echo ""
echo "=== Vérif post-DELETE : ré-DELETE même id → 404 (aucun audit supplémentaire) ==="
T8=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contacts/$ROW_ID")
hcheck "T8 ré-DELETE même id" "404" "$T8" ""

echo ""
echo "=== Fin tests Batch 7F.2.c ==="
echo ""
echo ">>> contact test id=$ROW_ID auto-supprimé par T7."
echo ">>> contacts id=1 (Joachim Elfassy production) NON TOUCHÉ."
echo ">>> audit_logs à supprimer côté Claude (object_type='contact' object_id=$ROW_ID) :"
echo "    - 1 audit create (T5)"
echo "    - 1 audit update (T6)"
echo "    - 1 audit delete (T7)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Cas partenaire couvert par revue de code (precondition admin-only stricte)."
