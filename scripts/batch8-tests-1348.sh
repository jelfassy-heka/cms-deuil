#!/bin/bash
# Batch 8.2 — Tests 1348 POST /verify-password (correction Bug B)
# Workspace 17, group api:IS_IPWIL.
#
# Crée un compte cms_user temporaire (admin) avec un MDP généré localement.
# Tests : 401, 403 si MDP incorrect, 200 si correct, MDP non écrasé, is_first_login inchangé.
# Affiche l'id du compte test pour cleanup MCP côté Claude.
#
# AUCUN MDP, bearer ou hash AFFICHÉ EN CLAIR dans la sortie.
#
# Usage :
#   bash scripts/batch8-tests-1348.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch8-test-${TS}@invalid.local"
TEST_NAME="Batch8 Test ${TS}"

# ─── Saisie masquée MDP admin
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }

# ─── Génération MDP test fort, local, jamais affiché
TEST_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Aa1!
# Le MDP est concat openssl base64 (alphanum) + un suffixe Aa1! pour garantir complexité
# longueur ~28 chars

echo "=== Setup compte test temporaire ==="
echo "  email = $TEST_EMAIL"
echo "  password = (généré localement, len=${#TEST_PASSWORD}, jamais affiché)"
echo ""

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK (token len=${#ADMIN_TOKEN})"

# ─── Création compte test via /auth/signup (admin-only)
SIGNUP_BODY=$(TEST_PASSWORD="$TEST_PASSWORD" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','name':'$TEST_NAME','user_type':'admin','password':os.environ['TEST_PASSWORD']}))")
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/signup" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | tail -1)
[ "$SIGNUP_CODE" != "200" ] && { echo "Signup compte test KO [HTTP $SIGNUP_CODE]"; echo "$SIGNUP_RESP" | head -1; exit 1; }
echo "  Signup compte test OK"

# ─── Login compte test
TEST_LOGIN_BODY=$(TEST_PASSWORD="$TEST_PASSWORD" python3 -c "import json,os; print(json.dumps({'email':'$TEST_EMAIL','password':os.environ['TEST_PASSWORD']}))")
T_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$TEST_LOGIN_BODY")
T_LOGIN_CODE=$(echo "$T_LOGIN_RESP" | tail -1)
[ "$T_LOGIN_CODE" != "200" ] && { echo "Login compte test KO [HTTP $T_LOGIN_CODE]"; exit 1; }
TEST_TOKEN=$(echo "$T_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Login compte test OK (token len=${#TEST_TOKEN})"

# ─── Capture profil initial via /auth/me
ME_INITIAL=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
TEST_ID=$(echo "$ME_INITIAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
IS_FIRST_INITIAL=$(echo "$ME_INITIAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
echo "  Compte test id = $TEST_ID, is_first_login_initial = $IS_FIRST_INITIAL"
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo "=== Volet A : Tests verify-password ==="

# ─── T1 sans bearer
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"password":"x"}' "$A/verify-password")
hcheck "T1 sans bearer" "401" "$T1_CODE" ""

# ─── T2 bearer invalide
T2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN_XYZ" -H 'Content-Type: application/json' -d '{"password":"x"}' "$A/verify-password")
hcheck "T2 bearer invalide" "401" "$T2_CODE" ""

# ─── T3 bearer test + MDP correct → 200 {success:true}
T3_BODY=$(TEST_PASSWORD="$TEST_PASSWORD" python3 -c "import json,os;print(json.dumps({'password':os.environ['TEST_PASSWORD']}))")
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d "$T3_BODY" "$A/verify-password")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY_RESP=$(echo "$T3_RESP" | head -1)
hcheck "T3 bearer test + MDP correct" "200" "$T3_CODE" "$T3_BODY_RESP"

# ─── T4 bearer test + MDP incorrect → 403
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TEST_TOKEN" -H 'Content-Type: application/json' -d '{"password":"WRONG_PASSWORD_XYZ"}' "$A/verify-password")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 bearer test + MDP incorrect" "403" "$T4_CODE" "$T4_BODY"

echo ""
echo "=== Volet B : Vérif que le MDP n'a PAS été écrasé (preuve Bug B corrigé) ==="

# ─── T5 re-login compte test avec MDP correct → doit toujours fonctionner
T5_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$TEST_LOGIN_BODY")
T5_CODE=$(echo "$T5_RESP" | tail -1)
hcheck "T5 re-login après tentative MDP incorrect" "200" "$T5_CODE" ""
echo "    → si OK, le MDP n'a PAS été écrasé en DB ✓"

# ─── T6 re-login avec MDP "WRONG_PASSWORD_XYZ" (celui passé en T4) → doit échouer
T6_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"WRONG_PASSWORD_XYZ\"}")
hcheck "T6 login avec WRONG_PASSWORD (Bug B aurait écrasé)" "403" "$T6_CODE" ""
echo "    → si 403, le MDP du test n'est PAS devenu WRONG_PASSWORD_XYZ ✓"

echo ""
echo "=== Volet C : Vérif is_first_login inchangé ==="

ME_FINAL=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$A/auth/me")
IS_FIRST_FINAL=$(echo "$ME_FINAL" | python3 -c "import json,sys;print(json.load(sys.stdin).get('is_first_login',''))")
if [ "$IS_FIRST_INITIAL" = "$IS_FIRST_FINAL" ]; then
  echo "  is_first_login inchangé ($IS_FIRST_INITIAL → $IS_FIRST_FINAL) [OK]"
else
  echo "  is_first_login MODIFIÉ ($IS_FIRST_INITIAL → $IS_FIRST_FINAL) [ANOMALIE]"
fi
echo ""

echo "=== Fin tests Batch 8.2 verify-password ==="
echo ""
echo ">>> Compte test id=$TEST_ID (email=$TEST_EMAIL) à supprimer côté Claude via MCP."
echo ">>> Aucun MDP, bearer ou hash affiché en clair."
