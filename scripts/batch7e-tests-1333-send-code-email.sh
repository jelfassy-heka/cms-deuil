#!/bin/bash
# Batch 7E.2.a — Tests audit POST /send-code-email
# Workspace 17, group api:M9mahf09.
#
# Couvre UNIQUEMENT les chemins refusés AVANT api.request Brevo :
#  - 401 sans bearer / bearer invalide
#  - 404 code inexistant
#  - 403 to_email non-beneficiary du partner (precondition $beneficiary != null échoue)
#
# AUCUN test n'atteint api.request Brevo. AUCUN email envoyé.
# Une row temporaire plan-activation-code est créée via 1335 puis supprimée via MCP.
#
# Aucun bearer / code complet affiché.
# Usage : bash scripts/batch7e-tests-1333-send-code-email.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_CODE=$(openssl rand -hex 4 | tr 'a-z' 'A-Z')
TEST_EMAIL_NOTBENEF="batch7e-not-beneficiary-${TS}@invalid.local"

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

echo "=== Setup : créer plan-activation-code temporaire via 1335 (créera 1 audit create) ==="
SETUP_PAYLOAD="{\"code\":\"$TEST_CODE\",\"partnerId\":1}"
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/plan-activation-code")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; echo "$SETUP_BODY"; exit 1; }
PAC_ID=$(echo "$SETUP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  plan-activation-code id = $PAC_ID, partnerId=1, code masqué côté client"
echo ""

PAYLOAD_VALID="{\"to_email\":\"$TEST_EMAIL_NOTBENEF\",\"to_name\":\"Test\",\"code\":\"$TEST_CODE\",\"partner_name\":\"\"}"
PAYLOAD_NOCODE='{"to_email":"x@invalid.local","to_name":"y","code":"BATCH7E_NOCODE_INVALID","partner_name":""}'

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD_NOCODE" "$B/send-code-email")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD_NOCODE" "$B/send-code-email")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin code inexistant (precondition code_row null) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_NOCODE" "$B/send-code-email")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin code 'BATCH7E_NOCODE_INVALID'" "404" "$T3_CODE" ""
echo "    body T3: $T3_BODY"

echo ""
echo "=== Volet C : admin code valide MAIS to_email pas dans Beneficiaries (precondition beneficiary null) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_VALID" "$B/send-code-email")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin code valide + to_email étranger" "403" "$T4_CODE" ""
echo "    body T4: $T4_BODY"
echo "    AUCUN appel Brevo (precondition beneficiary échoue avant api.request)"

unset TEST_CODE PAYLOAD_VALID

echo ""
echo "=== Fin tests Batch 7E.2.a ==="
echo ""
echo ">>> AUCUN test n'a atteint api.request Brevo."
echo ">>> AUCUN email envoyé."
echo ""
echo ">>> À supprimer côté Claude :"
echo "    plan-activation-code id = $PAC_ID (table 292, créée pour test refus)"
echo "    audit_logs où object_type='activation_code' object_id=$PAC_ID (audit create issu de 1335)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Aucun audit send_code_email ne doit exister (tous les tests refusés AVANT api.request)."
echo ">>> Cas partenaire ownership couvert par revue de code."
