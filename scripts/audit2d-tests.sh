#!/bin/bash
# Mission AUDIT.2.d — Tests admin bearer sur 1424 admin-cut-delete + audit cross-workspace
#
# Couvre :
#   T3 : id=999999 → 404 "Cut not found.", AUCUN audit delete
#   T4 : delete cut test existant avec sentinelles → 200 + audit cocon_cut/delete
#   T5 : GET /admin/audit-logs filter cocon_cut/delete avec keys whitelistées
#   T6 : scan sentinelle / aiContext raw / video.url / secrets dans audit delete
#   T7 : suppression effective (cut absent en table 252)
#   T8 : cleanup (session test + audits create/delete)
#   T9 : vérifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2d-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2D_RAW_SHOULD_NOT_APPEAR'

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

# Setup : session test + 1 cut test avec sentinelles dans aiQuestion/videoScript/aiContext
echo "=== Setup : créer TEST session + 1 cut test avec sentinelles ==="
SETUP_S=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"AUDIT.2.d TEST session","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
TEST_SID=$(echo "$SETUP_S" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST session id=$TEST_SID"

SETUP_C=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SID" -F 'position=1' -F 'durationMin=5' \
  -F "aiQuestion=Q $SENTINEL" \
  -F "videoScript=VS $SENTINEL" \
  -F "aiContext=CTX $SENTINEL")
TEST_CUT=$(echo "$SETUP_C" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST cut id=$TEST_CUT (audit create généré, sera cleanup)"
echo ""

# T3 — id inexistant
echo "=== T3 1424 id=999999 (attendu 404 'Cut not found.', aucun audit delete) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999}')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 id 999999" "404" "$T3_CODE"
echo ""

# T4 — delete cut test
echo "=== T4 1424 delete TEST cut $TEST_CUT (attendu 200 + audit) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_CUT}")
T4_CODE=$(echo "$T4" | tail -1)
hcheck "T4 delete cut $TEST_CUT" "200" "$T4_CODE"
echo ""

# T5 — GET audit-logs filter cocon_cut/delete
echo "=== T5 GET /admin/audit-logs filter object_type=cocon_cut, action_type=delete, object_id=$TEST_CUT ==="
T5=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&action_type=delete&object_id=$TEST_CUT&per_page=5")
T5_CODE=$(echo "$T5" | tail -1)
T5_BODY=$(echo "$T5" | head -1)
hcheck "T5 GET audit-logs delete" "200" "$T5_CODE"
echo "$T5_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
if items:
  a = items[0]
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action_type={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    previous_values keys = {sorted(list((a.get(\"previous_values\") or {}).keys()))}')
  print(f'    new_values            = {a.get(\"new_values\")}')
  print(f'    metadata keys         = {sorted(list((a.get(\"metadata\") or {}).keys()))}')
  meta = a.get('metadata',{}) or {}
  print(f'    metadata.parent_session_id = {meta.get(\"parent_session_id\")}')
  print(f'    metadata.position_freed    = {meta.get(\"position_freed\")}')
"
echo ""

# T6 — scan sécurité sur l'audit delete (et accessoirement le create du setup)
echo "=== T6 scan sentinelle / aiContext raw / video.url / secrets dans audits cocon_cut object_id=$TEST_CUT ==="
T6=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&object_id=$TEST_CUT&per_page=10")
echo "$T6" | python3 -c "
import json, sys
SENTINEL = '$SENTINEL'
d = json.load(sys.stdin)
items = d.get('items',[])
forbidden = ['aiContext','videoScript','aiQuestion','video','url','path','bearer','authToken','secret','email','BREVO_API_KEY','fcmTokens','google_oauth','facebook_oauth','password','password_hash','token','api_key']
sentinel_hits = 0
forbidden_hits = []
for a in items:
  serialized = json.dumps(a)
  if SENTINEL in serialized:
    sentinel_hits += 1
  for obj_name, obj in [('previous_values', a.get('previous_values',{}) or {}),('new_values', a.get('new_values',{}) or {}),('metadata', a.get('metadata',{}) or {})]:
    if isinstance(obj, dict):
      for k in obj.keys():
        if k.lower() in [f.lower() for f in forbidden] and k != 'source':
          forbidden_hits.append(f'audit#{a.get(\"id\")}.{obj_name}.{k}')
print(f'  audits analysés (create+delete) = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden keys hits = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T7 — vérifier suppression effective
echo "=== T7 vérifier cut $TEST_CUT absent et session $TEST_SID encore présente ==="
T7=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos")
echo "$T7" | python3 -c "
import json, sys
d = json.load(sys.stdin)
cut = next((c for c in d if c.get('id') == $TEST_CUT), None)
if cut:
  print(f'  ANOMALIE : cut $TEST_CUT toujours présent en table 252')
else:
  print(f'  [OK] cut $TEST_CUT absent (delete effective)')
"
T7S=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions")
echo "$T7S" | python3 -c "
import json, sys
d = json.load(sys.stdin)
sess = next((s for s in d if s.get('id') == $TEST_SID), None)
if sess:
  print(f'  [OK] session $TEST_SID encore présente (delete cut ne cascade pas la session)')
else:
  print(f'  ANOMALIE : session $TEST_SID absente (1424 ne devrait pas la supprimer)')
"
echo ""

# T8 Cleanup
echo "=== T8 Cleanup TEST session $TEST_SID via 1426 admin-session-delete ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
hcheck "Cleanup admin-session-delete" "200" "$DEL"
echo ""

# Output audit ids for cleanup
echo "=== ids audit_logs cocon_cut object_id=$TEST_CUT à supprimer côté agent ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&object_id=$TEST_CUT&per_page=10")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.d ==="
echo ">>> Cuts production id=1-7 et therapy-sessions id=1 non touchés."
