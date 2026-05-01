#!/bin/bash
# Mission AUDIT.2.i — Tests admin bearer sur 1417 admin-subject-update + audit cross-workspace
#
# Couvre :
#   T3  : id=999999 → 404 "Subject not found.", AUCUN audit update
#   T4  : Setup subject test via 1416 (génère 1 audit AUDIT.2.h create, à cleanup)
#   T5  : Update scalaires + description avec sentinelle → 200 + audit, sentinelle absente
#   T6  : Update thumbnail réel via tiny PNG 1x1 → 200 + audit, has_thumbnail_modified=true
#   T7  : GET /admin/audit-logs filter cocon_subject/update
#   T8  : Scan sentinelle + Forbidden raw values
#   T9-T11 : output ids pour cleanup côté agent
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2i-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2I_RAW_SHOULD_NOT_APPEAR'

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

# T3 — id inexistant
echo "=== T3 1417 id=999999 (attendu 404 'Subject not found.', aucun audit update) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999,"title":"HACK"}')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 id 999999" "404" "$T3_CODE"
echo ""

# T4 — Setup subject test via 1416
echo "=== T4 Setup : créer TEST subject via 1416 (génère audit create AUDIT.2.h) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"AUDIT2I_TEST subject initial\",\"description\":\"DESC INITIAL $SENTINEL\",\"type\":\"therapy\",\"exerciseType\":\"\",\"theme\":\"AUDIT2I_INITIAL\",\"status\":\"draft\",\"position\":998,\"backgroundColor\":\"#FFFFFF\",\"titleColor\":\"#000000\",\"borderColor\":\"#CCCCCC\"}")
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 setup subject" "200" "$T4_CODE"
TEST_SUBJ=$(echo "$T4_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "    TEST subject id=$TEST_SUBJ"
echo ""

# T5 — Update scalaires + description avec sentinelle
echo "=== T5 1417 update scalaires + description avec sentinelle '$SENTINEL' ==="
T5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SUBJ,\"title\":\"AUDIT2I_TEST subject updated\",\"description\":\"DESC $SENTINEL\",\"theme\":\"AUDIT2I_UPDATED\",\"status\":\"review\",\"backgroundColor\":\"#F4F0E8\",\"titleColor\":\"#123456\",\"borderColor\":\"#ABCDEF\"}")
T5_CODE=$(echo "$T5" | tail -1)
hcheck "T5 update scalaires + description" "200" "$T5_CODE"
echo ""

# T6 — Update thumbnail réel via tiny PNG 1x1
echo "=== T6 1417 update thumbnail réel (PNG 1x1 base64) ==="
TINY_PNG=/tmp/audit2i-tiny.png
# 1x1 transparent PNG
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa1\xa9\x99\x88\x00\x00\x00\x00IEND\xaeB`\x82' > "$TINY_PNG"
ls -la "$TINY_PNG"
T6=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "id=$TEST_SUBJ" \
  -F "title=AUDIT2I_TEST subject thumbnail" \
  -F "thumbnail=@$TINY_PNG")
T6_CODE=$(echo "$T6" | tail -1)
T6_BODY=$(echo "$T6" | head -1)
hcheck "T6 update thumbnail" "200" "$T6_CODE"
echo "    body keys (server response): $(echo "$T6_BODY" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(sorted(list(d.keys())))' 2>/dev/null)"
rm -f "$TINY_PNG"
echo ""

# T7 — GET audit-logs
echo "=== T7 GET /admin/audit-logs filter cocon_subject/update object_id=$TEST_SUBJ ==="
T7=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&action_type=update&object_id=$TEST_SUBJ&per_page=10")
T7_CODE=$(echo "$T7" | tail -1)
T7_BODY=$(echo "$T7" | head -1)
hcheck "T7 GET audit-logs update" "200" "$T7_CODE"
echo "$T7_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
for a in items:
  meta = a.get('metadata',{}) or {}
  prev = a.get('previous_values',{}) or {}
  new = a.get('new_values',{}) or {}
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    previous_values keys = {sorted(list(prev.keys()))}')
  print(f'    new_values keys      = {sorted(list(new.keys()))}')
  print(f'    metadata keys        = {sorted(list(meta.keys()))}')
  print(f'    metadata.changed_fields = {meta.get(\"changed_fields\")}')
  print(f'    metadata.has_thumbnail_modified = {meta.get(\"has_thumbnail_modified\")}')
  print(f'    new_values.has_thumbnail = {new.get(\"has_thumbnail\")}')
  print(f'    previous_values.has_thumbnail = {prev.get(\"has_thumbnail\")}')
"
echo ""

# T8 — scan sécurité
echo "=== T8 scan sentinelle + Forbidden raw values dans audits cocon_subject/* object_id=$TEST_SUBJ ==="
T8=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&object_id=$TEST_SUBJ&per_page=10")
echo "$T8" | python3 -c "
import json, sys
SENTINEL = '$SENTINEL'
d = json.load(sys.stdin)
items = d.get('items',[])
forbidden = ['description','thumbnail','thumbNail','url','path','name','meta','size','mime','bearer','authToken','secret','email','BREVO_API_KEY','fcmTokens','google_oauth','facebook_oauth','firebaseId','password','password_hash','token','api_key']
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
        if kl.startswith('has_'): continue
        if k in ('source','source_workspace','changed_fields'): continue
        if kl in [f.lower() for f in forbidden]:
          if isinstance(v, bool): continue
          forbidden_hits.append(f'audit#{a.get(\"id\")}.{obj_name}.{k}={type(v).__name__}')
print(f'  audits analysés (create+update) = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden raw values = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# Output for cleanup
echo "=== ids à supprimer côté agent (MCP) ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&object_id=$TEST_SUBJ&per_page=10")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
print(f'  SUBJECT_ID_TO_CLEANUP=$TEST_SUBJ')
"

echo ""
echo "=== Fin tests AUDIT.2.i ==="
echo ">>> L'agent doit nettoyer via MCP table 229 (subject) + table 313 (audits)."
echo ">>> Sessions/cuts/subjects production non touchés."
