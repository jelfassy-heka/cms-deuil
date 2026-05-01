#!/bin/bash
# Batch 7D.2.f — Tests audit POST /beneficiaries
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 200 admin POST partner_id=1 → audit access_mode=admin, code_masked='***'
#
# Cas partenaire validé par revue de code (pas de credentials partenaire en script).
# Cleanup via MCP table 294 (1285 DELETE soft-disabled, ne pas l'utiliser).
#
# Aucun bearer affiché en clair, aucun code complet exposé dans le rapport.
# Usage : bash scripts/batch7d-tests-1288-beneficiaries-create.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL_ADMIN="batch7d-benef-admin-${TS}@invalid.local"
# Code généré localement, jamais affiché ailleurs que masqué
TEST_CODE_ADMIN=$(openssl rand -hex 4 | tr 'a-z' 'A-Z')

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

# Construction directe (TEST_CODE_ADMIN est hex uppercase via openssl rand, safe pour JSON)
PAYLOAD_ADMIN="{\"first_name\":\"BATCH7D\",\"last_name\":\"AdminTest\",\"email\":\"$TEST_EMAIL_ADMIN\",\"code\":\"$TEST_CODE_ADMIN\",\"partner_id\":1}"
unset TEST_CODE_ADMIN

PAYLOAD_FAKE='{"first_name":"x","last_name":"y","email":"z@invalid","code":"FAKE","partner_id":1}'

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD_FAKE" "$B/beneficiaries")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD_FAKE" "$B/beneficiaries")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin POST partner_id=1 (audit attendu, code masqué) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_ADMIN" "$B/beneficiaries")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin POST beneficiary" "200" "$T3_CODE" ""
BENEF_ID=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    Beneficiary id créé = $BENEF_ID, partner_id=1, email=$TEST_EMAIL_ADMIN"
echo "    audit attendu : action_type='create', access_mode='admin', code_masked='***'"
echo "    new_values whitelist 7 champs (id, partner_id, first_name, last_name, email, sent_at, created_at)"
echo "    Le code complet NE DOIT JAMAIS apparaître dans aucun audit_log"

unset PAYLOAD_ADMIN

echo ""
echo "=== Fin tests Batch 7D.2.f ==="
echo ""
echo ">>> À supprimer côté Claude (via MCP table 294 — NE PAS utiliser 1285 soft-disabled) :"
echo "    Beneficiaries id = $BENEF_ID (email=$TEST_EMAIL_ADMIN)"
echo "    audit_logs où object_type='beneficiary' object_id=$BENEF_ID"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Cas partenaire couvert par revue de code (logique conditional admin/partner_admin/partner_member"
echo "    + forced_partner_id_applied identique au pattern 7D.2.b POST code_request validé)."
