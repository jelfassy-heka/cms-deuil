#!/bin/bash
# Mission AUDIT.2.g — Tests admin bearer sur 1426 admin-session-delete + audit cross-workspace
#
# Pré-requis :
#   - TEST history session id=169 + ai-message id=74 sessionId=169 seedés via MCP par l'agent.
#
# Couvre :
#   T3  : id=999999 → 404 "Session not found.", AUCUN audit delete
#   T4  : delete session 169 (a un ai-message lié) → 403 "Session has user history.", AUCUN audit delete
#   T5  : delete nominal sur session test 2 cuts → 200 + 1 audit cocon_session/delete (PAS d'audit individuel par cut cascadé)
#   T6  : GET /admin/audit-logs filter cocon_session/delete avec keys whitelistées
#   T7  : Scan sentinelle / aiContext raw / video.url / secrets
#   T8  : vérifier cascade effective (session absente, cuts cascadés)
#   T9  : output cleanup audit_ids
#   T10 : output verifications post-cleanup
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2g-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
ADMIN_EMAIL='jelfassy@heka-app.fr'
SENTINEL='AUDIT2G_RAW_SHOULD_NOT_APPEAR'
HISTORY_SID=169  # seedé par l'agent via MCP

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

# Setup T5 : créer TEST session principale + 2 cuts (génère 1 audit create session + 2 audits create cuts)
echo "=== Setup T5 : créer TEST session principale + 2 cuts via 1418/1422 ==="
SETUP_S=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"AUDIT2G_TEST_DELETE\",\"sessionSubjectId\":2,\"type\":\"therapy\",\"status\":\"draft\",\"position\":99,\"description\":\"DESC $SENTINEL\",\"author\":\"AUDIT2G\",\"aiContext\":\"CTX $SENTINEL\",\"aiQuestion\":\"Q $SENTINEL\",\"color\":\"\",\"colorTypo\":\"\",\"avlForFree\":false,\"exerciseType\":\"\"}")
TEST_SID=$(echo "$SETUP_S" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "  TEST session principale id=$TEST_SID"

# 2 cuts test
for P in 1 2; do
  CUT=$(curl -s -X POST "$B/admin-cut-create" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F "sessionId=$TEST_SID" -F "position=$P" -F "aiQuestion=AUDIT2G cut $P")
  CUT_ID=$(echo "$CUT" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  echo "    cut id=$CUT_ID position=$P"
done
echo ""

# T3
echo "=== T3 1426 id=999999 (attendu 404 'Session not found.', aucun audit delete) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999}')
T3_CODE=$(echo "$T3" | tail -1)
hcheck "T3 id 999999" "404" "$T3_CODE"
echo ""

# T4 — history block sur session 169
echo "=== T4 1426 delete session $HISTORY_SID (a un ai-message lié, attendu 403 'Session has user history.', aucun audit delete) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$HISTORY_SID}")
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 history block" "403" "$T4_CODE"
echo "    body: $T4_BODY"
# Vérifier session 169 toujours présente
HVERIF=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=next((x for x in d if x.get('id')==$HISTORY_SID),None)
print('PRESENT' if s else 'ABSENT')
")
echo "  session $HISTORY_SID après refus : $HVERIF (attendu PRESENT)"
echo "  Vérif audit delete sur session $HISTORY_SID :"
HAUDIT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&action_type=delete&object_id=$HISTORY_SID&per_page=5")
HAUDIT_TOTAL=$(echo "$HAUDIT" | python3 -c "import json,sys;print(json.load(sys.stdin).get('total',0))")
echo "    audits cocon_session/delete pour object_id=$HISTORY_SID : $HAUDIT_TOTAL (attendu 0)"
echo ""

# T5 — delete nominal
echo "=== T5 1426 delete TEST session principale $TEST_SID (2 cuts, aucun historique) (attendu 200) ==="
T5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
T5_CODE=$(echo "$T5" | tail -1)
hcheck "T5 delete nominal" "200" "$T5_CODE"
echo ""

# T6 — GET audit-logs filter
echo "=== T6 GET /admin/audit-logs filter cocon_session/delete object_id=$TEST_SID ==="
T6=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&action_type=delete&object_id=$TEST_SID&per_page=5")
T6_CODE=$(echo "$T6" | tail -1)
T6_BODY=$(echo "$T6" | head -1)
hcheck "T6 GET audit-logs delete" "200" "$T6_CODE"
echo "$T6_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items = {len(items)}')
if items:
  a = items[0]
  meta = a.get('metadata',{}) or {}
  print(f'  audit id={a.get(\"id\")} object_id={a.get(\"object_id\")} action={a.get(\"action_type\")}')
  print(f'    actor_email={a.get(\"actor_email\")}')
  print(f'    endpoint={a.get(\"endpoint\")} method={a.get(\"method\")}')
  print(f'    previous_values keys = {sorted(list((a.get(\"previous_values\") or {}).keys()))}')
  print(f'    new_values            = {a.get(\"new_values\")}')
  print(f'    metadata keys         = {sorted(list(meta.keys()))}')
  print(f'    metadata.cascade_deleted_cuts_count = {meta.get(\"cascade_deleted_cuts_count\")}')
  print(f'    metadata.had_user_history           = {meta.get(\"had_user_history\")}')
  print(f'    metadata.source_workspace           = {meta.get(\"source_workspace\")}')
  print(f'    metadata.source                     = {meta.get(\"source\")}')
"
echo ""

# T7 — scan sécurité
echo "=== T7 scan sentinelle + Forbidden raw values dans audits cocon_session/* object_id=$TEST_SID ==="
T7=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&object_id=$TEST_SID&per_page=10")
echo "$T7" | python3 -c "
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
        if k in ('source','source_workspace','changed_fields','cascade_deleted_cuts_count','had_user_history'): continue
        if kl in [f.lower() for f in forbidden]:
          if isinstance(v, bool): continue
          forbidden_hits.append(f'audit#{a.get(\"id\")}.{obj_name}.{k}={type(v).__name__}')
print(f'  audits analysés (create+delete) = {len(items)}')
print(f'  sentinelle \"$SENTINEL\" trouvée dans : {sentinel_hits} audit(s) (attendu 0)')
print(f'  Forbidden raw values = {(\",\".join(forbidden_hits) if forbidden_hits else \"NONE\")}')
"
echo ""

# T8 — vérifier cascade effective
echo "=== T8 vérifier session $TEST_SID absente + cuts cascadés ==="
T8S=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=next((x for x in d if x.get('id')==$TEST_SID),None)
print('ABSENTE (OK)' if s is None else 'PRESENTE (ANOMALIE)')
")
echo "  session $TEST_SID : $T8S"
T8C=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos" | python3 -c "
import json,sys
d=json.load(sys.stdin)
orphans=[c for c in d if c.get('sessionId')==$TEST_SID]
print(f'{len(orphans)} cuts orphelins sur sessionId=$TEST_SID (attendu 0)')
")
echo "  cuts test : $T8C"
echo ""

# T9 cleanup audits — output ids pour MCP côté agent
echo "=== T9 ids audit_logs cocon_session/cocon_cut session $TEST_SID + history $HISTORY_SID à cleanup côté agent ==="
ALL_S=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_session&object_id=$TEST_SID&per_page=20")
ALL_C=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/admin/audit-logs?object_type=cocon_cut&per_page=50")
echo "$ALL_S" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
ids = sorted([a.get('id') for a in items])
print(f'  AUDIT_IDS_SESSION_$TEST_SID={\",\".join(str(i) for i in ids)}')
"
echo "$ALL_C" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
test_audits = [a for a in items if (a.get('metadata',{}) or {}).get('parent_session_id') == $TEST_SID]
ids = sorted([a.get('id') for a in test_audits])
print(f'  AUDIT_IDS_CUTS_PARENT_$TEST_SID={\",\".join(str(i) for i in ids)}')
"

echo ""
echo "=== Fin tests AUDIT.2.g ==="
echo ">>> L'agent doit nettoyer via MCP : audits ci-dessus + ai-message id=74 + session history id=$HISTORY_SID."
echo ">>> Sessions production id=1-7 et cuts production id=1-7 non touchés."
