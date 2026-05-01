#!/bin/bash
# Mission POST-P0-QA — Tests CMS admin bearer non-régression
# Couvre :
#   B.2  : 1409 /app-users avec admin bearer → 404 constant
#   B.5  : 1441 /cms/app-users-stats admin bearer → 200 + scan PII
#   B.6  : 1439 /cms/users-overview admin bearer → 200
#   B.7  : 1440 /cms/users/{id}/details admin bearer → 200
#   B.9  : 1410/1411/1412 admin bearer → 200
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/post-p0-qa-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
BR='https://x8xu-lmx9-ghko.p7.xano.io/api:U7_dlZtP'
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

# B.2
echo "=== B.2 1409 /app-users avec admin bearer (attendu 404 constant) ==="
B2=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/app-users")
B2_CODE=$(echo "$B2" | tail -1)
B2_BODY=$(echo "$B2" | head -1)
hcheck "B.2 1409 admin bearer" "404" "$B2_CODE"
echo "    body: $B2_BODY"
echo ""

# B.5
echo "=== B.5 1441 /cms/app-users-stats admin bearer (attendu 200 + scan PII NONE) ==="
B5=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/cms/app-users-stats")
B5_CODE=$(echo "$B5" | tail -1)
B5_BODY=$(echo "$B5" | head -1)
hcheck "B.5 1441 admin bearer" "200" "$B5_CODE"
echo "$B5_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  total = {d.get(\"total\")}, days={len(d.get(\"created_by_day\",[]))}, months={len(d.get(\"created_by_month\",[]))}')
forbidden = ['password','password_hash','fcmTokens','firebaseId','email','magic_link','authToken','bearer','token','api_key','secret','BREVO_API_KEY','google_oauth','facebook_oauth','photo','firstName','lastName','name','gender']
hits = []
def scan(o, path=''):
  if isinstance(o, dict):
    for k,v in o.items():
      if k.lower() in [f.lower() for f in forbidden]:
        hits.append(path+'.'+k)
      scan(v, path+'.'+k)
  elif isinstance(o, list):
    for i,v in enumerate(o): scan(v, path+f'[{i}]')
scan(d)
print(f'  Scan PII = {(\",\".join(hits) if hits else \"NONE\")}')
"
echo ""

# B.6
echo "=== B.6 1439 /cms/users-overview admin bearer (attendu 200) ==="
B6=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/cms/users-overview?per_page=5")
B6_CODE=$(echo "$B6" | tail -1)
hcheck "B.6 1439 admin bearer" "200" "$B6_CODE"
echo "$B6" | head -1 | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  total={d.get(\"total\")} per_page={d.get(\"per_page\")} items_received={len(d.get(\"items\",[]))}')
"
echo ""

# B.7 — pick first user from B.6 if available
FIRST_USER_ID=$(echo "$B6" | head -1 | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0]['id'] if items else 0)" 2>/dev/null)
if [ -n "$FIRST_USER_ID" ] && [ "$FIRST_USER_ID" != "0" ]; then
  echo "=== B.7 1440 /cms/users/$FIRST_USER_ID/details admin bearer (attendu 200) ==="
  B7_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BR/cms/users/$FIRST_USER_ID/details")
  hcheck "B.7 1440 admin bearer" "200" "$B7_CODE"
else
  echo "=== B.7 SKIP — aucun user dans /cms/users-overview ==="
fi
echo ""

# B.9 a/b/c
echo "=== B.9 GETs admin Cocon avec bearer admin ==="
B9a=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-subjects")
hcheck "B.9a 1410 admin-subjects" "200" "$B9a"
B9b=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions")
hcheck "B.9b 1411 admin-sessions" "200" "$B9b"
B9c=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos")
hcheck "B.9c 1412 admin-videos" "200" "$B9c"
echo ""

echo "=== Fin tests admin bearer POST-P0-QA ==="
