#!/bin/bash
# Batch 7C.2.d — Tests audit POST /partners
# Workspace 17, group api:M9mahf09.
# Crée un partner test "BATCH7C_TEST_PARTNER", puis cleanup côté Claude via MCP.

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_NAME="BATCH7C_TEST_PARTNER_${TS}"
TEST_EMAIL="batch7c-partner-${TS}@invalid.local"

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

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

PAYLOAD=$(cat <<EOF
{
  "name": "$TEST_NAME",
  "logo_url": "https://test.local/logo.png",
  "partner_type": "entreprise",
  "email_contact": "$TEST_EMAIL",
  "phone": "00 00 00 00 00",
  "crm_status": "test",
  "notes_internes": "BATCH 7C TEST — should NOT appear in audit",
  "contact_firstname": "Test",
  "contact_lastname": "Partner",
  "contact_role": "test",
  "xano_partner_id": 0
}
EOF
)

echo ""
echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/partners")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/partners")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin POST /partners (création + audit) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/partners")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin POST partner test" "200" "$T3_CODE" ""

PARTNER_ID=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    Partner test id créé = $PARTNER_ID, name = $TEST_NAME"
echo ""

echo "=== Fin tests Batch 7C.2.d ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    partners id = $PARTNER_ID (name = $TEST_NAME)"
echo "    audit_logs où object_id=$PARTNER_ID + object_type='partner' (audit create)"
echo "    + 1 audit login admin (du script)"
echo ">>> Vérifier que notes_internes et logo_url sont ABSENTS de new_values audit."
