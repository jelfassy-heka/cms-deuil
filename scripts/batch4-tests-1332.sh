#!/bin/bash
# Batch 4 — Test endpoint #14 : 1332 DELETE /code_request/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 attendus.
#
# Le script :
#   1) crée demande test DÉDIÉE via 1330 POST /code_request (sécurisé Batch 3A)
#      → ne touche PAS les rows pré-existantes (id=1 approved, id=2 rejected)
#   2) teste DELETE (sans bearer / partenaire / admin id inexistant) sans supprimer la row
#   3) teste DELETE admin sur la demande test → suppression effective
#   4) re-tente DELETE sur le même id → 404 (preuve disparition)
#
# La demande test est auto-supprimée par T4. Pas de cleanup MCP requis.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1332.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_PARTNER_ID="${TEST_PARTNER_ID:-1}"
FAKE_ID="${FAKE_ID:-999999}"

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

# ─── ÉTAPE A : créer demande test via POST /code_request (1330, sécurisé Batch 3A)
echo "=== A. Création demande test via POST /code_request ==="
A_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "reason": "BATCH4_TEST_1332 — sera supprimée par T4",
  "quantity": 1,
  "request_type": "codes",
  "request_status": "pending"
}
EOF
)
A_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$A_PAYLOAD" "$B/code_request")
A_CODE=$(echo "$A_RESP" | tail -1)
A_BODY=$(echo "$A_RESP" | head -1)
echo "[HTTP $A_CODE]"

if [ "$A_CODE" != "200" ] && [ "$A_CODE" != "201" ]; then
  echo "Échec création demande test. Body: $A_BODY"
  exit 1
fi

ROW_ID=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# ─── Garde-fou : refuser de continuer si ROW_ID ∈ {1,2}
if [ "$ROW_ID" = "1" ] || [ "$ROW_ID" = "2" ]; then
  echo "ANOMALIE : la demande test a id=$ROW_ID (row pré-existante). Stop."
  exit 1
fi

echo "Demande test créée — id=$ROW_ID"
echo ""

# ─── T1 : DELETE sans bearer sur ROW_ID → 401 (la row reste)
echo "=== T1 DELETE /code_request/$ROW_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/code_request/$ROW_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : DELETE bearer partenaire sur ROW_ID → 403 (la row reste)
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 DELETE /code_request/$ROW_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/code_request/$ROW_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : DELETE bearer admin id inexistant → 404
echo "=== T3 DELETE /code_request/$FAKE_ID bearer admin (id inexistant) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$FAKE_ID")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 404)"
echo "Body: $T3_BODY"
echo ""

# ─── T4 : DELETE bearer admin sur ROW_ID → 200, suppression effective
echo "=== T4 DELETE /code_request/$ROW_ID bearer admin (suppression effective) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$ROW_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
echo "[HTTP $T4_CODE] (attendu 200)"
echo "Body: $T4_BODY"
echo ""

# ─── Vérification post-T4
echo "=== Vérif post-T4 : DELETE /code_request/$ROW_ID admin doit renvoyer 404 (déjà supprimée) ==="
POST_T4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$ROW_ID")
echo "[HTTP $POST_T4_CODE] (attendu 404)"
echo ""

echo "=== Fin tests 1332 ==="
echo ""
echo ">>> Demande test id=$ROW_ID auto-supprimée par T4. Aucun cleanup MCP requis."
echo ">>> id=1 (approved) et id=2 (rejected) doivent rester intacts."
