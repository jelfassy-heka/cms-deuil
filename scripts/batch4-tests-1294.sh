#!/bin/bash
# Batch 4 — Test endpoint #10 : 1294 PATCH /contacts/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 + PATCH partiel attendus.
#
# Le script :
#   1) crée une row test DÉDIÉE via 1293 POST /contacts (role="ORIGINAL_1294")
#      → ne touche PAS la row pré-existante id=1 (Joachim Elfassy)
#   2) teste PATCH (sans bearer / partenaire / admin id existant / admin id inexistant)
#   3) vérifie que le PATCH partiel ne touche QUE le champ envoyé
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1294.sh

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

# ─── ÉTAPE A : créer row test via POST /contacts (1293 sécurisé)
echo "=== A. Création row test dédiée via POST /contacts ==="
A_PAYLOAD=$(cat <<EOF
{
  "partner_id": $TEST_PARTNER_ID,
  "first_name": "BATCH4",
  "last_name": "TEST_1294",
  "email": "test-1294@invalid.local",
  "role": "ORIGINAL_1294",
  "is_primary": false
}
EOF
)
A_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$A_PAYLOAD" "$B/contacts")
A_CODE=$(echo "$A_RESP" | tail -1)
A_BODY=$(echo "$A_RESP" | head -1)
echo "[HTTP $A_CODE]"

if [ "$A_CODE" != "200" ] && [ "$A_CODE" != "201" ]; then
  echo "Échec création row test. Body: $A_BODY"
  exit 1
fi

ROW_ID=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
ORIG_EMAIL=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('email',''))" 2>/dev/null)
ORIG_FIRST=$(echo "$A_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('first_name',''))" 2>/dev/null)
echo "Row test créée — id=$ROW_ID, role='ORIGINAL_1294', email='$ORIG_EMAIL', first_name='$ORIG_FIRST'"
echo ""

# ─── T1 : PATCH sans bearer → 401
echo "=== T1 PATCH /contacts/$ROW_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'Content-Type: application/json' -d '{"role":"T1_NOSEC"}' "$B/contacts/$ROW_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : PATCH bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 PATCH /contacts/$ROW_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"role":"T2_PARTNER"}' "$B/contacts/$ROW_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : PATCH bearer admin id existant — UN SEUL champ envoyé (role)
echo "=== T3 PATCH /contacts/$ROW_ID bearer admin (un seul champ envoyé : role) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"MODIFIED_1294"}' "$B/contacts/$ROW_ID")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200)"
echo "Body: $T3_BODY"
echo ""

# ─── Vérification PATCH partiel
echo "=== Vérification PATCH partiel (role changé, autres préservés) ==="
echo "$T3_BODY" | python3 -c "
import json, sys
orig_email = '$ORIG_EMAIL'
orig_first = '$ORIG_FIRST'
try:
    d = json.load(sys.stdin)
    role = d.get('role')
    email = d.get('email')
    first_name = d.get('first_name')
    last_name = d.get('last_name')
    pid = d.get('partner_id')
    is_primary = d.get('is_primary')
    print(f'  role après PATCH        = {role!r} (attendu MODIFIED_1294)')
    print(f'  email après PATCH       = {email!r} (attendu {orig_email!r}, inchangé)')
    print(f'  first_name après PATCH  = {first_name!r} (attendu {orig_first!r}, inchangé)')
    print(f'  last_name après PATCH   = {last_name!r} (attendu TEST_1294, inchangé)')
    print(f'  partner_id après PATCH  = {pid} (attendu 1, inchangé)')
    print(f'  is_primary après PATCH  = {is_primary} (attendu False, inchangé)')
    ok = (role == 'MODIFIED_1294' and email == orig_email and first_name == orig_first)
    print('')
    if ok:
        print('  >>> PATCH partiel OK (champs non envoyés préservés)')
    else:
        print('  >>> ANOMALIE : champs non envoyés modifiés ou role non changé')
except Exception as e:
    print(f'JSON parse error: {e}')
"
echo ""

# ─── T4 : PATCH bearer admin id inexistant → 404
echo "=== T4 PATCH /contacts/$FAKE_ID bearer admin (id inexistant) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"T4_NOTFOUND"}' "$B/contacts/$FAKE_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
echo "[HTTP $T4_CODE] (attendu 404)"
echo "Body: $T4_BODY"
echo ""

# ─── Restauration role
echo "=== Restauration role='ORIGINAL_1294' ==="
RESTORE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"ORIGINAL_1294"}' "$B/contacts/$ROW_ID")
echo "[HTTP $RESTORE_CODE]"
echo ""

echo "=== Fin tests 1294 ==="
echo ""
echo ">>> id row test à supprimer côté Claude via MCP : $ROW_ID (table 295)"
echo ">>> NB : id=1 (Joachim Elfassy) doit rester intact."
