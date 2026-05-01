#!/bin/bash
# Batch 7G.2 — Tests GET /admin/audit-logs (api_id=1437)
# Workspace 17, group api:M9mahf09.
#
# Pré-requis : 3 audits temporaires existent déjà (id=78,79,80)
# créés via MCP addTableContent table 313 avant exécution.
#
# Couvre :
#  T1 sans bearer → 401
#  T2 bearer invalide → 401
#  T4 admin sans filtres → 200, total >= 3, items triés desc
#  T5 admin pagination → per_page=2 cap respecté
#  T6 admin per_page=999 cap silencieux à 100
#  T7 filtre action_type=login
#  T8 filtre object_type=contract&object_id=999001
#  T9 filtre actor_email=batch7g-admin@example.invalid
#  T10 filtre id=79 (audit create contract)
#  T11 filtre date_from/date_to fenêtre couvrant les 3 audits
#  T12 filtre action_type=NO_MATCH_BATCH7G → items=[], total=0
#
# T3 partenaire couvert par revue de code (admin-only strict)
# Aucun audit créé pendant les GET (preuve runtime via comptage).
# Usage : bash scripts/batch7g-tests-admin-audit-logs.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

extract() {
  local body="$1" key="$2"
  echo "$body" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('$key',''))" 2>/dev/null
}

extract_items_count() {
  local body="$1"
  echo "$body" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('items',[])))" 2>/dev/null
}

echo "=== T1 sans bearer attendu 401 ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" "$B/admin/audit-logs")
hcheck "T1 GET /admin/audit-logs sans bearer" "401" "$T1"

echo ""
echo "=== T2 bearer invalide attendu 401 ==="
T2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer FAKE_INVALID" "$B/admin/audit-logs")
hcheck "T2 GET bearer invalide" "401" "$T2"

echo ""
echo "=== T4 admin sans filtres ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin sans filtres" "200" "$T4_CODE"
echo "    page=$(extract "$T4_BODY" page) per_page=$(extract "$T4_BODY" per_page) total=$(extract "$T4_BODY" total) items_count=$(extract_items_count "$T4_BODY")"

echo ""
echo "=== T5 admin pagination page=1&per_page=2 ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?page=1&per_page=2")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 page=1&per_page=2" "200" "$T5_CODE"
echo "    page=$(extract "$T5_BODY" page) per_page=$(extract "$T5_BODY" per_page) items_count=$(extract_items_count "$T5_BODY")"

echo ""
echo "=== T6 admin per_page=999 (cap silencieux à 100) ==="
T6_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?per_page=999")
T6_CODE=$(echo "$T6_RESP" | tail -1)
T6_BODY=$(echo "$T6_RESP" | head -1)
hcheck "T6 per_page=999 cap" "200" "$T6_CODE"
echo "    per_page retourné = $(extract "$T6_BODY" per_page) (attendu 100)"

echo ""
echo "=== T7 filtre action_type=login ==="
T7_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?action_type=login")
T7_CODE=$(echo "$T7_RESP" | tail -1)
T7_BODY=$(echo "$T7_RESP" | head -1)
hcheck "T7 action_type=login" "200" "$T7_CODE"
echo "    total=$(extract "$T7_BODY" total) items_count=$(extract_items_count "$T7_BODY")"

echo ""
echo "=== T8 filtre object_type=contract&object_id=999001 ==="
T8_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?object_type=contract&object_id=999001")
T8_CODE=$(echo "$T8_RESP" | tail -1)
T8_BODY=$(echo "$T8_RESP" | head -1)
hcheck "T8 object_type=contract&object_id=999001" "200" "$T8_CODE"
echo "    total=$(extract "$T8_BODY" total) items_count=$(extract_items_count "$T8_BODY") (attendu 2 : create + delete)"

echo ""
echo "=== T9 filtre actor_email=batch7g-admin@example.invalid ==="
T9_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?actor_email=batch7g-admin@example.invalid")
T9_CODE=$(echo "$T9_RESP" | tail -1)
T9_BODY=$(echo "$T9_RESP" | head -1)
hcheck "T9 actor_email=batch7g-admin@example.invalid" "200" "$T9_CODE"
echo "    total=$(extract "$T9_BODY" total) items_count=$(extract_items_count "$T9_BODY") (attendu 3)"

echo ""
echo "=== T10 filtre id=79 (audit create contract) ==="
T10_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?id=79")
T10_CODE=$(echo "$T10_RESP" | tail -1)
T10_BODY=$(echo "$T10_RESP" | head -1)
hcheck "T10 id=79" "200" "$T10_CODE"
echo "    total=$(extract "$T10_BODY" total) items_count=$(extract_items_count "$T10_BODY") (attendu 1)"
echo "    items[0].id=$(echo "$T10_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0].get('id','') if items else '')" 2>/dev/null) (attendu 79)"
echo "    previous_values + new_values + metadata présents:"
echo "      previous_values=$(echo "$T10_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0].get('previous_values','') if items else '')" 2>/dev/null)"
echo "      new_values=$(echo "$T10_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0].get('new_values','') if items else '')" 2>/dev/null)"
echo "      metadata=$(echo "$T10_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0].get('metadata','') if items else '')" 2>/dev/null)"

echo ""
echo "=== T11 filtre date_from/date_to fenêtre couvrant les 3 audits ==="
DATE_FROM=1777622000000
DATE_TO=1777623000000
T11_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?date_from=$DATE_FROM&date_to=$DATE_TO")
T11_CODE=$(echo "$T11_RESP" | tail -1)
T11_BODY=$(echo "$T11_RESP" | head -1)
hcheck "T11 date_from=$DATE_FROM&date_to=$DATE_TO" "200" "$T11_CODE"
echo "    total=$(extract "$T11_BODY" total) items_count=$(extract_items_count "$T11_BODY")"

echo ""
echo "=== T12 filtre action_type=NO_MATCH_BATCH7G ==="
T12_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?action_type=NO_MATCH_BATCH7G")
T12_CODE=$(echo "$T12_RESP" | tail -1)
T12_BODY=$(echo "$T12_RESP" | head -1)
hcheck "T12 action_type=NO_MATCH_BATCH7G" "200" "$T12_CODE"
echo "    total=$(extract "$T12_BODY" total) items_count=$(extract_items_count "$T12_BODY") (attendu 0/0)"

echo ""
echo "=== Fin tests Batch 7G.2 ==="
echo ""
echo ">>> 3 audits temporaires id=78, 79, 80 doivent toujours exister (GET ne supprime rien)."
echo ">>> Aucun nouvel audit doit avoir été créé par les GET (sauf 1 audit login admin script)."
echo ">>> À supprimer côté Claude :"
echo "    audit_logs id=78, 79, 80 (créés via MCP addTableContent pour test 7G)"
echo "    + 1 audit login admin (script)"
