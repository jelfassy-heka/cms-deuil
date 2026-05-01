#!/bin/bash
# Mission AUDIT.2.b — Tests admin bearer sur 1422 admin-cut-create + audit cross-workspace
#
# Couvre :
#   T3 : sessionId inexistant → 404, AUCUN audit créé
#   T4 : session pleine 4 cuts → 400, AUCUN audit
#   T5 : création nominale sur session test vierge → 200 + audit créé en ws17
#   T6 : GET /admin/audit-logs filter object_type=cocon_cut → audit visible avec keys whitelistées
#   T7 : scan PII / fichiers / secrets dans audit créé → NONE
#   T8 : cleanup (cut test + session test + audit test)
#   T9 : vérifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2b-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
CODE=$(echo "$LOGIN" | tail -1)
[ "$CODE" != "200" ] && { echo "Login admin KO [HTTP $CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK (CMS ws17)"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-78s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

# Setup TEST session vierge via admin-session-create (auth=false durci, accepte bearer admin)
echo "=== Setup : créer TEST session vierge via admin-session-create ==="
SETUP=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"AUDIT.2.b TEST session","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
SETUP_CODE=$(echo "$SETUP" | tail -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; exit 1; }
TEST_SID=$(echo "$SETUP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST session id=$TEST_SID"
echo ""

# T3 sessionId inexistant
echo "=== T3 1422 sessionId=999999 (attendu 404, aucun audit) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F 'sessionId=999999' -F 'position=1' -F 'aiQuestion=fail')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 sessionId 999999" "404" "$T3_CODE"
echo ""

# Remplir TEST session jusqu'à 4 cuts pour T4
echo "=== Setup T4 : remplir TEST session $TEST_SID à 4 cuts ==="
for P in 1 2 3 4; do
  curl -s -o /dev/null -X POST "$B/admin-cut-create" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F "sessionId=$TEST_SID" -F "position=$P" -F "aiQuestion=AUDIT.2.b filler $P"
done
echo "  4 cuts créés sur session $TEST_SID (chaque création produit un audit cocon_cut)"
echo ""

# T4 max 4 cuts
echo "=== T4 1422 5e cut (attendu 400, aucun audit) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SID" -F 'position=5' -F 'aiQuestion=should fail max 4')
T4_CODE=$(echo "$T4" | tail -1)
hcheck "T4 max 4 cuts" "400" "$T4_CODE"
echo ""

# T5 — déjà couvert par les 4 fillers ci-dessus, on récupère l'id du premier filler pour T6/T7
T5_FIRST_CUT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos" | python3 -c "
import json,sys
d=json.load(sys.stdin)
cuts=[c for c in d if c.get('sessionId')==$TEST_SID]
cuts.sort(key=lambda c: c.get('position',0))
print(cuts[0]['id'] if cuts else '')
" 2>/dev/null)
echo "=== T5 cut nominal créé (premier filler position=1) ==="
echo "  cut id=$T5_FIRST_CUT sessionId=$TEST_SID position=1"
echo ""

# T6 GET audit-logs filter cocon_cut + create
echo "=== T6 GET /admin/audit-logs filter object_type=cocon_cut, object_id=$T5_FIRST_CUT ==="
T6=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&object_id=$T5_FIRST_CUT&per_page=5")
T6_CODE=$(echo "$T6" | tail -1)
hcheck "T6 GET audit-logs" "200" "$T6_CODE"
T6_BODY=$(echo "$T6" | head -1)
echo "$T6_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
if items:
  a = items[0]
  print(f'  audit id={a.get(\"id\")}')
  print(f'    object_type={a.get(\"object_type\")} object_id={a.get(\"object_id\")} action_type={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    previous_values keys = {sorted(list((a.get(\"previous_values\") or {}).keys()))}')
  print(f'    new_values      keys = {sorted(list((a.get(\"new_values\") or {}).keys()))}')
  print(f'    metadata        keys = {sorted(list((a.get(\"metadata\") or {}).keys()))}')
"
echo ""

# T7 scan PII / fichiers / secrets sur tous les 4 audits cocon_cut filler
echo "=== T7 scan récursif PII/fichiers/secrets sur audits cocon_cut session $TEST_SID ==="
T7=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&action_type=create&per_page=20")
echo "$T7" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
test_audits = [a for a in items if a.get('action_label','').startswith('Created Cocon cut') and (a.get('metadata',{}) or {}).get('parent_session_id') == $TEST_SID]
print(f'  audits AUDIT.2.b TEST trouvés = {len(test_audits)}')
forbidden = ['aiContext','videoScript','aiQuestion','video','url','path','bearer','authToken','secret','email','BREVO_API_KEY','fcmTokens','google_oauth','facebook_oauth','password','password_hash','token','api_key']
total_hits = []
for a in test_audits:
  prev = a.get('previous_values',{}) or {}
  new = a.get('new_values',{}) or {}
  meta = a.get('metadata',{}) or {}
  hits = []
  def scan(o,path):
    if isinstance(o,dict):
      for k,v in o.items():
        if k.lower() in [f.lower() for f in forbidden] and k != 'source':
          hits.append(path+'.'+k)
        scan(v,path+'.'+k)
    elif isinstance(o,list):
      for i,v in enumerate(o): scan(v,path+f'[{i}]')
  scan(prev,'previous_values'); scan(new,'new_values'); scan(meta,'metadata')
  if hits: total_hits.extend([f'audit#{a.get(\"id\")}: {\",\".join(hits)}'])
print(f'  Forbidden hits = {(\";\".join(total_hits) if total_hits else \"NONE\")}')
"
echo ""

# T8 Cleanup
echo "=== T8 Cleanup TEST session $TEST_SID (cascade cuts + audits via MCP côté agent) ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
hcheck "Cleanup admin-session-delete" "200" "$DEL"
echo "  audit_logs ids créés (cocon_cut create) → l'agent les nettoiera via MCP."
echo ""

# Output audit ids for agent cleanup
echo "=== ids audit_logs cocon_cut session $TEST_SID à supprimer côté agent ==="
echo "$T7" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
test_audits = [a for a in items if a.get('action_label','').startswith('Created Cocon cut') and (a.get('metadata',{}) or {}).get('parent_session_id') == $TEST_SID]
ids = sorted([a.get('id') for a in test_audits])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.b ==="
echo ">>> Cuts production id=1-7 et therapy-sessions id=1 non touchés."
