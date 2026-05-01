#!/bin/bash
# Batch 4 — Test endpoint #2 : 1306 GET /crm_activity/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 attendus après publication.
#
# Saisie masquée des mots de passe (stty -echo). Aucun secret stocké.
# Bearer JAMAIS affiché en clair.
#
# Note : la table crm_activity est vide aujourd'hui, donc le sous-test
# "admin id existant → 200" sera couvert plus tard (après publication 1308 POST).
# Ici on teste : 401 sans bearer, 403 partenaire, 404 admin id inexistant.
#
# Usage :
#   bash scripts/batch4-tests-1306.sh
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1306.sh
#
# Variables optionnelles :
#   ADMIN_PASSWORD     mot de passe admin Héka
#   PARTNER_EMAIL      email partenaire test (active T2 403)
#   PARTNER_PASSWORD   mot de passe partenaire
#   FAKE_ID            id inexistant à utiliser pour T4 (default: 999999)

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
FAKE_ID="${FAKE_ID:-999999}"

# ─── Saisie masquée mot de passe admin si non fourni
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

# ─── T1 : sans bearer → 401
echo "=== T1 GET /crm_activity/$FAKE_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$B/crm_activity/$FAKE_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 GET /crm_activity/$FAKE_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/crm_activity/$FAKE_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : bearer admin id inexistant → 404
echo "=== T3 GET /crm_activity/$FAKE_ID bearer admin (id inexistant) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity/$FAKE_ID")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 404)"
echo "Body: $T3_BODY"
echo ""

# ─── T4 : bearer admin id existant → différé
echo "=== T4 admin id existant → différé ==="
echo "(table crm_activity vide — sera couvert après publication 1308 POST)"
echo ""

echo "=== Fin tests 1306 ==="
