#!/bin/bash
# Mission U2.5 — Tests endpoints cms-bridge (workspace 16, api:U7_dlZtP)
#
# Couvre :
#  T1-T4 : sans bearer / bearer invalide → 401 (déjà validés via curl)
#  T5    : admin sans filtres → 200 + page=1 per_page=25
#  T6    : per_page=999 → cap silencieux 100
#  T7    : pagination page=1&per_page=2
#  T8    : check no sensitive keys in overview
#  T9    : details user_id existant → 200 + user safe + arrays
#  T10   : details user_id inexistant → 404
#
# Le script utilise le bearer admin CMS workspace 17 (validé cross-workspace via /auth/me).
# Aucun endpoint App existant n'est appelé.
# Aucun bearer affiché en clair.
# Usage : bash scripts/u2-tests-cms-bridge.sh

set -u

A_AUTH='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B_BRIDGE='https://x8xu-lmx9-ghko.p7.xano.io/api:U7_dlZtP'

ADMIN_EMAIL='jelfassy@heka-app.fr'

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A_AUTH/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK (CMS ws17)"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
}

extract() {
  local body="$1" key="$2"
  echo "$body" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('$key',''))" 2>/dev/null
}

echo "=== T1-T4 sans bearer / bearer invalide (rappel) ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" "$B_BRIDGE/cms/users-overview")
hcheck "T1 GET /cms/users-overview sans bearer" "401" "$T1"
T2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer FAKE_INVALID" "$B_BRIDGE/cms/users-overview")
hcheck "T2 GET /cms/users-overview bearer invalide" "401" "$T2"
T3=$(curl -s -o /dev/null -w "%{http_code}" "$B_BRIDGE/cms/users/1/details")
hcheck "T3 GET /cms/users/1/details sans bearer" "401" "$T3"
T4=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer FAKE_INVALID" "$B_BRIDGE/cms/users/1/details")
hcheck "T4 GET /cms/users/1/details bearer invalide" "401" "$T4"

echo ""
echo "=== T5 admin sans filtres → 200 + page=1 per_page=25 ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B_BRIDGE/cms/users-overview")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin sans filtres" "200" "$T5_CODE"
echo "    page=$(extract "$T5_BODY" page) per_page=$(extract "$T5_BODY" per_page) total=$(extract "$T5_BODY" total)"

echo ""
echo "=== T6 per_page=999 → cap 100 ==="
T6_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B_BRIDGE/cms/users-overview?per_page=999")
T6_CODE=$(echo "$T6_RESP" | tail -1)
T6_BODY=$(echo "$T6_RESP" | head -1)
hcheck "T6 per_page=999" "200" "$T6_CODE"
echo "    per_page retourné = $(extract "$T6_BODY" per_page) (attendu 100)"

echo ""
echo "=== T7 pagination page=1&per_page=2 ==="
T7_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B_BRIDGE/cms/users-overview?page=1&per_page=2")
T7_CODE=$(echo "$T7_RESP" | tail -1)
T7_BODY=$(echo "$T7_RESP" | head -1)
hcheck "T7 page=1&per_page=2" "200" "$T7_CODE"
echo "    page=$(extract "$T7_BODY" page) per_page=$(extract "$T7_BODY" per_page)"

echo ""
echo "=== T8 sécurité — aucune clé sensible dans overview ==="
SENSITIVE=$(echo "$T5_BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
forbidden=['password','password_hash','authToken','bearer','api_key','secret','BREVO_API_KEY','token','fcmTokens','google_oauth','facebook_oauth','magic_link']
items=d.get('items',[])
hits=[]
def scan(o,path=''):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in forbidden:
                hits.append(path+'.'+k)
            scan(v,path+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o):
            scan(v,path+f'[{i}]')
scan(items)
print(','.join(hits) if hits else 'NONE')
")
echo "    Clés sensibles détectées : $SENSITIVE"
[ "$SENSITIVE" = "NONE" ] && echo "    [OK] aucune clé sensible exposée" || echo "    [ANOMALIE] clés sensibles présentes"

echo ""
echo "=== T9 details user_id existant — admin ==="
FIRST_ID=$(echo "$T5_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);items=d.get('items',[]);print(items[0]['id'] if items else 0)" 2>/dev/null)
if [ -z "$FIRST_ID" ] || [ "$FIRST_ID" = "0" ]; then
  echo "    [SKIP] aucun user à tester (table users App vide ?)"
else
  T9_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B_BRIDGE/cms/users/$FIRST_ID/details")
  T9_CODE=$(echo "$T9_RESP" | tail -1)
  T9_BODY=$(echo "$T9_RESP" | head -1)
  hcheck "T9 details user_id=$FIRST_ID" "200" "$T9_CODE"
  echo "    user.id=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('user',{}).get('id',''))" 2>/dev/null)"
  echo "    stats=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('stats',{}))" 2>/dev/null)"
  echo "    spaces=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('spaces',[])))" 2>/dev/null) posts=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('posts',[])))" 2>/dev/null) reactions=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('reactions',[])))" 2>/dev/null) alerts=$(echo "$T9_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('alerts',[])))" 2>/dev/null)"

  # Check sensitive keys
  SENS_DETAILS=$(echo "$T9_BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
forbidden=['password','password_hash','authToken','bearer','api_key','secret','BREVO_API_KEY','token','magic_link']
hits=[]
def scan(o,path=''):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in forbidden:
                hits.append(path+'.'+k)
            scan(v,path+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o):
            scan(v,path+f'[{i}]')
scan(d)
print(','.join(hits) if hits else 'NONE')
")
  echo "    Clés sensibles details : $SENS_DETAILS"
fi

echo ""
echo "=== T10 details user_id inexistant → 404 ==="
T10=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B_BRIDGE/cms/users/9999999/details")
hcheck "T10 details user_id=9999999" "404" "$T10"

echo ""
echo "=== Fin tests U2.5 ==="
echo ""
echo ">>> Aucune mutation effectuée."
echo ">>> Aucun endpoint existant n'a été appelé directement par ce script."
echo ">>> Bearer admin jamais affiché en clair."
