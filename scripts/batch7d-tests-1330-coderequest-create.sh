#!/bin/bash
# Batch 7D.2.b — Tests audit POST /code_request
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 200 admin POST avec message → audit message_present=true
#  - 200 admin POST sans message → audit message_present=false
#
# Cas partenaire validé par revue de code (pas de compte partner_admin/partner_member
# disponible en credentials script ; logique forced_partner_id et access_mode prouvée
# côté XS pour tous les chemins).
#
# Aucun bearer affiché en clair, aucun message libre exposé dans le rapport audit.
# Usage : bash scripts/batch7d-tests-1330-coderequest-create.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_REASON_ADMIN="BATCH7D_TEST_ADMIN_${TS}"
TEST_REASON_ADMIN_NOMSG="BATCH7D_TEST_ADMIN_NOMSG_${TS}"
TEST_MESSAGE="BATCH7D message should not appear in audit"

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

PAYLOAD_WITH_MSG=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':5,
  'reason':'$TEST_REASON_ADMIN',
  'request_status':'pending',
  'request_type':'standard',
  'message':'$TEST_MESSAGE'
}))")

PAYLOAD_NO_MSG=$(python3 -c "import json;print(json.dumps({
  'partner_id':1,
  'contact_id':1,
  'quantity':3,
  'reason':'$TEST_REASON_ADMIN_NOMSG',
  'request_status':'pending',
  'request_type':'standard',
  'message':''
}))")

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD_WITH_MSG" "$B/code_request")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD_WITH_MSG" "$B/code_request")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin POST avec message → audit message_present=true ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_WITH_MSG" "$B/code_request")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin POST avec message" "200" "$T3_CODE" ""
ROW_ID_WITH_MSG=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    code_request id créé (avec message) = $ROW_ID_WITH_MSG, partner_id=1"

echo ""
echo "=== Volet C : admin POST sans message → audit message_present=false ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_NO_MSG" "$B/code_request")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin POST sans message" "200" "$T4_CODE" ""
ROW_ID_NO_MSG=$(echo "$T4_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    code_request id créé (sans message) = $ROW_ID_NO_MSG, partner_id=1"

echo ""
echo "=== Fin tests Batch 7D.2.b ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    code_request id = $ROW_ID_WITH_MSG (T3, reason=$TEST_REASON_ADMIN, message présent)"
echo "    code_request id = $ROW_ID_NO_MSG (T4, reason=$TEST_REASON_ADMIN_NOMSG, message vide)"
echo "    audit_logs où object_type='code_request' object_id ∈ [$ROW_ID_WITH_MSG, $ROW_ID_NO_MSG]"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Vérifier audits :"
echo "    T3 audit : action_type='create', message_present=true, access_mode='admin',"
echo "      forced_partner_id_applied=false, actor_role='admin', new_values SANS message"
echo "    T4 audit : action_type='create', message_present=false, access_mode='admin',"
echo "      forced_partner_id_applied=false, actor_role='admin', new_values SANS message"
echo ">>> Le contenu du message envoyé en T3 NE DOIT JAMAIS apparaître dans aucun audit_log."
echo ""
echo ">>> Ne pas toucher code_request id=1 et id=2 (rows production préexistantes)."
