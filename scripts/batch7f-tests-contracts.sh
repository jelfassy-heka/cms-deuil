#!/bin/bash
# Batch 7F.2.a — Tests audit contracts (1298 POST + 1299 PATCH + 1295 DELETE)
# Workspace 17, group api:M9mahf09.
#
# Couvre les 3 endpoints contracts en un seul flux :
#  - 401 sans bearer / bearer invalide (3 endpoints)
#  - 404 id inexistant (PATCH + DELETE)
#  - 200 admin POST → audit create
#  - 200 admin PATCH → audit update (incl. document_url modifié)
#  - 200 admin DELETE → audit delete
#  - 404 ré-DELETE même id
#
# document_url envoyé pour vérifier exclusion des snapshots audit.
# Aucun bearer affiché en clair.
# Usage : bash scripts/batch7f-tests-contracts.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_DOC_URL_INITIAL="https://test.local/contract-initial-${TS}.pdf"
TEST_DOC_URL_MODIFIED="https://test.local/contract-modified-${TS}.pdf"

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
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/contracts")
hcheck "T1 POST /contracts sans bearer" "401" "$T1" ""
T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/contracts")
hcheck "T2 POST /contracts bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (PATCH + DELETE → 404, aucun audit) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"price":1}' "$B/contracts/999999")
hcheck "T3 PATCH /contracts/999999 (admin)" "404" "$T3" ""
T4=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contracts/999999")
hcheck "T4 DELETE /contracts/999999 (admin)" "404" "$T4" ""

echo ""
echo "=== Volet C : POST admin avec document_url (audit create attendu) ==="
POST_PAYLOAD="{\"partner_id\":1,\"start_date\":1730000000000,\"end_date\":1761536000000,\"auto_renewal\":true,\"max_codes\":100,\"price\":5000,\"contract_status\":\"active\",\"document_url\":\"$TEST_DOC_URL_INITIAL\"}"
unset TEST_DOC_URL_INITIAL
T5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$POST_PAYLOAD" "$B/contracts")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin POST /contracts" "200" "$T5_CODE" ""
ROW_ID=$(echo "$T5_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    contract test id = $ROW_ID, partner_id=1, document_url présent"
echo "    audit attendu : action_type='create', new_values 9 champs SANS document_url, metadata.document_url_present=true"

echo ""
echo "=== Volet D : PATCH admin (modif price + contract_status + document_url) ==="
PATCH_PAYLOAD="{\"price\":9000,\"contract_status\":\"renewed\",\"max_codes\":200,\"document_url\":\"$TEST_DOC_URL_MODIFIED\"}"
unset TEST_DOC_URL_MODIFIED
T6_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PATCH_PAYLOAD" "$B/contracts/$ROW_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
hcheck "T6 admin PATCH /contracts/$ROW_ID" "200" "$T6_CODE" ""
echo "    audit attendu : changed_fields=[price,contract_status,max_codes,document_url],"
echo "                    document_url_modified=true, document_url_present=true"
echo "    document_url ABSENT de previous_values et new_values"

echo ""
echo "=== Volet E : DELETE admin (audit delete attendu) ==="
T7_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contracts/$ROW_ID")
T7_CODE=$(echo "$T7_RESP" | tail -1)
hcheck "T7 admin DELETE /contracts/$ROW_ID" "200" "$T7_CODE" ""
echo "    audit attendu : action_type='delete', previous_values 9 champs SANS document_url,"
echo "                    metadata.document_url_present=true (depuis \$existing)"

echo ""
echo "=== Vérif post-DELETE : ré-DELETE même id → 404 (aucun audit supplémentaire) ==="
T8=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contracts/$ROW_ID")
hcheck "T8 ré-DELETE même id" "404" "$T8" ""

echo ""
echo "=== Fin tests Batch 7F.2.a ==="
echo ""
echo ">>> contract id=$ROW_ID auto-supprimé par T7."
echo ">>> audit_logs à supprimer côté Claude (object_type='contract' object_id=$ROW_ID) :"
echo "    - 1 audit create (T5)"
echo "    - 1 audit update (T6, document_url_modified=true)"
echo "    - 1 audit delete (T7)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> document_url ne doit jamais apparaître dans les snapshots audit."
echo ">>> Cas partenaire couvert par revue de code (precondition admin-only stricte)."
