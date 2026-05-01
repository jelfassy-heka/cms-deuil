#!/bin/bash
# Batch 8.3 — Tests 1347 POST /change-password (correction Bug A)
# Workspace 17, group api:IS_IPWIL.
#
# Crée un compte cms_user temporaire (admin) avec un MDP initial généré localement.
# Tests : 401, 403 si old incorrect (no write), 200 + bascule si old correct.
# Vérifie is_first_login passe à false uniquement après succès.
#
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR.
#
# Usage :
#   bash scripts/batch8-tests-1347.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch8-change-password-${TS}@invalid.local"
TEST_NAME="Batch8 ChangePwd ${TS}"

# ─── Saisie masquée MDP admin
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }

# ─── Génération MDP test1 (initial) et test2 (nouveau) localement
TEST_PWD_1=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Aa1!
TEST_PWD_2=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Bb2@

echo "=== Setup compte test temporaire ==="
echo "  email = $TEST_EMAIL"
echo "  pwd_1 (initial) = (généré localement, len=${#TEST_PWD_1}, jamais affiché)"
echo "  pwd_2 (nouveau)  = (généré localement, len=${#TEST_PWD_2}, jamais affiché)"
echo ""

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK (token len=${#ADMIN_TOKEN})"

# ─── Signup compte test avec MDP initial
SIGNUP_BODY=$(TEST_PWD="$TEST_PWD_1" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','name':'$TEST_NAME','user_type':'admin','password':os.environ['TEST_PWD']}))")
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/signup" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | tail -1)
[ "$SIGNUP_CODE" != "200" ] && { echo "Signup compte test KO [HTTP $SIGNUP_CODE]"; echo "$SIGNUP_RESP" | head -1; exit 1; }
echo "  Signup compte test OK"

# ─── Login compte test avec MDP_1
LOGIN1_BODY=$(TEST_PWD="$TEST_PWD_1" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
T_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN1_BODY")
T_LOGIN_CODE=$(echo "$T_LOGIN_RESP" | tail -1)
[ "$T_LOGIN_CODE" != "200" ] && { echo "Login compte test (pwd_1) KO [HTTP $T_LOGIN_CODE]"; exit 1; }
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Login compte test avec pwd_1 OK"

# ─── Capture profil initial via /auth/me
ME_INITIAL=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_INITIAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
IS_FIRST_INITIAL=$(echo "$ME_INITIAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
echo "  Compte test id = $TEST_ID, is_first_login_initial = $IS_FIRST_INITIAL (attendu True)"
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

# helper login (returns just HTTP code)
login_code() {
  local pwd_var="$1"
  local body=$(eval echo "\$$pwd_var" | python3 -c "import json,sys;pwd=sys.stdin.read().strip();print(json.dumps({'email':'$TEST_EMAIL','password':pwd}))")
  curl -s -o /dev/null -w "%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$body"
}

echo "=== Volet A : auth checks ==="

T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"old_password":"x","new_password":"y"}' "$A/change-password")
hcheck "T1 sans bearer" "401" "$T1_CODE" ""

T2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN_XYZ" -H 'Content-Type: application/json' -d '{"old_password":"x","new_password":"y"}' "$A/change-password")
hcheck "T2 bearer invalide" "401" "$T2_CODE" ""

echo ""
echo "=== Volet B : change-password avec old INCORRECT (doit refuser, no write) ==="

# ─── T3 change-password avec old_password=WRONG, new=pwd_2 → 403, no change
T3_BODY=$(TEST_PWD="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'old_password':'WRONG_OLD','new_password':os.environ['TEST_PWD']}))")
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T3_BODY" "$A/change-password")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY_RESP=$(echo "$T3_RESP" | head -1)
hcheck "T3 old_password incorrect" "403" "$T3_CODE" "$T3_BODY_RESP"

# Vérifs post-T3
T3V1=$(login_code TEST_PWD_1)
hcheck "  T3.v1 login pwd_1 (initial doit toujours fonctionner)" "200" "$T3V1" ""

T3V2=$(login_code TEST_PWD_2)
# Si Bug A était présent, MDP serait devenu pwd_2 → login 200. Sinon 500/403/401 = OK.
if [ "$T3V2" = "200" ]; then
  echo "    T3.v2 login pwd_2 (NE doit PAS fonctionner)                              [HTTP $T3V2] [ANOMALIE — Bug A présent]"
else
  echo "    T3.v2 login pwd_2 (NE doit PAS fonctionner)                              [HTTP $T3V2] (non-200, attendu) [OK]"
fi

ME_AFTER_T3=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
IS_FIRST_AFTER_T3=$(echo "$ME_AFTER_T3" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
if [ "$IS_FIRST_AFTER_T3" = "$IS_FIRST_INITIAL" ]; then
  echo "    T3.v3 is_first_login inchangé après T3 ($IS_FIRST_INITIAL → $IS_FIRST_AFTER_T3) [OK]"
else
  echo "    T3.v3 is_first_login MODIFIÉ après T3 ($IS_FIRST_INITIAL → $IS_FIRST_AFTER_T3) [ANOMALIE]"
fi

echo ""
echo "=== Volet C : change-password avec old CORRECT (doit basculer) ==="

# ─── T4 change-password avec old_password=pwd_1, new=pwd_2 → 200 {success:true}
T4_BODY=$(TEST_PWD_1_VAR="$TEST_PWD_1" TEST_PWD_2_VAR="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'old_password':os.environ['TEST_PWD_1_VAR'],'new_password':os.environ['TEST_PWD_2_VAR']}))")
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T4_BODY" "$A/change-password")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY_RESP=$(echo "$T4_RESP" | head -1)
hcheck "T4 old_password correct + new_password" "200" "$T4_CODE" "$T4_BODY_RESP"

# Vérifs post-T4
T4V1=$(login_code TEST_PWD_1)
if [ "$T4V1" = "200" ]; then
  echo "    T4.v1 login pwd_1 (NE doit PLUS fonctionner)                             [HTTP $T4V1] [ANOMALIE — bascule incomplète]"
else
  echo "    T4.v1 login pwd_1 (NE doit PLUS fonctionner)                             [HTTP $T4V1] (non-200, attendu) [OK]"
fi

T4V2=$(login_code TEST_PWD_2)
hcheck "  T4.v2 login pwd_2 (nouveau MDP doit fonctionner)" "200" "$T4V2" ""

# Pour /auth/me on a besoin d'un nouveau token (l'ancien peut encore être valide selon politique Xano, mais on prend le token frais issu du login pwd_2)
LOGIN2_BODY=$(TEST_PWD="$TEST_PWD_2" python3 -c "import json,os;print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PWD']}))")
RELOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN2_BODY")
RELOGIN_CODE=$(echo "$RELOGIN_RESP" | tail -1)
if [ "$RELOGIN_CODE" = "200" ]; then
  TEST_TOKEN_2=$(echo "$RELOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
  ME_AFTER_T4=$(curl -s -H "Authorization: Bearer $TEST_TOKEN_2" "$A/auth/me")
  IS_FIRST_AFTER_T4=$(echo "$ME_AFTER_T4" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
  if [ "$IS_FIRST_AFTER_T4" = "False" ] || [ "$IS_FIRST_AFTER_T4" = "false" ]; then
    echo "    T4.v3 is_first_login passé à false après succès ($IS_FIRST_INITIAL → $IS_FIRST_AFTER_T4) [OK]"
  else
    echo "    T4.v3 is_first_login attendu=false, obtenu=$IS_FIRST_AFTER_T4 [ANOMALIE]"
  fi
fi

echo ""
echo "=== Fin tests Batch 8.3 change-password ==="
echo ""
echo ">>> Compte test id=$TEST_ID (email=$TEST_EMAIL) à supprimer côté Claude via MCP."
echo ">>> Aucun MDP, bearer ou hash affiché en clair."
