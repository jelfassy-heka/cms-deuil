#!/bin/bash
# Batch 4 — Test endpoint #3 : 1308 POST /crm_activity
# Workspace 17, group api:M9mahf09. Admin-only + bugfix data={created_at} attendus.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   bash scripts/batch4-tests-1308.sh
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1308.sh
#
# Variables optionnelles :
#   ADMIN_PASSWORD     mot de passe admin Héka
#   PARTNER_EMAIL      email partenaire test
#   PARTNER_PASSWORD   mot de passe partenaire
#   TEST_PARTNER_ID    partner_id à utiliser pour la ligne test (default: 1)
#
# Note : la ligne temporaire créée par T3 sera supprimée par Claude via MCP
# (deleteTableContentItem table 298) après ton retour avec l'id remonté.

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_PARTNER_ID="${TEST_PARTNER_ID:-1}"

# ─── Saisie masquée mot de passe admin
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Mot de passe admin manquant. Stop."
  exit 2
fi

# ─── Saisie masquée mot de passe partenaire si email fourni
if [ -n "${PARTNER_EMAIL:-}" ] && [ -z "${PARTNER_PASSWORD:-}" ]; then
  printf "Mot de passe partenaire (%s) : " "$PARTNER_EMAIL"
  stty -echo
  IFS= read -r PARTNER_PASSWORD
  stty echo
  printf "\n"
fi

# ─── Login admin
LOGIN_BODY="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)

echo "=== Login admin ==="
echo "[HTTP $LOGIN_CODE]"

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login admin échoué. Stop."
  exit 1
fi

ADMIN_TOKEN=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "Admin bearer obtenu (len=${#ADMIN_TOKEN})"
echo ""

# ─── Login partenaire (optionnel)
PARTNER_TOKEN=""
if [ -n "${PARTNER_EMAIL:-}" ] && [ -n "${PARTNER_PASSWORD:-}" ]; then
  P_LOGIN_BODY="{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}"
  P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$P_LOGIN_BODY")
  P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
  P_LOGIN_BODY_RESP=$(echo "$P_LOGIN_RESP" | head -1)
  echo "=== Login partenaire ==="
  echo "[HTTP $P_LOGIN_CODE]"
  if [ "$P_LOGIN_CODE" = "200" ]; then
    PARTNER_TOKEN=$(echo "$P_LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
    echo "Partner bearer obtenu (len=${#PARTNER_TOKEN})"
  else
    echo "Login partenaire échoué — test 403 sera sauté."
  fi
  echo ""
fi

# ─── Payload de test (tous les 6 champs métier remplis pour vérifier persistance)
TEST_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "activity_type": "BATCH4_TEST_1308",
  "note": "ligne temporaire test 1308 — à supprimer",
  "crm_status": "test",
  "last_contact_at": "2026-04-30T18:00:00Z",
  "next_followup_at": "2026-05-15T18:00:00Z"
}
EOF
)

# ─── T1 : POST sans bearer → 401
echo "=== T1 POST /crm_activity sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/crm_activity")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : POST bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 POST /crm_activity bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/crm_activity")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : POST bearer admin → 200/201 + champs persistés
echo "=== T3 POST /crm_activity bearer admin (création) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/crm_activity")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200/201)"
echo "Body: $T3_BODY"
echo ""

# ─── Vérification champs persistés (le bug data={created_at} ne devait persister QUE created_at)
echo "=== Vérification persistance des 6 champs métier ==="
echo "$T3_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if not isinstance(d, dict):
        print(f'  Réponse non-objet : {type(d).__name__}')
        sys.exit(0)
    fields = ['partner_id', 'activity_type', 'note', 'crm_status', 'last_contact_at', 'next_followup_at']
    for f in fields:
        v = d.get(f)
        empty = v in (None, '', 0)
        marker = 'VIDE/0/null' if empty else 'OK'
        print(f'  {f:18s} = {repr(v)[:60]:60s} [{marker}]')
    created_id = d.get('id')
    print('')
    print(f'  >>> id créé = {created_id}')
    print(f'  >>> à supprimer côté Claude via MCP deleteTableContentItem table_id=298')
except Exception as e:
    print(f'JSON parse error: {e}')
"
echo ""

echo "=== Fin tests 1308 ==="
echo ""
echo "ACTION : remonter à Claude le body T3 + l'id créé pour cleanup MCP."
