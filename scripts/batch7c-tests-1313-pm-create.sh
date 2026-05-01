#!/bin/bash
# Batch 7C.2.a — Tests audit POST /partner_members
# Workspace 17, group api:M9mahf09.
#
# Crée un partner_member test sur partner_id=4 (partner test existant, sans dépendance critique).
# AUCUN bearer/MDP affiché en clair.
#
# Usage : bash scripts/batch7c-tests-1313-pm-create.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7c-pm-test-${TS}@invalid.local"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

# Login admin
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
echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"partner_id\":4,\"user_email\":\"$TEST_EMAIL\",\"role\":\"member\",\"status\":\"active\"}" "$B/partner_members")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "{\"partner_id\":4,\"user_email\":\"$TEST_EMAIL\",\"role\":\"member\",\"status\":\"active\"}" "$B/partner_members")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin POST /partner_members (création + audit) ==="
PAYLOAD=$(python3 -c "import json;print(json.dumps({'partner_id':4,'user_email':'$TEST_EMAIL','role':'member','status':'active','invited_by':'admin'}))")
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/partner_members")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin POST + nouveau email" "200" "$T3_CODE" "$T3_BODY"

PM_ID=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    Partner_member id créé = $PM_ID"
echo ""

echo "=== Fin tests Batch 7C.2.a ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    partner_members id = $PM_ID (user_email = $TEST_EMAIL)"
echo "    audit_logs ligne où object_id=$PM_ID + action_type='create' + object_type='partner_member'"
echo ">>> Aucun bearer affiché."
