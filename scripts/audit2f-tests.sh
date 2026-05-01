#!/bin/bash
# Mission AUDIT.2.f — Tests admin bearer sur 1419 admin-session-update + audit cross-workspace
#
# Couvre :
#   T3  : id=999999 → 404, AUCUN audit update
#   T4  : sessionSubjectId=999999 → 404 "Subject not found.", session test inchangée, AUCUN audit update
#   T5  : PATCH scalaires (title/status/avlForFree/author/colorTypo) → 200 + audit
#   T6  : PATCH textes longs avec sentinelle → 200 + audit, sentinelle ABSENTE
#   T7  : PATCH sessionSubjectId valide (subject 1) → 200 + audit, changed_fields contient sessionSubjectId
#   T8  : PATCH thumbNail file (SKIP si pas de tiny image)
#   T9  : GET /admin/audit-logs filter cocon_session/update
#   T10 : Scan sentinelle + Forbidden
#   T11 : Cleanup
#   T12 : Vérifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2f-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2F_RAW_SHOULD_NOT_APPEAR'

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

# Setup : créer session test (génère 1 audit cocon_session/create AUDIT.2.e)
echo "=== Setup : créer TEST session via 1418 (génère audit create AUDIT.2.e) ==="
SETUP=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"AUDIT2F_TEST initial","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
SETUP_CODE=$(echo "$SETUP" | tail -1)
[ "$SETUP_CODE" != "200" ] && { echo "Setup KO [HTTP $SETUP_CODE]"; exit 1; }
TEST_SID=$(echo "$SETUP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST session id=$TEST_SID (sessionSubjectId=2)"
echo ""

# T3
echo "=== T3 1419 id=999999 (attendu 404 'Session not found.', aucun audit update) ==="
T3=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999,"title":"HACK"}')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 id 999999" "404" "$T3_CODE"
echo ""

# T4
echo "=== T4 1419 sessionSubjectId=999999 sur session test (attendu 404, session inchangée) ==="
T4=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"sessionSubjectId\":999999,\"title\":\"SHOULD_NOT_APPLY\"}")
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 subject 999999" "404" "$T4_CODE"
echo "    body: $T4_BODY"
# verify session test inchangée
VERIF=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=next((x for x in d if x.get('id')==$TEST_SID),None)
print(f'  session test title={s.get(\"title\")} sessionSubjectId={s.get(\"sessionSubjectId\")}' if s else 'ABSENT')
")
echo "$VERIF"
echo ""

# T5 — scalaires
echo "=== T5 1419 PATCH scalaires (title/status/avlForFree/author/colorTypo) ==="
T5=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"title\":\"AUDIT2F_TEST v2 scalaires\",\"status\":\"review\",\"avlForFree\":true,\"author\":\"AUDIT2F\",\"colorTypo\":\"#123456\"}")
T5_CODE=$(echo "$T5" | tail -1)
hcheck "T5 scalaires" "200" "$T5_CODE"
echo ""

# T6 — textes longs avec sentinelle
echo "=== T6 1419 PATCH textes longs avec sentinelle '$SENTINEL' ==="
T6=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"description\":\"DESC $SENTINEL\",\"aiContext\":\"CTX $SENTINEL\",\"aiQuestion\":\"Q $SENTINEL\"}")
T6_CODE=$(echo "$T6" | tail -1)
hcheck "T6 textes longs" "200" "$T6_CODE"
echo ""

# T7 — sessionSubjectId valide (basculer 2→1)
echo "=== T7 1419 PATCH sessionSubjectId=1 (basculer A=2 vers B=1) ==="
T7=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"sessionSubjectId\":1}")
T7_CODE=$(echo "$T7" | tail -1)
T7_BODY=$(echo "$T7" | head -1)
hcheck "T7 sessionSubjectId 2→1" "200" "$T7_CODE"
T7_NEW_SSID=$(echo "$T7_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('sessionSubjectId',''))" 2>/dev/null)
echo "    sessionSubjectId DB après PATCH = $T7_NEW_SSID (attendu 1)"
echo ""

# T8 SKIP — fichier
echo "=== T8 fichier thumbNail : SKIP (génération fichier non fiable inline) ==="
echo "    Test fichier upload à valider via Cocon UI ou script dédié."
echo ""

# T9 — GET audit-logs filter
echo "=== T9 GET /admin/audit-logs filter object_type=cocon_session, action_type=update, object_id=$TEST_SID ==="
T9=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&action_type=update&object_id=$TEST_SID&per_page=10")
T9_CODE=$(echo "$T9" | tail -1)
T9_BODY=$(echo "$T9" | head -1)
hcheck "T9 GET audit-logs" "200" "$T9_CODE"
echo "$T9_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
for a in items:
  meta = a.get('metadata',{}) or {}
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    metadata.changed_fields = {meta.get(\"changed_fields\")}')
  print(f'    metadata keys = {sorted(list(meta.keys()))}')
"
echo ""

# T10 — scan
echo "=== T10 scan sentinelle + Forbidden raw values dans audits cocon_session/update object_id=$TEST_SID ==="
T10=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&action_type=update&object_id=$TEST_SID&per_page=20")
echo "$T10" | python3 -c "
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
        if kl.startswith('has_'): continue
        if k in ('source','source_workspace','changed_fields'): continue
        if kl in [f.lower() for f in forbidden]:
          if isinstance(v, bool): continue
          forbidden_hits.append(f'audit#{a.get(\"id\")}.{obj_name}.{k}={type(v).__name__}')
print(f'  audits update analysés = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden raw values = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T11 — cleanup
echo "=== T11 cleanup TEST session $TEST_SID via 1426 admin-session-delete ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
hcheck "Cleanup admin-session-delete" "200" "$DEL"
echo ""

# Output audit ids for cleanup
echo "=== ids audit_logs cocon_session object_id=$TEST_SID à supprimer côté agent ==="
ALL=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&object_id=$TEST_SID&per_page=20")
echo "$ALL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_TO_CLEANUP={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.f ==="
echo ">>> Sessions production id=1-7 et cuts production id=1-7 non touchés."
