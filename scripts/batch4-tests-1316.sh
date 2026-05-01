#!/bin/bash
# Batch 4 — Test endpoint #16 : 1316 PUT /partners/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 + db.edit 11 champs attendus.
#
# Le script utilise le partner test id=6 (BATCH4_TEST_1319) :
#   1) snapshot des 11 champs originaux pour restauration
#   2) teste PUT (sans bearer / partenaire / admin id=6 / admin id inexistant)
#   3) vérifie que les 11 champs envoyés sont bien persistés
#   4) RESTAURE les valeurs originales pour préparer 1320 DELETE
#   5) mini sanity check
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1316.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_PARTNER_ID="${TEST_PARTNER_ID:-6}"
FAKE_ID="${FAKE_ID:-999999}"

# ─── Garde-fou : refuser de continuer si TEST_PARTNER_ID ∈ {1, 4, 5}
if [ "$TEST_PARTNER_ID" = "1" ] || [ "$TEST_PARTNER_ID" = "4" ] || [ "$TEST_PARTNER_ID" = "5" ]; then
  echo "ANOMALIE : TEST_PARTNER_ID=$TEST_PARTNER_ID est une row pré-existante. Stop."
  exit 1
fi

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

# ─── Snapshot original du partner test id=6 (via GET admin /partners/{id} — Batch 2A)
echo "=== Snapshot original /partners/$TEST_PARTNER_ID ==="
SNAP_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$TEST_PARTNER_ID")
SNAP_CODE=$(echo "$SNAP_RESP" | tail -1)
SNAP_BODY=$(echo "$SNAP_RESP" | head -1)
echo "[HTTP $SNAP_CODE]"

if [ "$SNAP_CODE" != "200" ]; then
  echo "Snapshot impossible. Stop."
  exit 1
fi

# Capture les 11 champs originaux dans des variables
ORIG_NAME=$(echo "$SNAP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
ORIG_EMAIL=$(echo "$SNAP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('email_contact',''))" 2>/dev/null)
ORIG_PHONE=$(echo "$SNAP_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('phone',''))" 2>/dev/null)
echo "Original : name='$ORIG_NAME', email_contact='$ORIG_EMAIL', phone='$ORIG_PHONE'"
echo ""

# ─── Payload PUT modifié (11 champs) — valeurs distinctes pour vérifier persistance
PUT_PAYLOAD=$(cat <<EOF
{
  "name": "BATCH4_TEST_1316_PUT",
  "logo_url": "https://test.local/batch4-1316.png",
  "partner_type": "test_put",
  "email_contact": "test-1316@invalid.local",
  "phone": "11 11 11 11 11",
  "crm_status": "test_put",
  "notes_internes": "PUT 1316 modification test",
  "contact_firstname": "PUT",
  "contact_lastname": "Test1316",
  "contact_role": "test_put",
  "xano_partner_id": 99
}
EOF
)

# ─── T1 : PUT sans bearer → 401
echo "=== T1 PUT /partners/$TEST_PARTNER_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H 'Content-Type: application/json' -d "$PUT_PAYLOAD" "$B/partners/$TEST_PARTNER_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : PUT bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 PUT /partners/$TEST_PARTNER_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$PUT_PAYLOAD" "$B/partners/$TEST_PARTNER_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : PUT bearer admin id=6 → 200 + 11 champs persistés
echo "=== T3 PUT /partners/$TEST_PARTNER_ID bearer admin (11 champs) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PUT_PAYLOAD" "$B/partners/$TEST_PARTNER_ID")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200)"
echo "Body: $T3_BODY"
echo ""

# ─── Vérification persistance des 11 champs
echo "=== Vérification persistance des 11 champs ==="
echo "$T3_BODY" | python3 -c "
import json, sys
expected = {
    'name': 'BATCH4_TEST_1316_PUT',
    'logo_url': 'https://test.local/batch4-1316.png',
    'partner_type': 'test_put',
    'email_contact': 'test-1316@invalid.local',
    'phone': '11 11 11 11 11',
    'crm_status': 'test_put',
    'notes_internes': 'PUT 1316 modification test',
    'contact_firstname': 'PUT',
    'contact_lastname': 'Test1316',
    'contact_role': 'test_put',
    'xano_partner_id': 99,
}
try:
    d = json.load(sys.stdin)
    all_ok = True
    for k, v in expected.items():
        actual = d.get(k)
        ok = actual == v
        if not ok: all_ok = False
        marker = 'OK' if ok else f'ANOMALIE (attendu {v!r})'
        print(f'  {k:20s} = {actual!r:60s} [{marker}]')
    print('')
    print('  >>> 11/11 OK' if all_ok else '  >>> ANOMALIE persistance')
except Exception as e:
    print(f'JSON parse error: {e}')
"
echo ""

# ─── T4 : PUT bearer admin id inexistant → 404
echo "=== T4 PUT /partners/$FAKE_ID bearer admin (id inexistant) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PUT_PAYLOAD" "$B/partners/$FAKE_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
echo "[HTTP $T4_CODE] (attendu 404)"
echo "Body: $T4_BODY"
echo ""

# ─── RESTAURATION des valeurs originales pour préparer 1320 DELETE
echo "=== RESTAURATION valeurs originales /partners/$TEST_PARTNER_ID ==="
RESTORE_PAYLOAD=$(cat <<EOF
{
  "name": "BATCH4_TEST_1319",
  "logo_url": "https://test.local/batch4-1319.png",
  "partner_type": "test",
  "email_contact": "test-1319@invalid.local",
  "phone": "00 00 00 00 00",
  "crm_status": "test",
  "notes_internes": "Partner test Batch 4 — sera supprimé après validation 1320 DELETE",
  "contact_firstname": "Test",
  "contact_lastname": "Batch4",
  "contact_role": "test",
  "xano_partner_id": 0
}
EOF
)
RESTORE_RESP=$(curl -s -w "\n%{http_code}" -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$RESTORE_PAYLOAD" "$B/partners/$TEST_PARTNER_ID")
RESTORE_CODE=$(echo "$RESTORE_RESP" | tail -1)
RESTORE_BODY=$(echo "$RESTORE_RESP" | head -1)
RESTORE_NAME=$(echo "$RESTORE_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
echo "[HTTP $RESTORE_CODE] → name après restauration='$RESTORE_NAME' (attendu BATCH4_TEST_1319)"
echo ""

# ─── Mini sanity check
echo "=== Mini sanity check ==="

# S1 admin GET /partners — id=6 visible
S1_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners")
S1_CODE=$(echo "$S1_RESP" | tail -1)
S1_BODY=$(echo "$S1_RESP" | head -1)
S1_OK=$(echo "$S1_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        ids = [r.get('id') for r in d]
        target = $TEST_PARTNER_ID
        print(f'rows={len(d)}, ids={ids}, includes {target}: {target in ids}')
    else:
        print(f'type={type(d).__name__}')
except Exception as e:
    print(f'parse error: {e}')
")
echo "  S1 admin GET /partners                       [HTTP $S1_CODE] (attendu 200) → $S1_OK"

# S2 admin GET /partners/6
S2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$TEST_PARTNER_ID")
echo "  S2 admin GET /partners/$TEST_PARTNER_ID                       [HTTP $S2_CODE] (attendu 200)"

# S3 partenaire GET /partners/6 (Batch 2A — partenaire ne doit pas voir un autre partner)
if [ -n "$PARTNER_TOKEN" ]; then
  S3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/$TEST_PARTNER_ID")
  echo "  S3 partenaire GET /partners/$TEST_PARTNER_ID                  [HTTP $S3_CODE] (attendu 403 ou 404 — Batch 2A)"

  # S4 partenaire GET /partners/1 (own partner)
  S4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/1")
  echo "  S4 partenaire GET /partners/1                [HTTP $S4_CODE] (attendu 200 — own partner)"
fi
echo ""

echo "=== Fin tests 1316 ==="
echo ""
echo ">>> Partner test id=$TEST_PARTNER_ID restauré dans son état original (BATCH4_TEST_1319)."
echo ">>> Prêt pour le test 1320 DELETE."
echo ">>> id=1, id=4, id=5 doivent rester intacts."
