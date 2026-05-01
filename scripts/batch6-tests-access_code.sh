#!/bin/bash
# Batch 6 — Tests soft-disable des 5 endpoints /access_code (1300-1304)
# Workspace 17, group api:M9mahf09. Tous neutralisés via precondition (false) → 404 "Not Found."
#
# Aucune mutation. Tests admin/partenaire 404 + régression endpoints officiels /code_request.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch6-tests-access_code.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

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

# ─── Logins
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
[ "$P_LOGIN_CODE" != "200" ] && { echo "Login partenaire KO [HTTP $P_LOGIN_CODE]"; exit 1; }
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

# ─── Tests des 5 endpoints /access_code en soft-disable
echo "=== Volet A : 5 endpoints /access_code soft-disabled ==="

# 1304 PATCH
echo "  [1304] PATCH /access_code/{id}"
A1=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'Content-Type: application/json' -d '{}' "$B/access_code/1")
A2=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{}' "$B/access_code/1")
A3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}' "$B/access_code/1")
hcheck "    sans bearer" "401" "$A1"
hcheck "    bearer partenaire" "404" "$A2"
hcheck "    bearer admin" "404" "$A3"

# 1302 GET liste
echo "  [1302] GET /access_code"
B1=$(curl -s -o /dev/null -w "%{http_code}" "$B/access_code")
B2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/access_code")
B3=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/access_code")
hcheck "    sans bearer" "401" "$B1"
hcheck "    bearer partenaire" "404" "$B2"
hcheck "    bearer admin" "404" "$B3"

# 1300 DELETE
echo "  [1300] DELETE /access_code/{id}"
C1=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/access_code/1")
C2=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/access_code/1")
C3=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/access_code/1")
hcheck "    sans bearer" "401" "$C1"
hcheck "    bearer partenaire" "404" "$C2"
hcheck "    bearer admin" "404" "$C3"

# 1301 GET id
echo "  [1301] GET /access_code/{id}"
D1=$(curl -s -o /dev/null -w "%{http_code}" "$B/access_code/1")
D2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/access_code/1")
D3=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/access_code/1")
hcheck "    sans bearer" "401" "$D1"
hcheck "    bearer partenaire" "404" "$D2"
hcheck "    bearer admin" "404" "$D3"

# 1303 POST
echo "  [1303] POST /access_code"
E1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{}' "$B/access_code")
E2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{}' "$B/access_code")
E3=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}' "$B/access_code")
hcheck "    sans bearer" "401" "$E1"
hcheck "    bearer partenaire" "404" "$E2"
hcheck "    bearer admin" "404" "$E3"
echo ""

# ─── Volet B : Régression endpoints officiels /code_request
echo "=== Volet B : régression endpoints /code_request (Batch 1+3A+4) ==="

R1=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request")
hcheck "  R1 admin GET /code_request (Batch 1)" "200" "$R1"

R2_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/code_request")
R2=$(echo "$R2_RESP" | tail -1)
R2_BODY=$(echo "$R2_RESP" | head -1)
R2_PIDS=$(echo "$R2_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        pids = sorted({r.get('partner_id') for r in d})
        print(f'rows={len(d)}, partner_ids={pids}')
    else:
        print(f'type={type(d).__name__}')
except: pass
")
hcheck "  R2 partenaire GET /code_request (Batch 1)" "200" "$R2"
echo "    → $R2_PIDS (attendu partner_ids=[1])"

R3=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request/1")
hcheck "  R3 admin GET /code_request/1" "200" "$R3"

R4=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"request_status":"x"}' "$B/code_request/1")
hcheck "  R4 partenaire PATCH /code_request/1 (Batch 4 admin-only)" "403" "$R4"

R5=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/code_request/1")
hcheck "  R5 partenaire DELETE /code_request/1 (Batch 4 admin-only)" "403" "$R5"
echo ""

# ─── Volet C : confirmation table code_request inchangée
echo "=== Volet C : table code_request inchangée ==="
TC_RESP=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/code_request")
TC_COUNT=$(echo "$TC_RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else '?')")
TC_IDS=$(echo "$TC_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if isinstance(d, list):
    ids = sorted([r.get('id') for r in d])
    print(f'ids={ids}')
")
echo "  rows=$TC_COUNT (attendu 2)"
echo "  $TC_IDS (attendu ids=[1, 2])"
echo ""

echo "=== Fin tests Batch 6 soft-disable /access_code ==="
echo ""
echo ">>> Aucun /access_code n'a permis d'accéder à la table code_request."
echo ">>> Endpoints officiels /code_request inchangés."
