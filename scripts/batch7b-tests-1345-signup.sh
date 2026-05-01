#!/bin/bash
# Batch 7B.2.a — Tests audit_logs sur 1345 POST /auth/signup
# Workspace 17, group api:IS_IPWIL.
#
# Crée un compte cms_user temporaire admin via signup.
# La vérif des audit_logs sera faite côté Claude via MCP.
# Le script se contente de signup + login + capture id pour cleanup.
#
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR.
#
# Usage :
#   bash scripts/batch7b-tests-1345-signup.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7b-signup-${TS}@invalid.local"
TEST_NAME="Batch7B Signup ${TS}"

# ─── Saisie masquée MDP admin
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }

TEST_PWD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Aa1!

echo "=== Setup ==="
echo "  test email = $TEST_EMAIL"
echo "  test pwd   = (généré localement, len=${#TEST_PWD}, jamais affiché)"
echo ""

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

echo ""
echo "=== Volet A : auth checks ==="

T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"x\",\"name\":\"x\",\"user_type\":\"admin\"}" "$A/auth/signup")
hcheck "T1 signup sans bearer" "401" "$T1_CODE"

T2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN" -H 'Content-Type: application/json' -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"x\",\"name\":\"x\",\"user_type\":\"admin\"}" "$A/auth/signup")
hcheck "T2 signup bearer invalide" "401" "$T2_CODE"

echo ""
echo "=== Volet B : signup admin (création + audit log écrit) ==="

SIGNUP_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','name':'$TEST_NAME','user_type':'admin','password':os.environ['TEST_PWD']}))")
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/signup" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin + nouveau email" "200" "$T3_CODE"

# Vérifier que le body contient authToken (donc compte créé) — sans afficher le token
if echo "$T3_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if 'authToken' in d else 1)" 2>/dev/null; then
  echo "    body contient authToken (compte créé) [OK, token non affiché]"
else
  echo "    body ne contient pas authToken [ANOMALIE]"
fi

# ─── Login compte test pour récupérer id via /auth/me
LOGIN_TEST_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_TEST_BODY")
T_LOGIN_CODE=$(echo "$T_LOGIN_RESP" | tail -1)
[ "$T_LOGIN_CODE" != "200" ] && { echo "    Login compte test KO [HTTP $T_LOGIN_CODE]"; exit 1; }
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

ME_RESP=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "    Compte test id = $TEST_ID"
echo ""

echo "=== Fin tests Batch 7B.2.a ==="
echo ""
echo ">>> Compte test à supprimer côté Claude :"
echo "    cms_users id = $TEST_ID (email = $TEST_EMAIL)"
echo ">>> Ligne audit_logs à supprimer côté Claude :"
echo "    rechercher object_type='cms_user' + object_id=$TEST_ID + action_type='signup'"
echo ">>> Aucun MDP, bearer ou authToken affiché en clair."
