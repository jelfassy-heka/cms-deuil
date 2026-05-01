#!/bin/bash
# Batch 4 — Sanity check FINAL (régression complète).
#
# Vérifie en E2E que :
#   - les 5 familles Batch 4 (crm_activity, contracts, contacts, code_request, partners)
#     refusent bien le partenaire sur leurs opérations admin (1 endpoint par famille)
#   - les surfaces partenaires existantes (Batch 1, 2A) fonctionnent toujours
#   - les surfaces admin existantes (Xano 6.2A, Batch 0/3A/3B) fonctionnent toujours
#   - aucune mutation persistante n'est faite (tout est read-only ou cleanup auto)
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-sanity-final.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_PARTNER_ID="${TEST_PARTNER_ID:-1}"

# ─── Saisie masquée mots de passe
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

if [ -z "${PARTNER_EMAIL:-}" ]; then
  echo "PARTNER_EMAIL requis pour ce sanity check final. Stop."
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
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
if [ "$LOGIN_CODE" != "200" ]; then echo "Login admin échoué [HTTP $LOGIN_CODE]. Stop."; exit 1; fi
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
if [ "$P_LOGIN_CODE" != "200" ]; then echo "Login partenaire échoué [HTTP $P_LOGIN_CODE]. Stop."; exit 1; fi
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── helper : check
check() {
  local label="$1" expected="$2" actual="$3"
  local mark="OK"
  [ "$actual" != "$expected" ] && mark="ANOMALIE"
  printf "  %-65s [HTTP %s] (attendu %s) [%s]\n" "$label" "$actual" "$expected" "$mark"
}

# ─── Volet A — Régression batches précédents (lecture)
echo "=== Volet A : régression batches précédents (read-only) ==="

# A1 admin /auth/me
A1=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$A/auth/me")
check "A1 admin GET /auth/me" "200" "$A1"

# A2 partenaire /me/partner_membership (Xano 6.2A)
A2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$A/me/partner_membership")
check "A2 partenaire GET /me/partner_membership (Xano 6.2A)" "200" "$A2"

# A3 admin GET /partners (Batch 2A)
A3=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners")
check "A3 admin GET /partners (Batch 2A)" "200" "$A3"

# A4 partenaire GET /partners/1 (own)
A4=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/1")
check "A4 partenaire GET /partners/1 (Batch 2A)" "200" "$A4"

# A5 partenaire GET /beneficiaries (Batch 1)
A5=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/beneficiaries")
check "A5 partenaire GET /beneficiaries (Batch 1)" "200" "$A5"

# A6 partenaire GET /partner_members (Batch 1)
A6=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partner_members")
check "A6 partenaire GET /partner_members (Batch 1)" "200" "$A6"

# A7 partenaire GET /plan-activation-code (Batch 1)
A7=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/plan-activation-code")
check "A7 partenaire GET /plan-activation-code (Batch 1)" "200" "$A7"
echo ""

# ─── Volet B — Hardening Batch 4 : partenaire refusé sur 1 endpoint par famille
echo "=== Volet B : Batch 4 — partenaire refusé sur 5 familles ==="

B1=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/crm_activity")
check "B1 partenaire GET    /crm_activity" "403" "$B1"

B2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/contracts")
check "B2 partenaire POST   /contracts" "403" "$B2"

B3=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"partner_id":1,"first_name":"x"}' "$B/contacts")
check "B3 partenaire POST   /contacts" "403" "$B3"

B4=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"request_status":"x"}' "$B/code_request/999999")
check "B4 partenaire PATCH  /code_request/999999" "403" "$B4"

B5=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/999999")
check "B5 partenaire DELETE /partners/999999" "403" "$B5"

# B6 partenaire POST /code_request (Batch 3A — autorisé)
B6_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "{\"partner_id\":1,\"reason\":\"sanity_final\",\"quantity\":1,\"request_type\":\"codes\",\"request_status\":\"pending\"}" "$B/code_request")
B6=$(echo "$B6_RESP" | tail -1)
B6_BODY=$(echo "$B6_RESP" | head -1)
B6_ID=$(echo "$B6_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
check "B6 partenaire POST   /code_request (Batch 3A autorisé)" "200" "$B6"
echo ""

# ─── Volet C — Cleanup B6 row test (via DELETE admin sécurisé Batch 4)
echo "=== Volet C : cleanup row test B6 via DELETE admin ==="
if [ -n "$B6_ID" ] && [ "$B6_ID" != "1" ] && [ "$B6_ID" != "2" ]; then
  C1=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/$B6_ID")
  check "C1 admin DELETE /code_request/$B6_ID (cleanup B6)" "200" "$C1"
else
  echo "  Cleanup B6 sauté (id non capturé ou row pré-existante)"
fi
echo ""

# ─── Volet D — Garde id=1 sur DELETE /partners (sanity)
echo "=== Volet D : garde id=1 sur DELETE /partners ==="
D1_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/1")
D1=$(echo "$D1_RESP" | tail -1)
D1_BODY=$(echo "$D1_RESP" | head -1)
check "D1 admin DELETE /partners/1 (garde id=1)" "403" "$D1"
echo "  Body: $D1_BODY"
echo ""

echo "=== Fin sanity check final Batch 4 ==="
echo ""
echo "ACTION : confirmer si tout est vert."
