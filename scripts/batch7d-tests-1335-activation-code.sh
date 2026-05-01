#!/bin/bash
# Batch 7D.2.a — Tests audit POST /plan-activation-code
# Workspace 17, group api:M9mahf09.
#
# Couvre :
#  - 401 sans bearer / bearer invalide
#  - 404 partnerId inexistant
#  - 400 code dupliqué (inputerror)
#  - 200 admin OK → audit créé
#
# Aucun bearer, aucun code complet n'est affiché en clair dans le rapport.
# Usage : bash scripts/batch7d-tests-1335-activation-code.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_CODE="BATCH7D_CODE_${TS}"
TEST_CODE_MASKED="BA***${TS: -2}"

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
echo "  Code test (masqué affiché côté client uniquement) : $TEST_CODE_MASKED"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

PAYLOAD_OK="{\"code\":\"$TEST_CODE\",\"partnerId\":1}"
PAYLOAD_NOPARTNER="{\"code\":\"DUMMY_${TS}\",\"partnerId\":999999}"

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD_OK" "$B/plan-activation-code")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD_OK" "$B/plan-activation-code")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin + partnerId inexistant (aucun audit attendu) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_NOPARTNER" "$B/plan-activation-code")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin partnerId=999999" "404" "$T3_CODE" ""
echo "    body T3: $T3_BODY"

echo ""
echo "=== Volet C : admin + code unique + partnerId=1 (audit attendu) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_OK" "$B/plan-activation-code")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin POST code unique" "200" "$T4_CODE" ""
ROW_ID=$(echo "$T4_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
echo "    plan-activation-code id créé = $ROW_ID, partnerId = 1"

echo ""
echo "=== Volet D : admin + code dupliqué (aucun audit attendu) ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_OK" "$B/plan-activation-code")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin POST code dupliqué" "400" "$T5_CODE" ""
echo "    body T5: $T5_BODY"

echo ""
echo "=== Fin tests Batch 7D.2.a ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    plan-activation-code id = $ROW_ID (code masqué : $TEST_CODE_MASKED)"
echo "    audit_logs où object_id=$ROW_ID + object_type='activation_code' (T4)"
echo "    + 1 audit login admin (script)"
echo ">>> Vérifier audit cible :"
echo "    - action_type='create', action_label='Created activation code'"
echo "    - object_type='activation_code', object_id=$ROW_ID, object_partner_id=1"
echo "    - new_values whitelist 8 champs (id, created_at, planId, used, usedBy,"
echo "      activationDateTime, target, partnerId), SANS code"
echo "    - metadata.code_masked='***' (conservateur)"
echo ">>> Aucun bearer, aucun code complet ne doit apparaître dans l'audit ni dans ce rapport."
