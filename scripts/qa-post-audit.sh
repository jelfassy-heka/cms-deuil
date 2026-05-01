#!/bin/bash
# QA globale post-audit — Volets A (Auth), D (Workflows), E (Audit E2E)
# Workspace 17, group api:M9mahf09 + api:IS_IPWIL
#
# Couvre :
#  A. Auth : admin login OK, /auth/me admin, /me/partner_membership avec bearer
#  D. Workflows :
#     1. POST /code_request (admin, partner_id=1)
#     2. POST /plan-activation-code (admin)
#     3. verify-password mauvais MDP → 403, bon MDP → 200 (sur compte admin réel)
#     4. partner_members create + patch + delete (partner_id=4 test)
#  E. Audit E2E : audits créés via D vérifiables côté MCP
#
# ⚠ NON couvert dans ce script :
#   - change-password : skip (création compte admin temp lourde + risque pollution)
#   - send-code-email / send-email : exclus pour ne pas appeler Brevo
#   - rows production id=1 protégées (partners, code_request, contacts, beneficiaires)
#
# Toutes les données temporaires sont préfixées QA_POST_AUDIT_ pour cleanup MCP.
# Aucun bearer / mot de passe / code complet affiché en clair.
# Usage : bash scripts/qa-post-audit.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
QA_TAG="QA_POST_AUDIT_${TS}"
QA_CODE=$(openssl rand -hex 4 | tr 'a-z' 'A-Z')
QA_PM_EMAIL="qa-post-audit-pm-${TS}@invalid.local"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

# ─── Volet A — Auth ───────────────────────────────────────
echo "=== Volet A — Auth & rôles ==="
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
hcheck "A1 admin login" "200" "$LOGIN_CODE"
[ "$LOGIN_CODE" != "200" ] && { echo "Login KO, abandon"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

ME_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$A/auth/me")
hcheck "A2 GET /auth/me admin" "200" "$ME_CODE"

MEMBERSHIP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$A/me/partner_membership")
hcheck "A3 GET /me/partner_membership avec bearer (admin attendu 200 ou 403/404 selon impl)" "200" "$MEMBERSHIP_CODE"
echo "    note: admin peut ne pas avoir de membership ; 200 + items=[] ou 4xx selon endpoint"

# ─── Volet D — Workflows métier ───────────────────────────
echo ""
echo "=== Volet D — Workflows métier ==="
echo ""
echo "-- D.1 POST /code_request admin (partner_id=1) --"
CR_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'partner_id': 1,
  'contact_id': 1,
  'quantity': 7,
  'reason': '${QA_TAG}_REQUEST',
  'request_status': 'pending',
  'request_type': 'standard',
  'message': 'QA POST_AUDIT message — should NOT appear in audit'
}))")
CR_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$CR_PAYLOAD" "$B/code_request")
CR_CODE=$(echo "$CR_RESP" | tail -1)
CR_BODY=$(echo "$CR_RESP" | head -1)
hcheck "D.1 POST /code_request" "200" "$CR_CODE"
QA_CR_ID=$(echo "$CR_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    code_request QA id=$QA_CR_ID"

echo ""
echo "-- D.2 POST /plan-activation-code admin (partnerId=1) --"
PAC_PAYLOAD="{\"code\":\"$QA_CODE\",\"partnerId\":1}"
PAC_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAC_PAYLOAD" "$B/plan-activation-code")
PAC_CODE=$(echo "$PAC_RESP" | tail -1)
PAC_BODY=$(echo "$PAC_RESP" | head -1)
hcheck "D.2 POST /plan-activation-code" "200" "$PAC_CODE"
QA_PAC_ID=$(echo "$PAC_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    plan-activation-code QA id=$QA_PAC_ID, code masqué côté client"
unset QA_CODE

echo ""
echo "-- D.2-bis duplicate code (attendu 400 inputerror) --"
DUPE_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAC_PAYLOAD" "$B/plan-activation-code")
DUPE_CODE=$(echo "$DUPE_RESP" | tail -1)
hcheck "D.2-bis POST code dupliqué" "400" "$DUPE_CODE"
unset PAC_PAYLOAD

echo ""
echo "-- D.3 verify-password --"
VP_BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"password":"WRONG_PASSWORD_QA"}' "$A/verify-password")
hcheck "D.3a verify-password mauvais MDP" "403" "$VP_BAD"

VP_GOOD=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"password\":\"$ADMIN_PASSWORD\"}" "$A/verify-password")
hcheck "D.3b verify-password bon MDP (admin réel)" "200" "$VP_GOOD"

echo ""
echo "-- D.4 partner_members CRUD (partner_id=4 test) --"
PM_SETUP="{\"partner_id\":4,\"user_email\":\"$QA_PM_EMAIL\",\"role\":\"member\",\"status\":\"active\",\"invited_by\":\"admin\"}"
PM_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PM_SETUP" "$B/partner_members")
PM_CODE=$(echo "$PM_RESP" | tail -1)
PM_BODY=$(echo "$PM_RESP" | head -1)
hcheck "D.4a POST /partner_members" "200" "$PM_CODE"
QA_PM_ID=$(echo "$PM_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    partner_member QA id=$QA_PM_ID"

PM_PATCH=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"role":"admin"}' "$B/parnter_members/$QA_PM_ID")
hcheck "D.4b PATCH /parnter_members/$QA_PM_ID role member→admin" "200" "$PM_PATCH"

PM_DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partner_members/$QA_PM_ID")
hcheck "D.4c DELETE /partner_members/$QA_PM_ID" "200" "$PM_DEL"

# ─── Volet E — GET /admin/audit-logs filtres ───────────────
echo ""
echo "=== Volet E — Audit logs E2E ==="
AL_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?actor_email=$ADMIN_EMAIL&per_page=100")
AL_CODE=$(echo "$AL_RESP" | tail -1)
AL_BODY=$(echo "$AL_RESP" | head -1)
hcheck "E.1 GET /admin/audit-logs filtre actor_email admin" "200" "$AL_CODE"
TOTAL=$(echo "$AL_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('total','?'))" 2>/dev/null)
echo "    total audits actor_email=$ADMIN_EMAIL = $TOTAL"

AL_FILTER_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?action_type=create&object_type=code_request&per_page=10")
AL_FILTER_CODE=$(echo "$AL_FILTER_RESP" | tail -1)
hcheck "E.2 GET /admin/audit-logs action_type=create&object_type=code_request" "200" "$AL_FILTER_CODE"

echo ""
echo "=== Fin tests QA Post-Audit ==="
echo ""
echo ">>> Données temporaires créées (à cleanup côté Claude via MCP) :"
echo "    code_request id=$QA_CR_ID (reason=${QA_TAG}_REQUEST)"
echo "    plan-activation-code id=$QA_PAC_ID"
echo "    partner_members id=$QA_PM_ID auto-supprimé par D.4c"
echo ""
echo ">>> Audits attendus (à vérifier + cleanup MCP) :"
echo "    - 1 audit login admin (D.1 startup)"
echo "    - 1 audit verify_password (D.3b succès — D.3a 403 ne crée pas d'audit)"
echo "    - 1 audit create code_request id=$QA_CR_ID"
echo "    - 1 audit create activation_code id=$QA_PAC_ID"
echo "    - 1 audit create partner_member id=$QA_PM_ID"
echo "    - 1 audit role_change partner_member id=$QA_PM_ID"
echo "    - 1 audit delete partner_member id=$QA_PM_ID"
echo "    Soit ~7 audits + login residu éventuel"
echo ""
echo ">>> Aucun email Brevo envoyé."
echo ">>> change-password skipped (compte admin réel non utilisé pour cette opération sensible)."