#!/bin/bash
# Mission VS2.2.b — Tests CMS admin bearer sur 1422/1423/1424
# Prérequis : VS2.2.b déjà publié (les 3 endpoints durcis avec fn 552).
#
# Couvre :
#  T4   : Bearer CMS admin → succès nominal (1424 delete + 1423 update)
#  T5   : 1422 sessionId=999999 → 404 "Session not found."
#  T6   : 1422 session avec 4 cuts → 400 "Maximum 4 cuts per session."
#  T7   : 1423 injection {id, sessionId:999} → sessionId préservé en DB
#  T8   : 1423 update position simple → 200, position changée
#  T9   : 1424 delete cut → 200
#
# Setup auto-contenu :
#  - login admin ws17 (api:IS_IPWIL /auth/login)
#  - admin-session-create (auth=false, sans bearer) → TEST session
#  - addTableContent direct (impossible en bash) → on utilise admin-cut-create avec bearer admin
#  - cleanup via admin-session-delete (auth=false → cascade cuts)
#
# Usage :
#   ADMIN_PASSWORD='votre_mdp' bash scripts/vs22b-admin-tests.sh
# ou
#   bash scripts/vs22b-admin-tests.sh   (prompt interactif)

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

# 1. Login admin
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

# 2. Setup: créer TEST session via admin-session-create (auth=false)
SETUP=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H 'Content-Type: application/json' \
  -d '{"title":"VS2.2.b TEST script","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
CODE=$(echo "$SETUP" | tail -1)
[ "$CODE" != "200" ] && { echo "Setup TEST session KO [HTTP $CODE]"; exit 1; }
TEST_SESSION_ID=$(echo "$SETUP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
echo "  TEST session créée id=$TEST_SESSION_ID"
echo ""

# 3. T4 nominal: 1422 admin-cut-create avec bearer admin → succès cut1
echo "=== T4 1422 admin-cut-create nominal (admin bearer, sans video) ==="
T4=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SESSION_ID" -F 'position=1' -F 'aiQuestion=VS2.2.b T4 cut1')
T4_CODE=$(echo "$T4" | tail -1)
hcheck "T4 1422 nominal" "200" "$T4_CODE"
CUT1_ID=$(echo "$T4" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    cut1 id=$CUT1_ID sessionId=$TEST_SESSION_ID"
echo ""

# 4. T5 : 1422 sessionId=999999 → 404
echo "=== T5 1422 sessionId=999999 (attendu 404 'Session not found.') ==="
T5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F 'sessionId=999999' -F 'position=1' -F 'aiQuestion=should fail')
T5_CODE=$(echo "$T5" | tail -1)
T5_BODY=$(echo "$T5" | head -1)
hcheck "T5 1422 sessionId=999999" "404" "$T5_CODE"
echo "    body: $T5_BODY"
echo ""

# 5. Remplir TEST session jusqu'à 4 cuts
for P in 2 3 4; do
  curl -s -o /dev/null -X POST "$B/admin-cut-create" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F "sessionId=$TEST_SESSION_ID" -F "position=$P" -F "aiQuestion=VS2.2.b filler $P"
done
echo "  TEST session $TEST_SESSION_ID rempli à 4 cuts"
echo ""

# 6. T6 : 1422 sur session avec 4 cuts → "Maximum 4 cuts per session." (400)
echo "=== T6 1422 5e cut sur session pleine (attendu 400 'Maximum 4 cuts per session.') ==="
T6=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SESSION_ID" -F 'position=5' -F 'aiQuestion=should fail max 4')
T6_CODE=$(echo "$T6" | tail -1)
T6_BODY=$(echo "$T6" | head -1)
hcheck "T6 1422 max 4 cuts" "400" "$T6_CODE"
echo "    body: $T6_BODY"
echo ""

# 7. T7 : 1423 injection sessionId → préservé en DB
echo "=== T7 1423 injection sessionId=999 sur cut1 (attendu 200, sessionId préservé) ==="
T7=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$CUT1_ID,\"sessionId\":999}")
T7_CODE=$(echo "$T7" | tail -1)
T7_BODY=$(echo "$T7" | head -1)
hcheck "T7 1423 injection sessionId" "200" "$T7_CODE"
echo "    body: $T7_BODY"
T7_DB_SESSIONID=$(echo "$T7_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('sessionId',''))" 2>/dev/null)
if [ "$T7_DB_SESSIONID" = "$TEST_SESSION_ID" ]; then
  echo "    [OK] sessionId préservé : DB=$T7_DB_SESSIONID == TEST=$TEST_SESSION_ID (injection ignorée)"
else
  echo "    [ANOMALIE] sessionId DB=$T7_DB_SESSIONID, attendu $TEST_SESSION_ID"
fi
echo ""

# 8. T8 : 1423 update position simple
echo "=== T8 1423 update position cut1 → 99 (attendu 200, position 99) ==="
T8=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-cut-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$CUT1_ID,\"position\":99}")
T8_CODE=$(echo "$T8" | tail -1)
T8_BODY=$(echo "$T8" | head -1)
hcheck "T8 1423 position update" "200" "$T8_CODE"
T8_DB_POS=$(echo "$T8_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('position',''))" 2>/dev/null)
echo "    DB position = $T8_DB_POS (attendu 99)"
echo ""

# 9. T9 : 1424 delete cut1
echo "=== T9 1424 delete cut1 (attendu 200) ==="
T9=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-cut-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$CUT1_ID}")
hcheck "T9 1424 delete cut1" "200" "$T9"
echo ""

# 10. T10 : 1424 delete cut inexistant
echo "=== T10 1424 delete id=999999 (attendu 404 'Cut not found.') ==="
T10=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"id":999999}')
T10_CODE=$(echo "$T10" | tail -1)
T10_BODY=$(echo "$T10" | head -1)
hcheck "T10 1424 delete inexistant" "404" "$T10_CODE"
echo "    body: $T10_BODY"
echo ""

# 11. Cleanup : admin-session-delete (auth=false → cascade les cuts restants)
echo "=== Cleanup TEST session $TEST_SESSION_ID + cuts restants ==="
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/admin-session-delete" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SESSION_ID}")
hcheck "admin-session-delete cascade" "200" "$DEL"

echo ""
echo "=== Fin tests VS2.2.b ==="
echo ">>> Aucun cut id 1-7 touché. Aucun row hors TEST session $TEST_SESSION_ID modifié."
