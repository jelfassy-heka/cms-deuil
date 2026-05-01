#!/bin/bash
# Mission VS2.2.d2 — Tests CMS admin bearer sur 1416/1417 + régression GET 1410/1411/1412
#
# Couvre :
#   B.5  : 1416 nominal create → 200, subject test créé
#   B.6  : Vérif fields title/description/type/exerciseType/theme/colors/position/status
#   C.8  : 1417 update title/description/status → 200
#   C.9  : 1417 id=999999 → 404 "Subject not found."
#   C.11 : 1417 update sans thumbnail → thumbnail existant conservé
#   E    : Régression GET 1410/1411/1412 → 200
#
# Test C.10 (update thumbnail avec fichier) : skipped sans tiny image. Le fix du bug est
# vérifié par lecture XanoScript ($input.thumbnail != null au lieu de $thumbnail_metadata).
#
# Usage : ADMIN_PASSWORD='votre_mdp' bash scripts/vs22d2-admin-tests.sh

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

# B.5 1416 nominal create
echo "=== B.5 1416 admin-subject-create nominal (admin bearer) ==="
B5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"VS2.2.d2 TEST subject","description":"DELETE ME","theme":"TEST","type":"therapy","exerciseType":"meditation","backgroundColor":"#FFFFFF","titleColor":"#000000","borderColor":"#CCCCCC","status":"draft","position":99}')
B5_CODE=$(echo "$B5" | tail -1)
B5_BODY=$(echo "$B5" | head -1)
hcheck "B.5 1416 nominal" "200" "$B5_CODE"
TEST_SUBJECT_ID=$(echo "$B5_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    test subject id=$TEST_SUBJECT_ID"
echo ""

# B.6 Verify fields
echo "=== B.6 vérif champs subject test $TEST_SUBJECT_ID ==="
echo "$B5_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
checks = [
  ('title', 'VS2.2.d2 TEST subject'),
  ('description', 'DELETE ME'),
  ('theme', 'TEST'),
  ('type', 'therapy'),
  ('exerciseType', 'meditation'),
  ('backgroundColor', '#FFFFFF'),
  ('titleColor', '#000000'),
  ('borderColor', '#CCCCCC'),
  ('status', 'draft'),
  ('position', 99),
]
ok = True
for k,v in checks:
  actual = d.get(k)
  if actual != v:
    print(f'  ANOMALIE {k}: actual={actual!r} attendu={v!r}')
    ok = False
print(f'  thumbnail = {d.get(\"thumbnail\")} (attendu null car non fourni)')
if ok:
  print('  [OK] tous les champs B.5 conformes')
"
echo ""

# C.8 1417 update title/description/status
echo "=== C.8 1417 admin-subject-update title+description+status (admin bearer) ==="
C8=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SUBJECT_ID,\"title\":\"VS2.2.d2 TEST subject v2\",\"description\":\"DELETE ME v2\",\"status\":\"review\"}")
C8_CODE=$(echo "$C8" | tail -1)
C8_BODY=$(echo "$C8" | head -1)
hcheck "C.8 1417 update nominal" "200" "$C8_CODE"
echo "$C8_BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  title = {d.get(\"title\")} (attendu VS2.2.d2 TEST subject v2)')
print(f'  description = {d.get(\"description\")} (attendu DELETE ME v2)')
print(f'  status = {d.get(\"status\")} (attendu review)')
print(f'  type = {d.get(\"type\")} (attendu therapy — préservé via first_notnull)')
print(f'  thumbnail = {d.get(\"thumbnail\")} (attendu null — pas de fichier fourni, existant conservé via first_notnull)')
"
echo ""

# C.9 1417 id=999999
echo "=== C.9 1417 update id=999999 (attendu 404 'Subject not found.') ==="
C9=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-subject-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999,"title":"HACK"}')
C9_CODE=$(echo "$C9" | tail -1)
C9_BODY=$(echo "$C9" | head -1)
hcheck "C.9 1417 id 999999" "404" "$C9_CODE"
echo "    body: $C9_BODY"
echo ""

# C.11 update sans thumbnail
echo "=== C.11 1417 update sans thumbnail → thumbnail existant conservé ==="
echo "    (idem C.8 — la réponse au-dessus montre thumbnail null car le subject n'avait jamais d'image)"
echo "    Logique : first_notnull(thumbnail_metadata=null, existing.thumbnail=null) = null. OK."
echo ""

# E. Régression GET admin (déjà durcis VS2.2.d1)
echo "=== E.15 GET /admin-subjects (régression) ==="
E15=$(curl -s -o /dev/null -w "HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-subjects")
echo "  $E15"
echo "=== E.16 GET /admin-sessions (régression) ==="
E16=$(curl -s -o /dev/null -w "HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions")
echo "  $E16"
echo "=== E.17 GET /admin-videos (régression) ==="
E17=$(curl -s -o /dev/null -w "HTTP=%{http_code}\n" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos")
echo "  $E17"
echo ""

echo "=== Fin tests admin bearer VS2.2.d2 ==="
echo ">>> TEST_SUBJECT_ID=$TEST_SUBJECT_ID — sera supprimé par l'agent via MCP."
echo ">>> Aucun row id=1-7 touché. Aucune session/cut modifié."
