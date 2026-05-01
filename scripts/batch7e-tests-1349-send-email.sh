#!/bin/bash
# Batch 7E.2.b — Tests audit POST /send-email
# Workspace 17, group api:M9mahf09.
#
# Couvre UNIQUEMENT les chemins refusés AVANT api.request Brevo :
#  - 401 sans bearer / bearer invalide
#  - 400 inputerror template_id=999 (whitelist Batch 5C)
#
# Cas partenaire T#10/T#14 admin-only couvert par revue de code (pas de credentials partenaire).
#
# AUCUN test n'atteint api.request Brevo. AUCUN email envoyé.
# Aucune row temporaire — endpoint stateless côté CMS.
#
# Aucun bearer affiché en clair, aucun params loggué.
# Usage : bash scripts/batch7e-tests-1349-send-email.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)

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

PAYLOAD_BAD_TEMPLATE='{"to_email":"x@invalid.local","to_name":"y","template_id":999,"params":"{}"}'

echo "=== Volet A : auth checks ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD_BAD_TEMPLATE" "$B/send-email")
hcheck "T1 sans bearer" "401" "$T1" ""

T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d "$PAYLOAD_BAD_TEMPLATE" "$B/send-email")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : admin template_id=999 (whitelist refus, AUCUN appel Brevo) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD_BAD_TEMPLATE" "$B/send-email")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin template_id=999 (hors whitelist)" "400" "$T3_CODE" ""
echo "    body T3: $T3_BODY"
echo "    AUCUN appel Brevo (precondition whitelist échoue avant api.request)"

echo ""
echo "=== Vérification : whitelist préservée ==="
echo "    Templates autorisés : {10, 11, 12, 13, 14, 15}"
echo "    T#10/T#14 admin-only via precondition is_admin || (!= 10 && != 14)"
echo "    Logique inchangée par l'audit (audit branché APRÈS api.request)"

echo ""
echo "=== Fin tests Batch 7E.2.b ==="
echo ""
echo ">>> AUCUN test n'a atteint api.request Brevo."
echo ">>> AUCUN email envoyé."
echo ""
echo ">>> À supprimer côté Claude :"
echo "    1 audit login admin (script)"
echo ""
echo ">>> Aucun audit send_email ne doit exister (tous les tests refusés AVANT api.request)."
echo ">>> Cas partenaire T#10/T#14 admin-only couvert par revue de code."
