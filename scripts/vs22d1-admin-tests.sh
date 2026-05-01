#!/bin/bash
# Mission VS2.2.d1 — Tests CMS admin bearer sur GET 1410/1411/1412
# Couvre :
#   C.7  : GET /admin-subjects → 200, shape conservée
#   C.8  : GET /admin-sessions → 200, contient therapy-sessions id=1
#   C.9  : GET /admin-videos → 200, cuts id=1-4 sessionId=1, cuts id=5-7 sessionId=2
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/vs22d1-admin-tests.sh
# ou bash scripts/vs22d1-admin-tests.sh (prompt interactif)

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
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

# C.7 admin-subjects
echo "=== C.7 GET /admin-subjects bearer admin ==="
C7=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-subjects")
C7_CODE=$(echo "$C7" | tail -1)
C7_BODY=$(echo "$C7" | head -1)
hcheck "C.7 admin-subjects 200" "200" "$C7_CODE"
echo "$C7_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  itemsTotal = {len(d)}')
s2 = next((s for s in d if s.get('id') == 2), None)
if s2:
  keys = sorted(s2.keys())
  print(f'  subject id=2 keys = {keys}')
  print(f'  subject id=2 title = {s2.get(\"title\")} theme = {s2.get(\"theme\")} thumbnail name = {(s2.get(\"thumbnail\") or {}).get(\"name\")}')
"
echo ""

# C.8 admin-sessions
echo "=== C.8 GET /admin-sessions bearer admin ==="
C8=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions")
C8_CODE=$(echo "$C8" | tail -1)
C8_BODY=$(echo "$C8" | head -1)
hcheck "C.8 admin-sessions 200" "200" "$C8_CODE"
echo "$C8_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  itemsTotal = {len(d)}')
s1 = next((s for s in d if s.get('id') == 1), None)
if s1:
  keys = sorted(s1.keys())
  print(f'  session id=1 keys = {keys}')
  print(f'  session id=1 title = {s1.get(\"title\")} sessionSubjectId = {s1.get(\"sessionSubjectId\")} position = {s1.get(\"position\")} thumbNail name = {(s1.get(\"thumbNail\") or {}).get(\"name\")}')
else:
  print('  ANOMALIE: session id=1 absente')
"
echo ""

# C.9 admin-videos
echo "=== C.9 GET /admin-videos bearer admin ==="
C9=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos")
C9_CODE=$(echo "$C9" | tail -1)
C9_BODY=$(echo "$C9" | head -1)
hcheck "C.9 admin-videos 200" "200" "$C9_CODE"
echo "$C9_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  itemsTotal = {len(d)}')
for cid in [1,2,3,4,5,6,7]:
  c = next((v for v in d if v.get('id') == cid), None)
  if c:
    keys = sorted(c.keys())
    print(f'  cut id={cid} sessionId={c.get(\"sessionId\")} position={c.get(\"position\")} video.name={(c.get(\"video\") or {}).get(\"name\")}')
    if cid == 1:
      print(f'  cut id=1 keys = {keys}')
  else:
    print(f'  cut id={cid} ABSENT [ANOMALIE]')
"
echo ""

echo "=== Fin tests admin bearer VS2.2.d1 ==="
