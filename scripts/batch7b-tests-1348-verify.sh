#!/bin/bash
# Batch 7B.2.c — Tests audit_logs sur 1348 POST /verify-password
# Workspace 17, group api:IS_IPWIL.
#
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR.
#
# Usage :
#   bash scripts/batch7b-tests-1348-verify.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7b-verify-password-${TS}@invalid.local"
TEST_NAME="Batch7B Verify ${TS}"

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
[ "$SIGNUP_CODE" != "200" ] && { echo "Signup compte test KO [HTTP $SIGNUP_CODE]"; exit 1; }
echo "  Signup compte test OK (créera aussi 1 audit signup à nettoyer)"

# ─── Login compte test
LOGIN_TEST_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_TEST_BODY")
T_LOGIN_CODE=$(echo "$T_LOGIN_RESP" | tail -1)
[ "$T_LOGIN_CODE" != "200" ] && { echo "Login compte test KO [HTTP $T_LOGIN_CODE]"; exit 1; }
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

ME_RESP=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
IS_FIRST_INITIAL=$(echo "$ME_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
echo "  Compte test id = $TEST_ID, is_first_login = $IS_FIRST_INITIAL"
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo "=== Volet A : auth checks ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"password":"x"}' "$A/verify-password")
hcheck "T1 sans bearer" "401" "$T1_CODE" ""

T2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"password":"x"}' "$A/verify-password")
hcheck "T2 bearer invalide" "401" "$T2_CODE" ""

echo ""
echo "=== Volet B : verify-password MDP INCORRECT (no audit attendu) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d '{"password":"WRONG_PASSWORD_XYZ"}' "$A/verify-password")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 MDP incorrect" "403" "$T3_CODE" "$T3_BODY"
echo "    → aucune ligne audit verify_password ne doit être créée"

echo ""
echo "=== Volet C : verify-password MDP CORRECT (audit attendu) ==="
T4_BODY=$(TEST_PWD="$TEST_PWD" python3 -c "import json,os;print(json.dumps({'password':os.environ['TEST_PWD']}))")
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T4_BODY" "$A/verify-password")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY_RESP=$(echo "$T4_RESP" | head -1)
hcheck "T4 MDP correct" "200" "$T4_CODE" "$T4_BODY_RESP"

# Vérif MDP non écrasé (re-login)
RELOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_TEST_BODY")
hcheck "  T4.v1 re-login pwd initial (preuve verify-password n'écrit pas)" "200" "$RELOGIN_CODE" ""

# Vérif is_first_login inchangé
ME_FINAL=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
IS_FIRST_FINAL=$(echo "$ME_FINAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
if [ "$IS_FIRST_INITIAL" = "$IS_FIRST_FINAL" ]; then
  echo "    T4.v2 is_first_login inchangé ($IS_FIRST_INITIAL → $IS_FIRST_FINAL) [OK]"
else
  echo "    T4.v2 is_first_login MODIFIÉ ($IS_FIRST_INITIAL → $IS_FIRST_FINAL) [ANOMALIE]"
fi

echo ""
echo "=== Fin tests Batch 7B.2.c ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    cms_users id = $TEST_ID (email = $TEST_EMAIL)"
echo "    audit_logs où object_id=$TEST_ID :"
echo "      - 1 ligne action_type='signup' (setup)"
echo "      - 1 ligne action_type='verify_password' (T4)"
echo ">>> Aucun MDP, bearer ou authToken affiché en clair."
