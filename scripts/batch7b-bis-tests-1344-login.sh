#!/bin/bash
# Batch 7B-bis — Tests 1344 POST /auth/login (correction 500 + audit success/failed)
# Workspace 17, group api:IS_IPWIL.
#
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR.
#
# Usage :
#   bash scripts/batch7b-bis-tests-1344-login.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7b-login-${TS}@invalid.local"
TEST_NAME="Batch7B Login ${TS}"
NONEXISTENT_EMAIL="batch7b-noone-${TS}@invalid.local"

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
echo "  nonexistent email = $NONEXISTENT_EMAIL"
echo "  test pwd len=${#TEST_PWD} (jamais affiché)"
echo ""

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"

# ─── Signup compte test
SIGNUP_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','name':'$TEST_NAME','user_type':'admin','password':os.environ['TEST_PWD']}))")
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/signup" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | tail -1)
[ "$SIGNUP_CODE" != "200" ] && { echo "Signup compte test KO"; exit 1; }
echo "  Signup compte test OK (créera 1 audit signup à nettoyer)"

# Récupérer test_id via login + auth/me
LOGIN_TEST_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T_LOGIN_RESP=$(curl -s -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_TEST_BODY")
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
ME_RESP=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Compte test id = $TEST_ID"
echo ""
echo "  ⚠️ Note : le login ci-dessus pour récupérer test_id écrira aussi 1 audit login success."
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo "=== Volet A : payload edge case ==="

T0_RESP=$(curl -s -w "\n%{http_code}" -X POST -H 'Content-Type: application/json' -d '{}' "$A/auth/login")
T0_CODE=$(echo "$T0_RESP" | tail -1)
T0_BODY=$(echo "$T0_RESP" | head -1)
if [ "$T0_CODE" = "500" ]; then
  echo "  T0 body vide                                                            [HTTP 500] [ANOMALIE — 500 NON corrigé]"
else
  echo "  T0 body vide                                                            [HTTP $T0_CODE] (non-500 attendu) [OK]"
fi
echo "    body: $T0_BODY"

echo ""
echo "=== Volet B : login_failed (CASE 1 : email inexistant + CASE 2 : email existant + wrong) ==="

# T1 email inexistant
T1_BODY=$(python3 -c "import json;print(json.dumps({'email':'$NONEXISTENT_EMAIL','password':'wrong_test_xyz'}))")
T1_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$T1_BODY")
T1_CODE=$(echo "$T1_RESP" | tail -1)
T1_BODY_RESP=$(echo "$T1_RESP" | head -1)
hcheck "T1 email inexistant + wrong pwd" "401" "$T1_CODE" "$T1_BODY_RESP"

# T2 email existant + wrong password
T2_BODY=$(python3 -c "import json;print(json.dumps({'email':'$TEST_EMAIL','password':'wrong_test_xyz'}))")
T2_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$T2_BODY")
T2_CODE=$(echo "$T2_RESP" | tail -1)
T2_BODY_RESP=$(echo "$T2_RESP" | head -1)
hcheck "T2 email existant + wrong pwd" "401" "$T2_CODE" "$T2_BODY_RESP"

# Vérification indistinguabilité T1 vs T2
if [ "$T1_BODY_RESP" = "$T2_BODY_RESP" ] && [ "$T1_CODE" = "$T2_CODE" ]; then
  echo "  → T1 et T2 INDISTINGUABLES côté response (même status, même body) [OK]"
else
  echo "  → T1 et T2 distinguables — POSSIBLE FUITE [À INVESTIGUER]"
  echo "    T1 status=$T1_CODE body=$T1_BODY_RESP"
  echo "    T2 status=$T2_CODE body=$T2_BODY_RESP"
fi

echo ""
echo "=== Volet C : login success ==="

T3_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_TEST_BODY")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 email test + correct pwd" "200" "$T3_CODE" ""

if echo "$T3_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if 'authToken' in d else 1)" 2>/dev/null; then
  echo "    → response contient authToken (compte authentifié) [OK, token non affiché]"
else
  echo "    → response shape inattendue [ANOMALIE]"
fi

echo ""
echo "=== Fin tests Batch 7B-bis ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    cms_users id = $TEST_ID (email = $TEST_EMAIL)"
echo "    audit_logs avec actor_email IN ($TEST_EMAIL, $NONEXISTENT_EMAIL)"
echo "    Note : audit signup setup + audit login récup id + audit T1 + audit T2 + audit T3 = 5 lignes"
echo ">>> Aucun MDP, bearer ou authToken affiché en clair."
