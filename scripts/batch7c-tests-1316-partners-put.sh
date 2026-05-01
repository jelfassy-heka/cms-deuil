#!/bin/bash
# Batch 7C.2.e — Tests audit PUT /partners/{id}
# Workspace 17, group api:M9mahf09.
# Crée partner test via 1319, fait PUT, vérifie audit côté Claude.

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_NAME="BATCH7C_TEST_PARTNER_PUT_${TS}"
TEST_EMAIL="batch7c-put-${TS}@invalid.local"

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

echo ""
echo "=== Setup : créer partner test via 1319 ==="
SETUP_PAYLOAD=$(cat <<EOF
{
  "name": "$TEST_NAME",
  "logo_url": "https://test.local/logo-initial.png",
  "partner_type": "entreprise",
  "email_contact": "$TEST_EMAIL",
  "phone": "00 00 00 00 00",
  "crm_status": "test",
  "notes_internes": "INITIAL setup notes",
  "contact_firstname": "Initial",
  "contact_lastname": "Setup",
  "contact_role": "test",
  "xano_partner_id": 0
}
EOF
)
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_PAYLOAD" "$B/partners")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; exit 1; }
PARTNER_ID=$(echo "$SETUP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Partner test id = $PARTNER_ID (créera 1 audit create + 1 audit login)"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H 'Content-Type: application/json' -d '{"name":"x"}' "$B/partners/$PARTNER_ID")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"name":"x"}' "$B/partners/$PARTNER_ID")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"name":"x"}' "$B/partners/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : PUT admin (modif name + phone + crm_status + contact + notes_internes + logo_url) ==="
PUT_PAYLOAD=$(cat <<EOF
{
  "name": "${TEST_NAME}_UPDATED",
  "logo_url": "https://test.local/logo-modified.png",
  "partner_type": "entreprise",
  "email_contact": "$TEST_EMAIL",
  "phone": "11 11 11 11 11",
  "crm_status": "client",
  "notes_internes": "MODIFIED notes — should NOT appear in audit",
  "contact_firstname": "Modified",
  "contact_lastname": "Updated",
  "contact_role": "test",
  "xano_partner_id": 0
}
EOF
)
T4_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PUT_PAYLOAD" "$B/partners/$PARTNER_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin PUT partner test" "200" "$T4_CODE" ""
echo "    name après PUT = $(echo "$T4_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name',''))")"
echo "    audit attendu : action_type='update', previous + new whitelistés 11 champs, sans notes_internes/logo_url"
echo ""

echo "=== Fin tests Batch 7C.2.e ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    partners id = $PARTNER_ID"
echo "    audit_logs où object_id=$PARTNER_ID + object_type='partner' :"
echo "      - 1 audit create (setup)"
echo "      - 1 audit update (T4)"
echo "    + 1 audit login admin (script)"
echo ">>> Vérifier que notes_internes et logo_url sont ABSENTS du previous_values ET new_values."
