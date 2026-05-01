#!/bin/bash
# Batch 4 — Test endpoint #7 : 1299 PATCH /contracts/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 + PATCH partiel attendus.
#
# Le script :
#   1) crée une row test via 1298 POST /contracts (8 champs renseignés)
#   2) teste PATCH (sans bearer / partenaire / admin id existant / admin id inexistant)
#   3) vérifie que le PATCH partiel ne touche QUE le champ envoyé (autres préservés)
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1299.sh

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

# ─── ÉTAPE A : créer la row test via POST /contracts (1298 sécurisé)
echo "=== A. Création row test via POST /contracts (8 champs) ==="
A_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "start_date": "2026-04-30T00:00:00Z",
  "end_date": "2027-04-30T00:00:00Z",
  "auto_renewal": false,
  "max_codes": 10,
  "price": 1000,
  "contract_status": "ORIGINAL_1299",
  "document_url": "https://test.local/batch4-1299.pdf"
}
EOF
)
A_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$A_PAYLOAD" "$B/contracts")
A_CODE=$(echo "$A_RESP" | tail -1)
A_BODY=$(echo "$A_RESP" | head -1)
echo "[HTTP $A_CODE]"

if [ "$A_CODE" != "200" ] && [ "$A_CODE" != "201" ]; then
  echo "Échec création row test. Body: $A_BODY"
  exit 1
fi

ROW_ID=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
ORIG_PRICE=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('price',''))" 2>/dev/null)
ORIG_MAX_CODES=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('max_codes',''))" 2>/dev/null)
echo "Row test créée — id=$ROW_ID, contract_status='ORIGINAL_1299', price=$ORIG_PRICE, max_codes=$ORIG_MAX_CODES"
echo ""

# ─── T1 : PATCH sans bearer → 401
echo "=== T1 PATCH /contracts/$ROW_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'Content-Type: application/json' -d '{"contract_status":"T1_NOSEC"}' "$B/contracts/$ROW_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : PATCH bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 PATCH /contracts/$ROW_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"contract_status":"T2_PARTNER"}' "$B/contracts/$ROW_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : PATCH bearer admin id existant — UN SEUL champ envoyé (contract_status)
echo "=== T3 PATCH /contracts/$ROW_ID bearer admin (un seul champ envoyé : contract_status) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"contract_status":"MODIFIED_1299"}' "$B/contracts/$ROW_ID")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200)"
echo "Body: $T3_BODY"
echo ""

# ─── Vérification PATCH partiel : contract_status modifié, autres champs préservés
echo "=== Vérification PATCH partiel (contract_status changé, autres préservés) ==="
echo "$T3_BODY" | python3 -c "
import json, sys, os
orig_price = $ORIG_PRICE if '$ORIG_PRICE'.isdigit() else None
orig_max_codes = $ORIG_MAX_CODES if '$ORIG_MAX_CODES'.isdigit() else None
try:
    d = json.load(sys.stdin)
    cs = d.get('contract_status')
    pr = d.get('price')
    mc = d.get('max_codes')
    pid = d.get('partner_id')
    sd = d.get('start_date')
    ar = d.get('auto_renewal')
    du = d.get('document_url')
    print(f'  contract_status après PATCH = {repr(cs)} (attendu MODIFIED_1299)')
    print(f'  price après PATCH           = {pr} (attendu {orig_price}, inchangé)')
    print(f'  max_codes après PATCH       = {mc} (attendu {orig_max_codes}, inchangé)')
    print(f'  partner_id après PATCH      = {pid} (attendu 1, inchangé)')
    print(f'  start_date après PATCH      = {sd} (attendu inchangé)')
    print(f'  auto_renewal après PATCH    = {ar} (attendu False, inchangé)')
    print(f'  document_url après PATCH    = {du!r} (attendu inchangé)')
    ok = (cs == 'MODIFIED_1299' and pr == orig_price and mc == orig_max_codes)
    print('')
    if ok:
        print('  >>> PATCH partiel OK (champs non envoyés préservés)')
    else:
        print('  >>> ANOMALIE : champs non envoyés modifiés ou contract_status non changé')
except Exception as e:
    print(f'JSON parse error: {e}')
"
echo ""

# ─── T4 : PATCH bearer admin id inexistant → 404
echo "=== T4 PATCH /contracts/$FAKE_ID bearer admin (id inexistant) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"contract_status":"T4_NOTFOUND"}' "$B/contracts/$FAKE_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
echo "[HTTP $T4_CODE] (attendu 404)"
echo "Body: $T4_BODY"
echo ""

# ─── Restauration contract_status (la row sera de toute façon supprimée par Claude)
echo "=== Restauration contract_status='ORIGINAL_1299' ==="
RESTORE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"contract_status":"ORIGINAL_1299"}' "$B/contracts/$ROW_ID")
echo "[HTTP $RESTORE_CODE]"
echo ""

echo "=== Fin tests 1299 ==="
echo ""
echo ">>> id row test à supprimer côté Claude via MCP : $ROW_ID (table 296)"
