#!/bin/bash
# Mission AUDIT.2.a — Tests CMS admin bearer sur POST /admin/audit-logs/cocon-event (api_id=1442)
# Pré-requis : endpoint déjà publié.
#
# Couvre :
#   T3  : bearer admin + payload valide cocon_session create → 200 + audit créé
#   T4  : object_type invalide → 400 inputerror, aucun audit
#   T5  : action_type invalide → 400 inputerror, aucun audit
#   T6  : tuple endpoint/method/object/action incohérent → 400 inputerror, aucun audit
#   T7  : payload contient aiContext/videoScript/url → audit créé MAIS sanitisé
#   T8  : GET /admin/audit-logs filter object_type=cocon_session → audit test visible
#   T9  : scan champs sensibles dans audit (aucun aiContext raw, etc.)
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/audit2a-tests.sh

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

# T3 — bearer admin + payload valide
echo "=== T3 bearer admin + cocon_session create valide (attendu 200 + audit_id) ==="
T3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin/audit-logs/cocon-event" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "object_type":"cocon_session",
    "object_id":99999,
    "action_type":"create",
    "action_label":"AUDIT.2.a TEST T3 created cocon session",
    "endpoint":"/admin-session-create",
    "method":"POST",
    "status":200,
    "previous_values":null,
    "new_values":{"id":99999,"title":"VS test","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"avlForFree":false,"has_thumbNail":true,"has_cover":false},
    "metadata":{"has_aiContext":true,"changed_fields":["title","status"]}
  }')
T3_CODE=$(echo "$T3" | tail -1)
T3_BODY=$(echo "$T3" | head -1)
hcheck "T3 200" "200" "$T3_CODE"
echo "    body: $T3_BODY"
T3_AUDIT_ID=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('audit_id',''))" 2>/dev/null)
echo "    audit_id créé = $T3_AUDIT_ID"
echo ""

# T4 — object_type invalide
echo "=== T4 object_type invalide (attendu 400 inputerror) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin/audit-logs/cocon-event" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"object_type":"xxx_invalid","object_id":1,"action_type":"create","action_label":"X","endpoint":"/admin-session-create","method":"POST","status":200}')
T4_CODE=$(echo "$T4" | tail -1)
T4_BODY=$(echo "$T4" | head -1)
hcheck "T4 400" "400" "$T4_CODE"
echo "    body: $T4_BODY"
echo ""

# T5 — action_type invalide
echo "=== T5 action_type invalide (attendu 400 inputerror) ==="
T5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin/audit-logs/cocon-event" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"object_type":"cocon_session","object_id":1,"action_type":"hack","action_label":"X","endpoint":"/admin-session-create","method":"POST","status":200}')
T5_CODE=$(echo "$T5" | tail -1)
T5_BODY=$(echo "$T5" | head -1)
hcheck "T5 400" "400" "$T5_CODE"
echo "    body: $T5_BODY"
echo ""

# T6 — tuple incohérent
echo "=== T6 tuple incohérent (attendu 400 inputerror) ==="
T6=$(curl -s -w "\n%{http_code}" -X POST "$B/admin/audit-logs/cocon-event" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"object_type":"cocon_cut","object_id":1,"action_type":"create","action_label":"X","endpoint":"/admin-session-create","method":"POST","status":200}')
T6_CODE=$(echo "$T6" | tail -1)
T6_BODY=$(echo "$T6" | head -1)
hcheck "T6 400" "400" "$T6_CODE"
echo "    body: $T6_BODY"
echo ""

# T7 — payload pollué (aiContext raw, videoScript raw, URL etc.) → audit créé sanitisé
echo "=== T7 payload pollué (aiContext/videoScript/URL) → audit créé MAIS sanitisé ==="
T7=$(curl -s -w "\n%{http_code}" -X POST "$B/admin/audit-logs/cocon-event" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "object_type":"cocon_cut",
    "object_id":99998,
    "action_type":"update",
    "action_label":"AUDIT.2.a TEST T7 polluted payload",
    "endpoint":"/admin-cut-update",
    "method":"PATCH",
    "status":200,
    "previous_values":{"id":99998,"sessionId":1,"position":1,"durationMin":5,"has_video":true,"aiContext":"FULL TEXT SHOULD BE STRIPPED","videoScript":"FULL SCRIPT STRIPPED","aiQuestion":"FULL QUESTION STRIPPED","video":{"url":"https://example.com/secret.mp4","path":"/vault/private","name":"secret.mp4"},"bearer":"SHOULD_NOT_LEAK","authToken":"X","secret":"Y","email":"hidden@example.com"},
    "new_values":{"id":99998,"sessionId":1,"position":2,"durationMin":5,"has_video":true,"aiContext":"NEW FULL TEXT STRIPPED","videoScript":"NEW FULL SCRIPT STRIPPED","video":{"url":"https://leak.example.com/x.mp4"}},
    "metadata":{"changed_fields":["position"],"has_video_modified":false,"sessionId_immutable":true,"BREVO_API_KEY":"LEAK","fcmTokens":["x"],"google_oauth":{"id":"x"}}
  }')
T7_CODE=$(echo "$T7" | tail -1)
T7_BODY=$(echo "$T7" | head -1)
hcheck "T7 200 (sanitisé)" "200" "$T7_CODE"
echo "    body: $T7_BODY"
T7_AUDIT_ID=$(echo "$T7_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('audit_id',''))" 2>/dev/null)
echo "    audit_id T7 = $T7_AUDIT_ID"
echo ""

# T8 — GET /admin/audit-logs filter object_type=cocon_session
echo "=== T8 GET /admin/audit-logs filter object_type=cocon_session, action_type=create ==="
T8=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?object_type=cocon_session&action_type=create&per_page=5")
T8_CODE=$(echo "$T8" | tail -1)
T8_BODY=$(echo "$T8" | head -1)
hcheck "T8 200" "200" "$T8_CODE"
echo "$T8_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
print(f'  total = {d.get(\"total\")}, items received = {len(items)}')
match = next((i for i in items if i.get('object_id') == 99999),None)
if match:
  print(f'  T3 audit visible : id={match.get(\"id\")} actor_email={match.get(\"actor_email\")} action_label={match.get(\"action_label\")}')
"
echo ""

# T9 — Scan champs sensibles dans les audits T3 + T7
echo "=== T9 scan PII / fichiers / secrets dans audit T7 (id=$T7_AUDIT_ID) ==="
if [ -n "$T7_AUDIT_ID" ] && [ "$T7_AUDIT_ID" != "" ]; then
  T9=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin/audit-logs?id=$T7_AUDIT_ID")
  echo "$T9" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items',[])
if not items:
  print('  ANOMALIE : audit T7 introuvable')
else:
  a = items[0]
  prev = a.get('previous_values',{}) or {}
  new = a.get('new_values',{}) or {}
  meta = a.get('metadata',{}) or {}
  forbidden = ['aiContext','videoScript','aiQuestion','video','url','path','bearer','authToken','secret','email','BREVO_API_KEY','fcmTokens','google_oauth','facebook_oauth','password','password_hash','token','api_key']
  hits = []
  def scan(o,path):
    if isinstance(o,dict):
      for k,v in o.items():
        if k.lower() in [f.lower() for f in forbidden] and k != 'source':
          hits.append(path+'.'+k)
        scan(v,path+'.'+k)
    elif isinstance(o,list):
      for i,v in enumerate(o): scan(v,path+f'[{i}]')
  scan(prev,'previous_values')
  scan(new,'new_values')
  scan(meta,'metadata')
  print(f'  previous_values keys autorisées = {sorted(list(prev.keys()))}')
  print(f'  new_values      keys autorisées = {sorted(list(new.keys()))}')
  print(f'  metadata        keys autorisées = {sorted(list(meta.keys()))}')
  print(f'  Forbidden hits = {(\",\".join(hits) if hits else \"NONE\")}')
  print(f'  source enrichi : source_workspace={meta.get(\"source_workspace\")} source={meta.get(\"source\")}')
"
fi
echo ""

echo "=== Fin tests AUDIT.2.a ==="
echo ">>> audit_logs créés à cleaner par l'agent via MCP : T3=$T3_AUDIT_ID, T7=$T7_AUDIT_ID"
