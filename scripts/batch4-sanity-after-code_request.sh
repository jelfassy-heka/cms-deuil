#!/bin/bash
# Batch 4 — Sanity check rapide après clôture famille code_request.
#
# Vérifie en E2E que les 3 endpoints code_request hardenés (PATCH/PUT/DELETE)
# fonctionnent ensemble + que POST /code_request (Batch 3A) reste OK :
#   - admin peut POST + PATCH + PUT + DELETE (cycle complet)
#   - partenaire peut POST (Batch 3A inchangé) mais est refusé sur PATCH/PUT/DELETE
#   - rows pré-existantes (id=1 approved, id=2 rejected) restent intactes
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-sanity-after-code_request.sh

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

# ─── Volet 1 — Partenaire : POST autorisé (Batch 3A), PATCH/PUT/DELETE refusés (Batch 4)
echo "=== Volet 1 : partenaire — POST autorisé (Batch 3A), PATCH/PUT/DELETE refusés (Batch 4) ==="

# POST partenaire — partner_id=1 → autorisé (création de sa propre demande)
P0_PAYLOAD='{"partner_id":1,"reason":"sanity_partner_post","quantity":1,"request_type":"codes","request_status":"pending"}'
P0_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$P0_PAYLOAD" "$B/code_request")
P0_CODE=$(echo "$P0_RESP" | tail -1)
P0_BODY=$(echo "$P0_RESP" | head -1)
P0_ID=$(echo "$P0_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  P0 partenaire POST   /code_request                [HTTP $P0_CODE] (attendu 200/201) → id=$P0_ID"

# PATCH partenaire sur sa propre demande → 403 (Batch 4 admin-only)
P1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"request_status":"approved"}' "$B/code_request/$P0_ID")
echo "  P1 partenaire PATCH  /code_request/$P0_ID         [HTTP $P1_CODE] (attendu 403)"

# PUT partenaire → 403
P2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"partner_id":1,"reason":"x","quantity":1,"request_status":"approved","request_type":"codes"}' "$B/code_request/$P0_ID")
echo "  P2 partenaire PUT    /code_request/$P0_ID         [HTTP $P2_CODE] (attendu 403)"

# DELETE partenaire sur sa propre demande → 403
P3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/code_request/$P0_ID")
echo "  P3 partenaire DELETE /code_request/$P0_ID         [HTTP $P3_CODE] (attendu 403)"
echo ""

# ─── Volet 2 — Admin cycle complet : PATCH → PUT → DELETE sur la demande P0
echo "=== Volet 2 : admin cycle complet PATCH → PUT → DELETE sur id=$P0_ID ==="

# Garde-fou : refuser de continuer si P0_ID ∈ {1,2}
if [ "$P0_ID" = "1" ] || [ "$P0_ID" = "2" ]; then
  echo "  ANOMALIE : la demande P0 a id=$P0_ID (row pré-existante). Stop."
  exit 1
fi

# A1 admin PATCH (modifier request_status uniquement)
A1_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"request_status":"processing"}' "$B/code_request/$P0_ID")
A1_CODE=$(echo "$A1_RESP" | tail -1)
A1_BODY=$(echo "$A1_RESP" | head -1)
A1_STATUS=$(echo "$A1_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('request_status',''))" 2>/dev/null)
A1_REASON=$(echo "$A1_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('reason',''))" 2>/dev/null)
echo "  A1 admin PATCH  /code_request/$P0_ID  [HTTP $A1_CODE] (attendu 200) → request_status='$A1_STATUS' (attendu processing), reason='$A1_REASON' (attendu sanity_partner_post, inchangé)"

# A2 admin PUT (remplace tout par un payload complet)
A2_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "contact_id": 0,
  "quantity": 3,
  "reason": "sanity_admin_put",
  "request_status": "approved",
  "request_type": "codes",
  "preferred_date": "2026-05-15T00:00:00Z",
  "preferred_date_2": "2026-05-22T00:00:00Z",
  "message": "PUT sanity",
  "processed_at": "2026-04-30T18:00:00Z"
}
EOF
)
A2_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$A2_PAYLOAD" "$B/code_request/$P0_ID")
A2_CODE=$(echo "$A2_RESP" | tail -1)
A2_BODY=$(echo "$A2_RESP" | head -1)
A2_REASON=$(echo "$A2_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('reason',''))" 2>/dev/null)
A2_QTY=$(echo "$A2_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('quantity',''))" 2>/dev/null)
echo "  A2 admin PUT    /code_request/$P0_ID  [HTTP $A2_CODE] (attendu 200) → reason='$A2_REASON' (attendu sanity_admin_put), quantity=$A2_QTY (attendu 3)"

# A3 admin DELETE
A3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$P0_ID")
echo "  A3 admin DELETE /code_request/$P0_ID  [HTTP $A3_CODE] (attendu 200)"

# A4 vérif disparition
A4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$P0_ID")
echo "  A4 vérif post-DELETE                      [HTTP $A4_CODE] (attendu 404 — row disparue)"
echo ""

echo "=== Fin sanity check famille code_request ==="
echo ""
echo "ACTION : me confirmer si tout est vert."
echo ">>> id=1 (approved) et id=2 (rejected) doivent rester intacts."
