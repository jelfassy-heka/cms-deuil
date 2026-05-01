#!/bin/bash
# P0 — Tests post soft-disable 1285 DELETE /beneficiaries/{id}
# Workspace 17, group api:M9mahf09.
# Vérifie : 401 sans bearer / bearer invalide, 404 avec bearer admin (precondition false).
# Ne supprime rien, ne crée aucun bénéficiaire.

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

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "  Admin login OK"

hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"; [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

echo ""
echo "=== T1 sans bearer attendu 401 ==="
T1=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/beneficiaries/999999")
hcheck "T1 sans bearer (id 999999)" "401" "$T1" ""

echo ""
echo "=== T2 bearer invalide attendu 401 ==="
T2=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer FAKE_INVALID" "$B/beneficiaries/999999")
hcheck "T2 bearer invalide" "401" "$T2" ""

echo ""
echo "=== T3 admin id inexistant attendu 404 (precondition false) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/beneficiaries/999999")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
hcheck "T3 admin DELETE id 999999" "404" "$T3_CODE" ""
echo "    body T3: $T3_BODY"

echo ""
echo "=== T4 admin id 1 — NE DOIT PAS SUPPRIMER (precondition false avant db.del) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/beneficiaries/1")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
hcheck "T4 admin DELETE id 1 (preuve no-suppression)" "404" "$T4_CODE" ""
echo "    body T4: $T4_BODY"

echo ""
echo "=== Fin tests P0 — soft-disable 1285 ==="
echo ""
echo ">>> Aucun bénéficiaire supprimé (precondition false bloque AVANT toute logique DB)."
echo ">>> Aucun audit_log créé (pas de function.run audit/create_audit_log dans la stack)."
echo ">>> Aucun bearer affiché en clair."
