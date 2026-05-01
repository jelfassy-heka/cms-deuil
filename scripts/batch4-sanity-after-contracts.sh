#!/bin/bash
# Batch 4 — Sanity check rapide après clôture famille contracts.
#
# Vérifie en E2E que les 3 endpoints contracts hardenés fonctionnent ensemble :
#   - admin peut POST + PATCH + DELETE (cycle complet)
#   - partenaire est refusé (403) sur les 3
#   - la table contracts revient vide à la fin
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-sanity-after-contracts.sh

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

# ─── Saisie masquée mot de passe partenaire (requis ici)
if [ -z "${PARTNER_EMAIL:-}" ]; then
  echo "PARTNER_EMAIL requis pour ce sanity check. Stop."
  exit 2
fi

if [ -z "${PARTNER_PASSWORD:-}" ]; then
  printf "Mot de passe partenaire (%s) : " "$PARTNER_EMAIL"
  stty -echo
  IFS= read -r PARTNER_PASSWORD
  stty echo
  printf "\n"
fi

# ─── Login admin
echo "=== Login admin ==="
LOGIN_BODY="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)
echo "[HTTP $LOGIN_CODE]"

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login admin échoué. Stop."
  exit 1
fi

ADMIN_TOKEN=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "Admin bearer obtenu"
echo ""

# ─── Login partenaire
echo "=== Login partenaire ==="
P_LOGIN_BODY="{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}"
P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$P_LOGIN_BODY")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
P_LOGIN_BODY_RESP=$(echo "$P_LOGIN_RESP" | head -1)
echo "[HTTP $P_LOGIN_CODE]"

if [ "$P_LOGIN_CODE" != "200" ]; then
  echo "Login partenaire échoué. Stop."
  exit 1
fi

PARTNER_TOKEN=$(echo "$P_LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "Partner bearer obtenu"
echo ""

# ─── Volet 1 — Partenaire refusé sur les 3 endpoints
echo "=== Volet 1 : partenaire refusé sur 3 endpoints contracts ==="

P1_PAYLOAD='{"partner_id":1,"contract_status":"P1_TEST"}'
P1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$P1_PAYLOAD" "$B/contracts")
echo "  P1 partenaire POST   /contracts        [HTTP $P1_CODE] (attendu 403)"

P2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"contract_status":"x"}' "$B/contracts/999999")
echo "  P2 partenaire PATCH  /contracts/999999 [HTTP $P2_CODE] (attendu 403)"

P3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/contracts/999999")
echo "  P3 partenaire DELETE /contracts/999999 [HTTP $P3_CODE] (attendu 403)"
echo ""

# ─── Volet 2 — Admin cycle complet POST → PATCH → DELETE
echo "=== Volet 2 : admin cycle complet POST → PATCH → DELETE ==="

A_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "start_date": "2026-04-30T00:00:00Z",
  "end_date": "2027-04-30T00:00:00Z",
  "auto_renewal": false,
  "max_codes": 7,
  "price": 700,
  "contract_status": "SANITY_ORIGINAL",
  "document_url": "https://test.local/sanity-contracts.pdf"
}
EOF
)

# A1 admin POST
A1_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$A_PAYLOAD" "$B/contracts")
A1_CODE=$(echo "$A1_RESP" | tail -1)
A1_BODY=$(echo "$A1_RESP" | head -1)
ROW_ID=$(echo "$A1_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  A1 admin POST   /contracts          [HTTP $A1_CODE] (attendu 200) → id=$ROW_ID"

# A2 admin PATCH (modifier price uniquement)
A2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"price":1234}' "$B/contracts/$ROW_ID")
A2_CODE=$(echo "$A2_RESP" | tail -1)
A2_BODY=$(echo "$A2_RESP" | head -1)
A2_PRICE=$(echo "$A2_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('price',''))" 2>/dev/null)
A2_STATUS=$(echo "$A2_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('contract_status',''))" 2>/dev/null)
echo "  A2 admin PATCH  /contracts/$ROW_ID    [HTTP $A2_CODE] (attendu 200) → price=$A2_PRICE (attendu 1234), contract_status='$A2_STATUS' (attendu SANITY_ORIGINAL, inchangé)"

# A3 admin DELETE
A3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contracts/$ROW_ID")
echo "  A3 admin DELETE /contracts/$ROW_ID    [HTTP $A3_CODE] (attendu 200)"

# A4 vérif disparition (DELETE 2e fois → 404)
A4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/contracts/$ROW_ID")
echo "  A4 vérif post-DELETE                  [HTTP $A4_CODE] (attendu 404 — row disparue)"
echo ""

echo "=== Fin sanity check famille contracts ==="
echo ""
echo "ACTION : me confirmer si tout est vert (P1/P2/P3 = 403, A1=200, A2=200 + price modifié + status préservé, A3=200, A4=404)."
