#!/bin/bash
# Mission P0-APP-USERS-BRIDGE — Tests admin bearer sur GET /cms/app-users-stats (api_id=1441)
# Pré-requis : endpoint déjà publié, fn 552 opérationnelle.
#
# Couvre :
#   T3  : bearer CMS admin → 200
#   T4  : scan récursif clés sensibles → NONE
#   T5  : total == count table users
#   T6+T7 : created_by_day / created_by_month cohérents
#   T9  : régression GET admin Cocon (1410-1412) inchangés
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/p0-app-users-bridge-tests.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:U7_dlZtP'
COCON='https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
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

# T3 — bearer CMS admin → 200
echo "=== T3 GET /cms/app-users-stats bearer admin (attendu 200) ==="
T3=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/cms/app-users-stats")
T3_CODE=$(echo "$T3" | tail -1)
T3_BODY=$(echo "$T3" | head -1)
hcheck "T3 bearer admin" "200" "$T3_CODE"
echo ""

# Affichage shape
echo "$T3_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  total = {d.get(\"total\")}')
print(f'  created_at_min = {d.get(\"created_at_min\")}')
print(f'  created_at_max = {d.get(\"created_at_max\")}')
days = d.get('created_by_day', [])
months = d.get('created_by_month', [])
print(f'  created_by_day = {len(days)} entries')
print(f'  created_by_month = {len(months)} entries')
if days:
  print(f'    first day: {days[0]}')
  print(f'    last day:  {days[-1]}')
if months:
  print(f'    first month: {months[0]}')
  print(f'    last month:  {months[-1]}')
print(f'  total cohérent (somme jours == total) : {sum(x.get(\"count\",0) for x in days) == d.get(\"total\",0)}')
print(f'  total cohérent (somme mois == total)  : {sum(x.get(\"count\",0) for x in months) == d.get(\"total\",0)}')
"
echo ""

# T4 — scan sécurité
echo "=== T4 scan récursif clés sensibles (attendu NONE) ==="
SENS=$(echo "$T3_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
forbidden = ['password','password_hash','fcmTokens','firebaseId','email','magic_link','authToken','bearer','token','api_key','secret','BREVO_API_KEY','google_oauth','facebook_oauth','photo','firstName','lastName','name','gender']
hits = []
def scan(o, path=''):
  if isinstance(o, dict):
    for k,v in o.items():
      if k.lower() in [f.lower() for f in forbidden]:
        hits.append(path + '.' + k)
      scan(v, path + '.' + k)
  elif isinstance(o, list):
    for i,v in enumerate(o):
      scan(v, path + f'[{i}]')
scan(d)
print(','.join(hits) if hits else 'NONE')
")
echo "  Clés sensibles détectées : $SENS"
[ "$SENS" = "NONE" ] && echo "  [OK] aucune clé sensible exposée" || echo "  [ANOMALIE] clés sensibles présentes"
echo ""

# T5 — total == count from /app-users (1409, encore public sans bearer)
echo "=== T5 cohérence total vs count table users via /app-users (1409) ==="
APPUSERS_COUNT=$(curl -s "$COCON/app-users" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 'ERR')" 2>/dev/null)
STATS_TOTAL=$(echo "$T3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('total',''))")
echo "  /app-users itemsTotal = $APPUSERS_COUNT"
echo "  /cms/app-users-stats total = $STATS_TOTAL"
[ "$APPUSERS_COUNT" = "$STATS_TOTAL" ] && echo "  [OK] total cohérent" || echo "  [ANOMALIE] total différent"
echo ""

# T9 — régression GET admin Cocon
echo "=== T9 régression GET admin Cocon (durcis VS2.2.d1) ==="
echo "  GET /admin-subjects (admin bearer):"
curl -s -o /dev/null -w "    HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$COCON/admin-subjects"
echo "  GET /admin-sessions (admin bearer):"
curl -s -o /dev/null -w "    HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$COCON/admin-sessions"
echo "  GET /admin-videos (admin bearer):"
curl -s -o /dev/null -w "    HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$COCON/admin-videos"
echo ""

echo "=== Fin tests P0-APP-USERS-BRIDGE ==="
echo ">>> 1409 /app-users non touché (toujours auth=false dans cette mission)."
echo ">>> Migration frontend Dashboard.jsx + Analytics.jsx vers getAppUsersStats() à planifier."
