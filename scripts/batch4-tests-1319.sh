#!/bin/bash
# Batch 4 — Test endpoint #15 : 1319 POST /partners
# Workspace 17, group api:M9mahf09. Admin-only attendu.
#
# Le script :
#   1) teste POST sans bearer (401) et bearer partenaire (403)
#   2) crée un partner test ADMIN avec name="BATCH4_TEST_1319"
#      → garde-fou si id retourné ∈ {1, 4, 5} (rows pré-existantes)
#   3) vérifie persistance des 11 champs
#   4) mini sanity check : GET /partners admin (partner test apparaît),
#      GET /partners partenaire (Batch 2A), GET /partners/1 partenaire
#
# IMPORTANT : le partner test N'EST PAS supprimé (DELETE /partners/{id} non encore validé).
#             Il sera nettoyé manuellement après validation de 1320.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1319.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

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

# ─── Payload de test (11 champs métier remplis)
TEST_PAYLOAD=$(cat <<EOF
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

# ─── T1 : POST sans bearer → 401
echo "=== T1 POST /partners sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/partners")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : POST bearer partenaire → 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 POST /partners bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/partners")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : POST bearer admin → 200/201 + 11 champs persistés
echo "=== T3 POST /partners bearer admin (création BATCH4_TEST_1319) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$B/partners")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200/201)"
echo "Body: $T3_BODY"
echo ""

ROW_ID=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# ─── Garde-fou : refuser de continuer si ROW_ID ∈ {1, 4, 5}
if [ "$ROW_ID" = "1" ] || [ "$ROW_ID" = "4" ] || [ "$ROW_ID" = "5" ]; then
  echo "ANOMALIE : le partner test a id=$ROW_ID (row pré-existante). Stop."
  exit 1
fi

# ─── Vérification persistance des 11 champs
echo "=== Vérification persistance des 11 champs ==="
echo "$T3_BODY" | python3 -c "
import json, sys
expected = {
    'name': 'BATCH4_TEST_1319',
    'logo_url': 'https://test.local/batch4-1319.png',
    'partner_type': 'test',
    'email_contact': 'test-1319@invalid.local',
    'phone': '00 00 00 00 00',
    'crm_status': 'test',
    'contact_firstname': 'Test',
    'contact_lastname': 'Batch4',
    'contact_role': 'test',
    'xano_partner_id': 0,
}
try:
    d = json.load(sys.stdin)
    for k, v in expected.items():
        actual = d.get(k)
        ok = actual == v
        marker = 'OK' if ok else f'ANOMALIE (attendu {v!r})'
        print(f'  {k:20s} = {actual!r:60s} [{marker}]')
    notes = d.get('notes_internes', '')
    print(f'  {\"notes_internes\":20s} = {notes!r:60s} [{\"OK\" if \"BATCH 4\" in notes.upper() or \"Batch 4\" in notes else \"OK (autre)\"}]')
except Exception as e:
    print(f'JSON parse error: {e}')
"
echo ""

# ─── Mini sanity check
echo "=== Mini sanity check ==="

# S1 admin GET /partners — vérifier que le partner test apparaît
S1_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners")
S1_CODE=$(echo "$S1_RESP" | tail -1)
S1_BODY=$(echo "$S1_RESP" | head -1)
S1_FOUND=$(echo "$S1_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        ids = [r.get('id') for r in d]
        names = [r.get('name') for r in d]
        target = $ROW_ID
        print(f'rows={len(d)}, ids={ids}, includes {target}: {target in ids}')
    else:
        print(f'type={type(d).__name__}')
except Exception as e:
    print(f'parse error: {e}')
")
echo "  S1 admin GET /partners                  [HTTP $S1_CODE] (attendu 200) → $S1_FOUND"

# S2 partenaire GET /partners — comportement Batch 2A (admin-only Héka)
if [ -n "$PARTNER_TOKEN" ]; then
  S2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners")
  echo "  S2 partenaire GET /partners             [HTTP $S2_CODE] (attendu 403 — Batch 2A admin-only)"
fi

# S3 partenaire GET /partners/1 — accès au propre partner
if [ -n "$PARTNER_TOKEN" ]; then
  S3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/1")
  echo "  S3 partenaire GET /partners/1           [HTTP $S3_CODE] (attendu 200 — Batch 2A partner own)"
fi
echo ""

echo "=== Fin tests 1319 ==="
echo ""
echo ">>> Partner test créé id=$ROW_ID, name='BATCH4_TEST_1319'"
echo ">>> NB : ce partner test PERSISTE en base. Il sera supprimé après validation 1320 DELETE."
echo ">>> id=1 (Héka SAS), id=4 et id=5 doivent rester intacts."
