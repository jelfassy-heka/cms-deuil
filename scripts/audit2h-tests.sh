#!/bin/bash
# Mission AUDIT.2.h — Tests admin bearer sur 1416 admin-subject-create + audit cross-workspace
#
# Couvre :
#   T3 : create nominal sans thumbnail avec sentinelle dans description → 200 + audit
#   T4 : GET /admin/audit-logs filter cocon_subject/create
#   T5 : scan sentinelle / description raw / thumbnail raw / secrets
#   T6 : create avec thumbnail (SKIP si fichier non fiable)
#   T7-T9 : output ids pour cleanup côté agent
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2h-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2H_RAW_SHOULD_NOT_APPEAR'

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

# T3 — create nominal avec sentinelle dans description
echo "=== T3 1416 create nominal sans thumbnail, avec sentinelle '$SENTINEL' ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"AUDIT2H_TEST subject\",\"description\":\"DESC $SENTINEL\",\"type\":\"therapy\",\"exerciseType\":\"\",\"theme\":\"AUDIT2H\",\"status\":\"draft\",\"position\":999,\"backgroundColor\":\"#FFFFFF\",\"titleColor\":\"#000000\",\"borderColor\":\"#CCCCCC\"}")
T3_CODE=$(echo "$T3" | tail -1)
T3_BODY=$(echo "$T3" | head -1)
hcheck "T3 create nominal" "200" "$T3_CODE"
TEST_SUBJ=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "    TEST subject id=$TEST_SUBJ"
echo ""

# T4 — GET audit-logs filter
echo "=== T4 GET /admin/audit-logs filter cocon_subject/create object_id=$TEST_SUBJ ==="
T4=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&action_type=create&object_id=$TEST_SUBJ&per_page=5")
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 GET audit-logs" "200" "$T4_CODE"
echo "$T4_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
if items:
  a = items[0]
  meta = a.get('metadata',{}) or {}
  new = a.get('new_values',{}) or {}
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    previous_values        = {a.get(\"previous_values\")}')
  print(f'    new_values keys        = {sorted(list(new.keys()))}')
  print(f'    new_values.has_thumbnail = {new.get(\"has_thumbnail\")}')
  print(f'    metadata keys          = {sorted(list(meta.keys()))}')
  print(f'    metadata.has_thumbnail (si présent) = {meta.get(\"has_thumbnail\",\"DROPPED\")}')
  print(f'    metadata.source_workspace = {meta.get(\"source_workspace\")} source = {meta.get(\"source\")}')
"
echo ""

# T5 — scan sécurité
echo "=== T5 scan sentinelle + description raw + thumbnail raw + secrets dans audit T3 ==="
T5=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&object_id=$TEST_SUBJ&per_page=5")
echo "$T5" | python3 -c "
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
print(f'  audits analysés = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden raw values = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T6 — SKIP fichier
echo "=== T6 create avec thumbnail réel : SKIP (génération multipart non fiable inline) ==="
echo "    Test fichier upload à valider via Cocon UI ou script dédié."
echo ""

# Output for cleanup
echo "=== ids à supprimer côté agent (MCP) ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_subject&object_id=$TEST_SUBJ&per_page=5")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
print(f'  SUBJECT_ID_TO_CLEANUP=$TEST_SUBJ')
"

echo ""
echo "=== Fin tests AUDIT.2.h ==="
echo ">>> L'agent doit nettoyer via MCP table 229 (subject) + table 313 (audits)."
echo ">>> Sessions/cuts/subjects production non touchés."
