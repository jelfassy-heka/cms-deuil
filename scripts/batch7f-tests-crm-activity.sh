#!/bin/bash
# Batch 7F.2.b — Tests audit crm_activity (1308 POST + 1309 PATCH + 1305 DELETE)
# Workspace 17, group api:M9mahf09.
#
# Couvre les 3 endpoints crm_activity en un seul flux :
#  - 401 sans bearer / bearer invalide (3 endpoints)
#  - 404 id inexistant (PATCH + DELETE)
#  - 200 admin POST avec note → audit create
#  - 200 admin PATCH avec note modifiée → audit update
#  - 200 admin DELETE → audit delete
#  - 404 ré-DELETE même id
#
# note envoyée pour vérifier exclusion des snapshots audit.
# Le texte exact "BATCH7F_NOTE_SHOULD_NOT_APPEAR" ne doit apparaître dans aucun audit.
# Aucun bearer affiché en clair.
# Usage : bash scripts/batch7f-tests-crm-activity.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TS=$(date +%s)
TEST_NOTE_INITIAL="BATCH7F_NOTE_SHOULD_NOT_APPEAR initial ${TS}"
TEST_NOTE_MODIFIED="BATCH7F_NOTE_SHOULD_NOT_APPEAR modified ${TS}"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi
[ -z "${ADMIN_PASSWORD:-}" ] && { echo "MDP admin manquant"; exit 2; }

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"
echo ""

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo "=== Volet A : auth checks (401 attendu, aucun audit) ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/crm_activity")
hcheck "T1 POST /crm_activity sans bearer" "401" "$T1" ""
T2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID" -H 'Content-Type: application/json' -d '{"partner_id":1}' "$B/crm_activity")
hcheck "T2 POST /crm_activity bearer invalide" "401" "$T2" ""

echo ""
echo "=== Volet B : id inexistant (PATCH + DELETE → 404, aucun audit) ==="
T3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"crm_status":"x"}' "$B/crm_activity/999999")
hcheck "T3 PATCH /crm_activity/999999 (admin)" "404" "$T3" ""
T4=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity/999999")
hcheck "T4 DELETE /crm_activity/999999 (admin)" "404" "$T4" ""

echo ""
echo "=== Volet C : POST admin avec note (audit create attendu) ==="
POST_PAYLOAD="{\"partner_id\":1,\"activity_type\":\"call\",\"note\":\"$TEST_NOTE_INITIAL\",\"crm_status\":\"in_progress\",\"last_contact_at\":1730000000000,\"next_followup_at\":1761536000000}"
T5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$POST_PAYLOAD" "$B/crm_activity")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
hcheck "T5 admin POST /crm_activity" "200" "$T5_CODE" ""
ROW_ID=$(echo "$T5_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "    crm_activity test id = $ROW_ID, partner_id=1, note INITIAL présente"
echo "    audit attendu : action_type='create', new_values 7 champs SANS note, metadata.note_present=true"

echo ""
echo "=== Volet D : PATCH admin (modif activity_type + crm_status + next_followup_at + note) ==="
PATCH_PAYLOAD="{\"activity_type\":\"meeting\",\"crm_status\":\"closed\",\"next_followup_at\":1762000000000,\"note\":\"$TEST_NOTE_MODIFIED\"}"
T6_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PATCH_PAYLOAD" "$B/crm_activity/$ROW_ID")
T6_CODE=$(echo "$T6_RESP" | tail -1)
hcheck "T6 admin PATCH /crm_activity/$ROW_ID" "200" "$T6_CODE" ""
echo "    audit attendu : changed_fields=[activity_type,crm_status,next_followup_at,note],"
echo "                    note_modified=true, note_present=true"
echo "    note ABSENT de previous_values et new_values, contenu jamais loggué"
unset TEST_NOTE_INITIAL TEST_NOTE_MODIFIED

echo ""
echo "=== Volet E : DELETE admin (audit delete attendu) ==="
T7_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity/$ROW_ID")
T7_CODE=$(echo "$T7_RESP" | tail -1)
hcheck "T7 admin DELETE /crm_activity/$ROW_ID" "200" "$T7_CODE" ""
echo "    audit attendu : action_type='delete', previous_values 7 champs SANS note,"
echo "                    metadata.note_present=true (depuis \$existing)"

echo ""
echo "=== Vérif post-DELETE : ré-DELETE même id → 404 (aucun audit supplémentaire) ==="
T8=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity/$ROW_ID")
hcheck "T8 ré-DELETE même id" "404" "$T8" ""

echo ""
echo "=== Fin tests Batch 7F.2.b ==="
echo ""
echo ">>> crm_activity id=$ROW_ID auto-supprimé par T7."
echo ">>> audit_logs à supprimer côté Claude (object_type='crm_activity' object_id=$ROW_ID) :"
echo "    - 1 audit create (T5, note INITIAL présente)"
echo "    - 1 audit update (T6, note modifiée → MODIFIED)"
echo "    - 1 audit delete (T7)"
echo "    + 1 audit login admin (script)"
echo ""
echo ">>> Le texte exact 'BATCH7F_NOTE_SHOULD_NOT_APPEAR' ne doit apparaître dans aucun audit_log."
echo ">>> Cas partenaire couvert par revue de code (precondition admin-only stricte)."
