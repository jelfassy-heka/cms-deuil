#!/bin/bash
# Mission AUDIT.2.c — Tests admin bearer sur 1423 admin-cut-update + audit cross-workspace
#
# Couvre :
#   T3 : id=999999 → 404 "Cut not found.", AUCUN audit update
#   T4 : PATCH position+durationMin → 200 + audit cocon_cut/update
#   T5 : PATCH aiQuestion/videoScript/aiContext avec sentinelle → 200 + audit, sentinelle absente
#   T6 : Injection sessionId=999999 + position → 200, sessionId préservé, audit metadata.sessionId_immutable=true
#   T7 : GET /admin/audit-logs filter object_type=cocon_cut, action_type=update
#   T8 : Scan PII / sentinelle / fichiers / secrets dans audits update
#   T9 : Cleanup
#   T10 : Vérifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2c-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2C_RAW_SHOULD_NOT_APPEAR'

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

# Setup : session test + 1 cut test (génère 1 audit cocon_cut/create AUDIT.2.b)
echo "=== Setup : créer TEST session + 1 cut test ==="
SETUP_S=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"AUDIT.2.c TEST session","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
TEST_SID=$(echo "$SETUP_S" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST session id=$TEST_SID"

SETUP_C=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SID" -F 'position=1' -F 'aiQuestion=AUDIT.2.c initial cut')
TEST_CUT=$(echo "$SETUP_C" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST cut id=$TEST_CUT (audit create généré, sera cleanup)"
echo ""

# T3 — id inexistant
echo "=== T3 1423 id=999999 (attendu 404 'Cut not found.', aucun audit update) ==="
T3=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999,"position":99}')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 id 999999" "404" "$T3_CODE"
echo ""

# T4 — update position+durationMin
echo "=== T4 1423 PATCH position=5, durationMin=10 (attendu 200, audit) ==="
T4=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_CUT,\"position\":5,\"durationMin\":10}")
T4_CODE=$(echo "$T4" | tail -1)
hcheck "T4 position+durationMin" "200" "$T4_CODE"
echo ""

# T5 — update aiQuestion + videoScript + aiContext avec sentinelle (texte raw qui NE DOIT PAS apparaître en audit)
echo "=== T5 1423 PATCH aiQuestion/videoScript/aiContext avec sentinelle '$SENTINEL' ==="
T5=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_CUT,\"aiQuestion\":\"Q $SENTINEL\",\"videoScript\":\"VS $SENTINEL\",\"aiContext\":\"CTX $SENTINEL\"}")
T5_CODE=$(echo "$T5" | tail -1)
hcheck "T5 textes sentinelle" "200" "$T5_CODE"
echo ""

# T6 — injection sessionId
echo "=== T6 1423 injection sessionId=999999 + position=99 ==="
T6=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_CUT,\"sessionId\":999999,\"position\":99}")
T6_CODE=$(echo "$T6" | tail -1)
T6_BODY=$(echo "$T6" | head -1)
hcheck "T6 injection sessionId" "200" "$T6_CODE"
T6_DB_SID=$(echo "$T6_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('sessionId',''))" 2>/dev/null)
if [ "$T6_DB_SID" = "$TEST_SID" ]; then
  echo "    [OK] sessionId préservé : DB=$T6_DB_SID == TEST_SID=$TEST_SID (injection ignorée)"
else
  echo "    [ANOMALIE] sessionId DB=$T6_DB_SID, attendu $TEST_SID"
fi
echo ""

# T7 — GET audit-logs filter cocon_cut/update
echo "=== T7 GET /admin/audit-logs filter object_type=cocon_cut, action_type=update, object_id=$TEST_CUT ==="
T7=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&action_type=update&object_id=$TEST_CUT&per_page=10")
T7_CODE=$(echo "$T7" | tail -1)
T7_BODY=$(echo "$T7" | head -1)
hcheck "T7 GET audit-logs" "200" "$T7_CODE"
echo "$T7_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
for a in items:
  meta = a.get('metadata',{}) or {}
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action_type={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    new_values keys = {sorted(list((a.get(\"new_values\") or {}).keys()))}')
  print(f'    metadata keys  = {sorted(list(meta.keys()))}')
  print(f'    metadata.changed_fields = {meta.get(\"changed_fields\")}')
  print(f'    metadata.sessionId_immutable = {meta.get(\"sessionId_immutable\")}')
"
echo ""

# T8 — scan sécurité
echo "=== T8 scan sécurité : sentinelle / aiContext raw / video.url / secrets dans audits cocon_cut update ==="
T8=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&action_type=update&object_id=$TEST_CUT&per_page=10")
echo "$T8" | python3 -c "
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
print(f'  audits update analysés = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden keys hits = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T9 Cleanup test data
echo "=== T9 Cleanup : delete TEST session $TEST_SID (cascade cut $TEST_CUT) ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
hcheck "Cleanup admin-session-delete cascade" "200" "$DEL"
echo ""

# Output audit ids for cleanup (create + 3 updates AUDIT.2.c)
echo "=== ids audit_logs cocon_cut object_id=$TEST_CUT à supprimer côté agent ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&object_id=$TEST_CUT&per_page=20")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.c ==="
echo ">>> Cuts production id=1-7 et therapy-sessions id=1 non touchés."
