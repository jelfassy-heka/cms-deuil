#!/bin/bash
# Batch 7B.2.b — Tests audit_logs sur 1347 POST /change-password
# Workspace 17, group api:IS_IPWIL.
#
# Crée compte test admin, teste change-password (refus + succès), vérifie audit logs côté Claude.
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR.
#
# Usage :
#   bash scripts/batch7b-tests-1347-changepwd.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7b-change-password-${TS}@invalid.local"
TEST_NAME="Batch7B ChangePwd ${TS}"

# ─── Saisie masquée MDP admin
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }

TEST_PWD_1=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Aa1!
TEST_PWD_2=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Bb2@

echo "=== Setup ==="
echo "  test email = $TEST_EMAIL"
echo "  pwd_1 (initial) len=${#TEST_PWD_1} (jamais affiché)"
echo "  pwd_2 (nouveau) len=${#TEST_PWD_2} (jamais affiché)"
echo ""

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"

# ─── Signup compte test
SIGNUP_BODY=$(TEST_PWD="$TEST_PWD_1" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','name':'$TEST_NAME','user_type':'admin','password':os.environ['TEST_PWD']}))")
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/signup" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | tail -1)
[ "$SIGNUP_CODE" != "200" ] && { echo "Signup compte test KO [HTTP $SIGNUP_CODE]"; exit 1; }
echo "  Signup compte test OK (créera aussi 1 audit log signup à nettoyer)"

# ─── Login compte test
LOGIN1_BODY=$(TEST_PWD="$TEST_PWD_1" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN1_BODY")
T_LOGIN_CODE=$(echo "$T_LOGIN_RESP" | tail -1)
[ "$T_LOGIN_CODE" != "200" ] && { echo "Login compte test KO [HTTP $T_LOGIN_CODE]"; exit 1; }
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

ME_RESP=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Compte test id = $TEST_ID"
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
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"old_password":"x","new_password":"y"}' "$A/change-password")
hcheck "T1 sans bearer" "401" "$T1_CODE" ""

T2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"old_password":"x","new_password":"y"}' "$A/change-password")
hcheck "T2 bearer invalide" "401" "$T2_CODE" ""

echo ""
echo "=== Volet B : change-password old INCORRECT (no audit attendu) ==="

T3_BODY=$(TEST_PWD="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'old_password':'WRONG_OLD','new_password':os.environ['TEST_PWD']}))")
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T3_BODY" "$A/change-password")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY_RESP=$(echo "$T3_RESP" | head -1)
hcheck "T3 old incorrect" "403" "$T3_CODE" "$T3_BODY_RESP"
echo "    → aucune ligne audit password_change ne doit être créée pour ce test"

echo ""
echo "=== Volet C : change-password old CORRECT (audit attendu) ==="

T4_BODY=$(TEST_PWD_1_VAR="$TEST_PWD_1" TEST_PWD_2_VAR="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'old_password':os.environ['TEST_PWD_1_VAR'],'new_password':os.environ['TEST_PWD_2_VAR']}))")
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T4_BODY" "$A/change-password")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY_RESP=$(echo "$T4_RESP" | head -1)
hcheck "T4 old correct + new" "200" "$T4_CODE" "$T4_BODY_RESP"

# Vérif rapide login pwd_2
T4V2_BODY=$(TEST_PWD="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T4V2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$T4V2_BODY")
hcheck "  T4.v2 login pwd_2 (nouveau)" "200" "$T4V2_CODE" ""

echo ""
echo "=== Fin tests Batch 7B.2.b ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    cms_users id = $TEST_ID (email = $TEST_EMAIL)"
echo "    audit_logs où object_id=$TEST_ID :"
echo "      - 1 ligne action_type='signup' (créée par 1345 au setup)"
echo "      - 1 ligne action_type='password_change' (créée par T4)"
echo ">>> Aucun MDP, bearer ou authToken affiché en clair."
