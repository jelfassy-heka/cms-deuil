#!/bin/bash
# Batch 7C.2.b — Tests audit PATCH /parnter_members/{id}
# Workspace 17, group api:M9mahf09. Conserve typo /parnter_members/.
#
# Crée un partner_member test sur partner_id=4, fait 2 PATCH (sans role_change + avec role_change),
# puis cleanup côté Claude.
#
# Usage : bash scripts/batch7c-tests-1314-pm-patch.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7c-pm-patch-${TS}@invalid.local"

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
echo "=== Setup : créer partner_member test (partner_id=4, role=member, status=active) ==="
SETUP_BODY="{\"partner_id\":4,\"user_email\":\"$TEST_EMAIL\",\"role\":\"member\",\"status\":\"active\",\"invited_by\":\"admin\"}"
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$SETUP_BODY" "$B/partner_members")
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY_RESP=$(echo "$SETUP_RESP" | head -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; echo "$SETUP_BODY_RESP"; exit 1; }
PM_ID=$(echo "$SETUP_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Partner_member test id = $PM_ID, role=member, status=active"
echo "  (créera 1 audit create + 1 audit login admin à nettoyer)"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'Content-Type: application/json' -d '{"role":"x"}' "$B/parnter_members/$PM_ID")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"role":"x"}' "$B/parnter_members/$PM_ID")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"member"}' "$B/parnter_members/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : PATCH sans role_change (status only) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"status":"invited"}' "$B/parnter_members/$PM_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 PATCH status only (pas de role_change)" "200" "$T4_CODE" "$T4_BODY"
echo "    → audit attendu : action_type='update', role_changed=false"

echo ""
echo "=== Volet D : PATCH avec role_change (member → admin) ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"admin"}' "$B/parnter_members/$PM_ID")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 PATCH role member→admin (role_change)" "200" "$T5_CODE" "$T5_BODY"
echo "    → audit attendu : action_type='role_change', role_changed=true, previous_role='member', new_role='admin'"

echo ""
echo "=== Fin tests Batch 7C.2.b ==="
echo ""
echo ">>> À supprimer côté Claude :"
echo "    partner_members id = $PM_ID (user_email = $TEST_EMAIL)"
echo "    audit_logs où object_id=$PM_ID + object_type='partner_member' :"
echo "      - 1 audit create (setup via 1313)"
echo "      - 1 audit update (T4)"
echo "      - 1 audit role_change (T5)"
echo "    + 1 audit login admin (du script)"
echo ">>> Aucun bearer affiché."
