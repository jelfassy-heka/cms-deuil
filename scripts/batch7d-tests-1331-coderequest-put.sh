#!/bin/bash
# Batch 7D.2.d — Tests audit PUT /code_request/{id}
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 404 id inexistant
#  - 200 admin PUT non-status → audit action_type='update', full_replace=true
#  - 200 admin PUT request_status → audit action_type='process_request', full_replace=true
#  - 200 admin PUT message modifié → audit message_modified=true (contenu jamais loggué)
#
# Ne touche pas code_request id=1 et id=2 (rows production préexistantes).
# Aucun bearer affiché en clair.
# Usage : bash scripts/batch7d-tests-1331-coderequest-put.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_REASON="BATCH7D_PUT_TEST_${TS}"
TEST_MESSAGE_INITIAL="BATCH7D INITIAL message — should NOT appear in audit"
TEST_MESSAGE_MODIFIED="BATCH7D MODIFIED message — should NOT appear in audit"

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

echo "=== Setup : créer code_request test via 1330 (créera 1 audit create) ==="
SETUP_PAYLOAD=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':5,
  'reason':'$TEST_REASON',
  'request_status':'pending',
  'request_type':'standard',
  'message':'$TEST_MESSAGE_INITIAL'
}))")
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/code_request")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; echo "$SETUP_BODY"; exit 1; }
ROW_ID=$(echo "$SETUP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  code_request test id = $ROW_ID, request_status='pending', message INITIAL présent"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/code_request/$ROW_ID")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/code_request/$ROW_ID")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (aucun audit attendu) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/code_request/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : PUT admin non-status (payload complet, quantity+reason modifiés) ==="
T4_PAYLOAD=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':12,
  'reason':'${TEST_REASON}_PUT_UPDATE',
  'request_status':'pending',
  'request_type':'standard',
  'message':'$TEST_MESSAGE_INITIAL'
}))")
T4_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T4_PAYLOAD" "$B/code_request/$ROW_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin PUT quantity+reason (status inchangé, message inchangé)" "200" "$T4_CODE" ""
echo "    request_status après T4 = $(echo "$T4_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('request_status',''))")"
echo "    audit attendu : action_type='update', full_replace=true, status_changed=false, message_modified=false, message_present=true"

echo ""
echo "=== Volet D : PUT admin request_status pending → processed (payload complet) ==="
T5_PAYLOAD=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':12,
  'reason':'${TEST_REASON}_PUT_UPDATE',
  'request_status':'processed',
  'request_type':'standard',
  'message':'$TEST_MESSAGE_INITIAL'
}))")
T5_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T5_PAYLOAD" "$B/code_request/$ROW_ID")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin PUT request_status pending→processed" "200" "$T5_CODE" ""
echo "    request_status après T5 = $(echo "$T5_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('request_status',''))")"
echo "    audit attendu : action_type='process_request', full_replace=true, status_changed=true,"
echo "                    previous_status='pending', new_status='processed', message_modified=false"

echo ""
echo "=== Volet E : PUT admin avec message MODIFIÉ (payload complet) ==="
T6_PAYLOAD=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':12,
  'reason':'${TEST_REASON}_PUT_UPDATE',
  'request_status':'processed',
  'request_type':'standard',
  'message':'$TEST_MESSAGE_MODIFIED'
}))")
T6_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$T6_PAYLOAD" "$B/code_request/$ROW_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
hcheck "T6 admin PUT message modifié (status inchangé)" "200" "$T6_CODE" ""
echo "    audit attendu : action_type='update', full_replace=true, status_changed=false,"
echo "                    message_modified=true, message_present=true"
echo "    Le contenu des deux messages NE DOIT JAMAIS apparaître dans l'audit."

echo ""
echo "=== Fin tests Batch 7D.2.d ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    code_request id = $ROW_ID (reason débute par BATCH7D_PUT_TEST)"
echo "    audit_logs où object_type='code_request' object_id=$ROW_ID :"
echo "      - 1 audit create (setup 1330)"
echo "      - 1 audit update (T4)"
echo "      - 1 audit process_request (T5)"
echo "      - 1 audit update (T6, message_modified=true)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Ne pas toucher code_request id=1 et id=2 (rows production préexistantes)."
