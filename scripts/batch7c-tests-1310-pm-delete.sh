#!/bin/bash
# Batch 7C.2.c — Tests audit DELETE /partner_members/{id}
# Workspace 17, group api:M9mahf09.
#
# Crée un partner_member test (member, active, partner_id=4), le supprime, vérifie audit.
#
# Usage : bash scripts/batch7c-tests-1310-pm-delete.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_EMAIL="batch7c-pm-delete-${TS}@invalid.local"

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
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; exit 1; }
PM_ID=$(echo "$SETUP_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  Partner_member test id = $PM_ID (créera 1 audit create + 1 audit login admin)"
echo ""

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/partner_members/$PM_ID")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer FAKE_INVALID" "$B/partner_members/$PM_ID")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (no audit attendu) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partner_members/999999")
hcheck "T3 id inexistant" "404" "$T3" ""

echo ""
echo "=== Volet C : DELETE réussi (member non-admin → was_active_admin=false) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partner_members/$PM_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin DELETE partner_member test" "200" "$T4_CODE" "$T4_BODY"
echo "    → audit attendu : action_type='delete', was_active_admin=false"

echo ""
echo "=== Vérif post-DELETE : ré-DELETE même id → 404 (preuve disparition) ==="
T5=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partner_members/$PM_ID")
hcheck "T5 ré-DELETE même id" "404" "$T5" ""

echo ""
echo "=== Fin tests Batch 7C.2.c ==="
echo ""
echo ">>> partner_member id=$PM_ID auto-supprimé par T4."
echo ">>> audit_logs à supprimer côté Claude :"
echo "    - 1 audit login admin (script)"
echo "    - 1 audit create partner_member (setup)"
echo "    - 1 audit delete partner_member (T4)"
echo ">>> Aucun bearer affiché."
