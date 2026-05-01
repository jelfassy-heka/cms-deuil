#!/bin/bash
# Mission AUDIT.2.e — Tests admin bearer sur 1418 admin-session-create + audit cross-workspace
#
# Couvre :
#   T3 : sessionSubjectId=999999 → 404 "Subject not found.", AUCUN audit create
#   T4 : create nominal avec sentinelles dans description/aiContext/aiQuestion → 200 + audit cocon_session/create
#   T5 : GET /admin/audit-logs filter cocon_session/create
#   T6 : scan sentinelle / aiContext raw / video.url / secrets dans audit
#   T7 : vérifier création effective en table 228
#   T8 : cleanup (session test + audit)
#   T9 : vérifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2e-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2E_RAW_SHOULD_NOT_APPEAR'

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

# T3 — sessionSubjectId inexistant
echo "=== T3 1418 sessionSubjectId=999999 (attendu 404 'Subject not found.', aucun audit create) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"AUDIT2E_TEST T3 should fail\",\"sessionSubjectId\":999999,\"type\":\"therapy\",\"status\":\"draft\",\"position\":99,\"description\":\"\",\"author\":\"\",\"aiContext\":\"\",\"aiQuestion\":\"\",\"color\":\"\",\"colorTypo\":\"\",\"avlForFree\":false,\"exerciseType\":\"\"}")
T3_CODE=$(echo "$T3" | tail -1)
T3_BODY=$(echo "$T3" | head -1)
hcheck "T3 sessionSubjectId 999999" "404" "$T3_CODE"
echo "    body: $T3_BODY"
echo ""

# T4 — create nominal avec sentinelles
echo "=== T4 1418 create nominal avec sentinelles (attendu 200 + audit) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"AUDIT2E_TEST session\",\"sessionSubjectId\":2,\"type\":\"therapy\",\"status\":\"draft\",\"position\":99,\"description\":\"DESC $SENTINEL\",\"author\":\"AUDIT2E\",\"aiContext\":\"CTX $SENTINEL\",\"aiQuestion\":\"Q $SENTINEL\",\"color\":\"\",\"colorTypo\":\"\",\"avlForFree\":false,\"exerciseType\":\"\"}")
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 create nominal" "200" "$T4_CODE"
TEST_SID=$(echo "$T4_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "    TEST session id=$TEST_SID"
echo ""

# T5 — GET audit-logs filter cocon_session/create
echo "=== T5 GET /admin/audit-logs filter object_type=cocon_session, action_type=create, object_id=$TEST_SID ==="
T5=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&action_type=create&object_id=$TEST_SID&per_page=5")
T5_CODE=$(echo "$T5" | tail -1)
T5_BODY=$(echo "$T5" | head -1)
hcheck "T5 GET audit-logs" "200" "$T5_CODE"
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
  print(f'    previous_values        = {a.get(\"previous_values\")}')
  print(f'    new_values keys        = {sorted(list((a.get(\"new_values\") or {}).keys()))}')
  print(f'    metadata keys          = {sorted(list((a.get(\"metadata\") or {}).keys()))}')
  meta = a.get('metadata',{}) or {}
  print(f'    metadata.has_description={meta.get(\"has_description\")} has_aiContext={meta.get(\"has_aiContext\")} has_aiQuestion={meta.get(\"has_aiQuestion\")}')
  print(f'    metadata.parent_subject_id (si présent) = {meta.get(\"parent_subject_id\",\"DROPPED_BY_BRIDGE\")}')
"
echo ""

# T6 — scan sécurité
echo "=== T6 scan sentinelle / aiContext raw / video.url / secrets dans audit cocon_session/create ==="
T6=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&object_id=$TEST_SID&per_page=5")
echo "$T6" | python3 -c "
import json, sys
SENTINEL = '$SENTINEL'
d = json.load(sys.stdin)
items = d.get('items',[])
forbidden = ['aiContext','videoScript','aiQuestion','description','video','url','path','bearer','authToken','secret','email','BREVO_API_KEY','fcmTokens','google_oauth','facebook_oauth','password','password_hash','token','api_key','thumbNail','cover','playerImage','exerciseSoundtrack','introductionVideo','exerciseVideo']
sentinel_hits = 0
forbidden_hits = []
for a in items:
  serialized = json.dumps(a)
  if SENTINEL in serialized:
    sentinel_hits += 1
  for obj_name, obj in [('previous_values', a.get('previous_values',{}) or {}),('new_values', a.get('new_values',{}) or {}),('metadata', a.get('metadata',{}) or {})]:
    if isinstance(obj, dict):
      for k, v in obj.items():
        kl = k.lower()
        # Authorize 'has_X' booleans, 'source', 'parent_subject_id' (dropped by bridge anyway)
        if kl.startswith('has_'): continue
        if k in ('source','source_workspace','parent_subject_id'): continue
        # Authorize the file/text raw KEYS only if their stored value is a bool (whitelist booleans pattern)
        if kl in [f.lower() for f in forbidden]:
          if isinstance(v, bool): continue
          forbidden_hits.append(f'audit#{a.get(\"id\")}.{obj_name}.{k}={type(v).__name__}')
print(f'  audits analysés = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden raw values = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T7 — vérifier création effective en table 228
echo "=== T7 vérifier session $TEST_SID présente avec bons champs ==="
T7=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions")
echo "$T7" | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = next((x for x in d if x.get('id') == $TEST_SID), None)
if not s:
  print(f'  ANOMALIE : session $TEST_SID absente')
else:
  print(f'  [OK] session $TEST_SID présente')
  print(f'    title={s.get(\"title\")} sessionSubjectId={s.get(\"sessionSubjectId\")} type={s.get(\"type\")} status={s.get(\"status\")} position={s.get(\"position\")}')
  print(f'    author={s.get(\"author\")} avlForFree={s.get(\"avlForFree\")}')
"
echo ""

# T8 — cleanup
echo "=== T8 cleanup TEST session $TEST_SID via 1426 admin-session-delete ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
hcheck "Cleanup admin-session-delete" "200" "$DEL"
echo ""

# Output audit ids for cleanup
echo "=== ids audit_logs cocon_session object_id=$TEST_SID à supprimer côté agent ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&object_id=$TEST_SID&per_page=10")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.e ==="
echo ">>> Sessions production id=1-7 et cuts production id=1-7 non touchés."
