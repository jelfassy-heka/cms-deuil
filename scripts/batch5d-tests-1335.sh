#!/bin/bash
# Batch 5D — Tests 1335 POST /plan-activation-code
# Workspace 17, group api:M9mahf09. Admin-only + partnerId existant + unicité code.
#
# Crée 1 row temporaire (BATCH5D_TEST_NEW partnerId=1) qui sera supprimée par Claude après remontée.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch5d-tests-1335.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_CODE='BATCH5D_TEST_NEW'
EXISTING_CODE='R74987'      # déjà en base, partnerId=1

# ─── Saisie masquée
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi

[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }
[ -z "${PARTNER_EMAIL:-}" ] && { echo "PARTNER_EMAIL requis. Stop."; exit 2; }

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
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

# ─── Login partenaire
P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
[ "$P_LOGIN_CODE" != "200" ] && { echo "Login partenaire KO [HTTP $P_LOGIN_CODE]"; exit 1; }
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body_excerpt="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body_excerpt" ] && printf "    body: %s\n" "$body_excerpt"
}

# ─── A1 : sans bearer → 401
A1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"code\":\"$TEST_CODE\",\"partnerId\":1}" "$B/plan-activation-code")
hcheck "A1 sans bearer" "401" "$A1_CODE" ""

# ─── A2 : bearer invalide → 401
A2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN_XYZ" -H 'Content-Type: application/json' -d "{\"code\":\"$TEST_CODE\",\"partnerId\":1}" "$B/plan-activation-code")
hcheck "A2 bearer invalide" "401" "$A2_CODE" ""

# ─── A3 : partenaire → 403
A3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "{\"code\":\"$TEST_CODE\",\"partnerId\":1}" "$B/plan-activation-code")
A3_CODE=$(echo "$A3_RESP" | tail -1)
A3_BODY=$(echo "$A3_RESP" | head -1)
hcheck "A3 partenaire (admin-only)" "403" "$A3_CODE" "$A3_BODY"

# ─── B2 : admin + partnerId=999999 → 404
B2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"code\":\"$TEST_CODE\",\"partnerId\":999999}" "$B/plan-activation-code")
B2_CODE=$(echo "$B2_RESP" | tail -1)
B2_BODY=$(echo "$B2_RESP" | head -1)
hcheck "B2 admin + partnerId=999999 (inexistant)" "404" "$B2_CODE" "$B2_BODY"

# ─── C2 : admin + code déjà existant → 400
C2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"code\":\"$EXISTING_CODE\",\"partnerId\":1}" "$B/plan-activation-code")
C2_CODE=$(echo "$C2_RESP" | tail -1)
C2_BODY=$(echo "$C2_RESP" | head -1)
hcheck "C2 admin + code existant ($EXISTING_CODE)" "400" "$C2_CODE" "$C2_BODY"

# ─── B1+C1 : admin + partnerId=1 + code unique → 200, capture id
echo ""
echo "  B1+C1 admin + partnerId=1 + code='$TEST_CODE' (création) :"
BC_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"code\":\"$TEST_CODE\",\"partnerId\":1}" "$B/plan-activation-code")
BC_CODE=$(echo "$BC_RESP" | tail -1)
BC_BODY=$(echo "$BC_RESP" | head -1)
ROW_ID=$(echo "$BC_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
ROW_PARTNERID=$(echo "$BC_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('partnerId',''))" 2>/dev/null)
ROW_PLANID=$(echo "$BC_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('planId',''))" 2>/dev/null)
ROW_USED=$(echo "$BC_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('used',''))" 2>/dev/null)
hcheck "B1+C1 status" "200" "$BC_CODE" ""
echo "    id créé           = $ROW_ID"
echo "    partnerId         = $ROW_PARTNERID (camelCase, attendu 1)"
echo "    planId            = $ROW_PLANID (attendu 1)"
echo "    used              = $ROW_USED (attendu False)"
echo ""

# ─── D1 : régression GET /plan-activation-code admin → 200
D1_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/plan-activation-code")
D1_CODE=$(echo "$D1_RESP" | tail -1)
D1_BODY=$(echo "$D1_RESP" | head -1)
D1_COUNT=$(echo "$D1_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else '?')" 2>/dev/null)
hcheck "D1 admin GET /plan-activation-code (régression)" "200" "$D1_CODE" "rows=$D1_COUNT"

# ─── D2 : régression GET partenaire → 200 + partnerId=1
D2_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/plan-activation-code")
D2_CODE=$(echo "$D2_RESP" | tail -1)
D2_BODY=$(echo "$D2_RESP" | head -1)
D2_PIDS=$(echo "$D2_BODY" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if isinstance(d,list):
        pids=sorted({r.get('partnerId') for r in d})
        print(f'rows={len(d)}, partnerIds={pids}')
    else:
        print(f'type={type(d).__name__}')
except Exception as e:
    print(f'parse error: {e}')")
hcheck "D2 partenaire GET /plan-activation-code (Batch 1)" "200" "$D2_CODE" "$D2_PIDS"

echo ""
echo "=== Fin tests Batch 5D 1335 ==="
echo ""
echo ">>> Row test id=$ROW_ID (code=$TEST_CODE, partnerId=1) à supprimer côté Claude via MCP."
echo ">>> Aucun email envoyé."
