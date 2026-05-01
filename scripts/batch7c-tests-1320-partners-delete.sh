#!/bin/bash
# Batch 7C.2.g — Tests audit DELETE /partners/{id}
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 404 id inexistant
#  - 403 garde id=1 (reference partner)
#  - 403 FK-check refusé (partner_member temporaire)
#  - 200 DELETE après FK cleanup → audit créé
#
# Aucun bearer affiché en clair.
# Usage : bash scripts/batch7c-tests-1320-partners-delete.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_NAME="BATCH7C_TEST_PARTNER_DELETE_${TS}"
TEST_EMAIL="batch7c-delete-${TS}@invalid.local"
TEST_PM_EMAIL="batch7c-delete-pm-${TS}@invalid.local"

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

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo ""
echo "=== Setup 1 : créer partner test via 1319 ==="
SETUP_PAYLOAD=$(cat <<EOF
{
  "name": "$TEST_NAME",
  "logo_url": "https://test.local/logo-delete.png",
  "partner_type": "entreprise",
  "email_contact": "$TEST_EMAIL",
  "phone": "00 00 00 00 00",
  "crm_status": "test",
  "notes_internes": "BATCH 7C DELETE TEST — should NOT appear in audit",
  "contact_firstname": "Delete",
  "contact_lastname": "Test",
  "contact_role": "test",
  "xano_partner_id": 0
}
EOF
)
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/partners")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup partner KO [HTTP $SETUP_CODE]"; exit 1; }
PARTNER_ID=$(echo "$SETUP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Partner test id = $PARTNER_ID (créera 1 audit create partner)"
echo ""

echo "=== Setup 2 : créer partner_member temporaire FK lié au partner test (via 1313) ==="
PM_BODY="{\"partner_id\":$PARTNER_ID,\"user_email\":\"$TEST_PM_EMAIL\",\"role\":\"member\",\"status\":\"active\",\"invited_by\":\"admin\"}"
PM_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PM_BODY" "$B/partner_members")
PM_CODE=$(echo "$PM_RESP" | tail -1)
PM_BODY_RESP=$(echo "$PM_RESP" | head -1)
[ "$PM_CODE" != "200" ] && { echo "Setup partner_member KO [HTTP $PM_CODE]"; echo "$PM_BODY_RESP"; exit 1; }
PM_ID=$(echo "$PM_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Partner_member FK temp id = $PM_ID (créera 1 audit create partner_member)"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/partners/$PARTNER_ID")
hcheck "T1 sans bearer (aucun audit attendu)" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer FAKE_INVALID" "$B/partners/$PARTNER_ID")
hcheck "T2 bearer invalide (aucun audit attendu)" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (aucun audit attendu) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : garde id=1 (aucun audit attendu) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/1")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin DELETE /partners/1 (garde id=1)" "403" "$T4_CODE" ""
echo "    body T4: $T4_BODY"

echo ""
echo "=== Volet D : FK-check refusé (aucun audit delete partner attendu) ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$PARTNER_ID")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin DELETE partner test avec FK actif" "403" "$T5_CODE" ""
echo "    body T5: $T5_BODY"

echo ""
echo "=== Volet E : cleanup FK temporaire (1310 supprime le partner_member) ==="
PM_DEL_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partner_members/$PM_ID")
PM_DEL_CODE=$(echo "$PM_DEL_RESP" | tail -1)
hcheck "Cleanup partner_member FK via 1310 (créera 1 audit delete pm)" "200" "$PM_DEL_CODE" ""

echo ""
echo "=== Volet F : DELETE réussi (audit delete partner attendu) ==="
T6_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$PARTNER_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
T6_BODY=$(echo "$T6_RESP" | head -1)
hcheck "T6 admin DELETE partner test (FK clean)" "200" "$T6_CODE" ""

echo ""
echo "=== Vérif post-DELETE : ré-DELETE même id → 404 (preuve disparition) ==="
T7=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$PARTNER_ID")
hcheck "T7 ré-DELETE même id" "404" "$T7" ""

echo ""
echo "=== Fin tests Batch 7C.2.g ==="
echo ""
echo ">>> partner test id=$PARTNER_ID supprimé par T6"
echo ">>> partner_member FK temp id=$PM_ID supprimé par cleanup"
echo ">>> audit_logs à supprimer côté Claude (object_type='partner' et 'partner_member' et 'auth_session') :"
echo "    - 1 audit login admin (script)"
echo "    - 1 audit create partner (setup 1319, object_id=$PARTNER_ID)"
echo "    - 1 audit create partner_member (setup 1313, object_id=$PM_ID)"
echo "    - 1 audit delete partner_member (cleanup 1310, object_id=$PM_ID)"
echo "    - 1 audit delete partner (T6, object_id=$PARTNER_ID) ← cible"
echo ">>> Vérifier audit cible : action_type='delete', metadata.fk_check_passed=true, total_fk=0,"
echo "    previous_values whitelist 11 champs SANS notes_internes ni logo_url, new_values null."
echo ">>> Aucun bearer affiché."
