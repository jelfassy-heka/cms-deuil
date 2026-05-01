#!/bin/bash
# Mission VS2.2.c — Tests CMS admin bearer sur 1418/1419/1426
# Prérequis : VS2.2.c déjà publié (les 3 endpoints durcis avec fn 552).
#
# Couvre :
#  A.7  : Bearer CMS admin → accès nominal
#  B    : 1418 create (nominal + sessionSubjectId=999999)
#  C    : 1419 update (nominal + session 999999 + sessionSubjectId 999999)
#  D    : 1426 delete sans historique (cascade) + double-delete 404
#  Test E (avec historique) : géré séparément par l'agent via MCP + commande bearer ad-hoc
#  F    : régression production (id=1 etc.) — vérifié séparément par l'agent via MCP
#
# Usage :
#   ADMIN_PASSWORD='votre_mdp' bash scripts/vs22c-admin-tests.sh
# ou
#   bash scripts/vs22c-admin-tests.sh   (prompt interactif)

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

# ────────────────── B — 1418 create ──────────────────
echo "=== B.1 1418 nominal create (sessionSubjectId=2 status=draft) ==="
B1=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"VS2.2.c TEST B1","sessionSubjectId":2,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
B1_CODE=$(echo "$B1" | tail -1)
B1_BODY=$(echo "$B1" | head -1)
hcheck "B.1 1418 nominal" "200" "$B1_CODE"
TEST_SID=$(echo "$B1_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    test session id=$TEST_SID"
echo ""

echo "=== B.3 1418 sessionSubjectId=999999 (attendu 404 'Subject not found.') ==="
B3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"VS2.2.c TEST B3 should fail","sessionSubjectId":999999,"type":"therapy","status":"draft","position":99,"description":"","author":"","aiContext":"","aiQuestion":"","color":"","colorTypo":"","avlForFree":false,"exerciseType":""}')
B3_CODE=$(echo "$B3" | tail -1)
B3_BODY=$(echo "$B3" | head -1)
hcheck "B.3 1418 subject 999999" "404" "$B3_CODE"
echo "    body: $B3_BODY"
echo ""

# ────────────────── C — 1419 update ──────────────────
echo "=== C.1 1419 update title+position+status (admin bearer, nominal) ==="
C1=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"title\":\"VS2.2.c TEST B1 v2\",\"position\":100,\"status\":\"review\"}")
C1_CODE=$(echo "$C1" | tail -1)
hcheck "C.1 1419 nominal update" "200" "$C1_CODE"
echo ""

echo "=== C.2 1419 update id=999999 (attendu 404 'Session not found.') ==="
C2=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":999999,"title":"HACK"}')
C2_CODE=$(echo "$C2" | tail -1)
C2_BODY=$(echo "$C2" | head -1)
hcheck "C.2 1419 id 999999" "404" "$C2_CODE"
echo "    body: $C2_BODY"
echo ""

echo "=== C.3 1419 update sessionSubjectId=999999 (attendu 404 'Subject not found.') ==="
C3=$(curl -s -w "\n%{http_code}" -X PATCH "$B/admin-session-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID,\"sessionSubjectId\":999999}")
C3_CODE=$(echo "$C3" | tail -1)
C3_BODY=$(echo "$C3" | head -1)
hcheck "C.3 1419 subject 999999" "404" "$C3_CODE"
echo "    body: $C3_BODY"
echo ""

# Verify TEST session unchanged after C.3 FK error (sessionSubjectId still 2)
VERIF=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next((s.get('sessionSubjectId') for s in d if s.get('id')==$TEST_SID),'?'))" 2>/dev/null)
if [ "$VERIF" = "2" ]; then
  echo "    [OK] test session sessionSubjectId préservé = 2 après échec FK"
else
  echo "    [ANOMALIE] sessionSubjectId post-échec = $VERIF (attendu 2)"
fi
echo ""

# ────────────────── D — 1426 delete sans historique ──────────────────
echo "=== D.2 Ajout 1 cut test sur session $TEST_SID (admin-cut-create) ==="
DCUT=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-cut-create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "sessionId=$TEST_SID" -F 'position=1' -F 'aiQuestion=VS2.2.c TEST D cut')
DCUT_CODE=$(echo "$DCUT" | tail -1)
hcheck "D.2 admin-cut-create" "200" "$DCUT_CODE"
echo ""

echo "=== D.3 1426 delete session test (attendu 200, cascade cuts) ==="
D3=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
D3_CODE=$(echo "$D3" | tail -1)
hcheck "D.3 1426 delete sans historique" "200" "$D3_CODE"
echo ""

echo "=== D.6 1426 re-delete même id (attendu 404 'Session not found.') ==="
D6=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_SID}")
D6_CODE=$(echo "$D6" | tail -1)
D6_BODY=$(echo "$D6" | head -1)
hcheck "D.6 1426 re-delete" "404" "$D6_CODE"
echo "    body: $D6_BODY"
echo ""

echo "=== D.5 vérifier cuts cascade : GET /admin-videos pour cuts orphelins sessionId=$TEST_SID ==="
ORPHANS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos" | python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(1 for v in d if v.get('sessionId')==$TEST_SID))" 2>/dev/null)
if [ "$ORPHANS" = "0" ]; then
  echo "    [OK] 0 cut orphelin sur sessionId=$TEST_SID après cascade"
else
  echo "    [ANOMALIE] $ORPHANS cuts orphelins persistent"
fi

echo ""

# ────────────────── E — 1426 delete avec historique ──────────────────
# Pré-requis : TEST session id=162 + ai-message id=73 sessionId=162 seedés par l'agent via MCP.
TEST_E_ID=162
echo "=== E.5 1426 delete TEST session $TEST_E_ID (avec ai-message historique) ==="
echo "=== Attendu : 403 'Session has user history.' ==="
E5=$(curl -s -w "\n%{http_code}" -X POST "$B/admin-session-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"id\":$TEST_E_ID}")
E5_CODE=$(echo "$E5" | tail -1)
E5_BODY=$(echo "$E5" | head -1)
hcheck "E.5 1426 delete avec historique" "403" "$E5_CODE"
echo "    body: $E5_BODY"
echo ""

echo "=== E.6 vérifier session $TEST_E_ID toujours présente après refus ==="
E6_CHECK=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "import json,sys;d=json.load(sys.stdin);print('PRESENT' if any(s.get('id')==$TEST_E_ID for s in d) else 'ABSENT')")
echo "    Session $TEST_E_ID : $E6_CHECK (attendu PRESENT)"
echo ""

# ────────────────── F — Régression production ──────────────────
echo "=== F.1 Régression : therapy-sessions id=1 toujours présent ==="
F1=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-sessions" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s1=next((s for s in d if s.get('id')==1),None)
if s1:
  print(f'  id=1 OK title={s1.get(\"title\")} sessionSubjectId={s1.get(\"sessionSubjectId\")} position={s1.get(\"position\")}')
else:
  print('  id=1 ABSENT [ANOMALIE]')
")
echo "$F1"
echo ""

echo "=== F.2 + F.3 Régression : session-videos id=1-7 ==="
F2=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/admin-videos" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for cid in [1,2,3,4,5,6,7]:
  c=next((v for v in d if v.get('id')==cid),None)
  if c:
    print(f'  cut id={cid} sessionId={c.get(\"sessionId\")} position={c.get(\"position\")}')
  else:
    print(f'  cut id={cid} ABSENT [ANOMALIE]')
")
echo "$F2"

echo ""
echo "=== Fin tests A-F VS2.2.c ==="
echo ">>> Cleanup ai-message id=73 + TEST session $TEST_E_ID : sera fait par l'agent via MCP."
echo ">>> Aucun row id=1-7 touché."
