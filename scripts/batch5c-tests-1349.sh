#!/bin/bash
# Batch 5C — Tests 1349 POST /send-email Option C (template-scoped)
# Workspace 17, group api:M9mahf09. cms_users + whitelist {10,11,12,13,14,15} + T#10/T#14 admin-only.
#
# Tous les tests font ÉCHOUER les préconditions AVANT api.request.
# AUCUN appel Brevo. AUCUN email réel envoyé.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch5c-tests-1349.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

# ─── Saisie masquée
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi

[ -z "${ADMIN_PASSWORD:-}" ] && { echo "Mot de passe admin manquant. Stop."; exit 2; }
[ -z "${PARTNER_EMAIL:-}" ] && { echo "PARTNER_EMAIL requis. Stop."; exit 2; }

if [ -z "${PARTNER_PASSWORD:-}" ]; then
  printf "Mot de passe partenaire (%s) : " "$PARTNER_EMAIL"
  stty -echo
  IFS= read -r PARTNER_PASSWORD
  stty echo
  printf "\n"
fi

# ─── Login admin
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

# ─── Login partenaire
P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
[ "$P_LOGIN_CODE" != "200" ] && { echo "Login partenaire KO [HTTP $P_LOGIN_CODE]"; exit 1; }
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body_excerpt="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body_excerpt" ] && printf "    body: %s\n" "$body_excerpt"
}

# ─── A1 : sans bearer → 401
A1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","template_id":10,"params":"{}"}' "$B/send-email")
hcheck "A1 sans bearer" "401" "$A1_CODE" ""

# ─── A2 : bearer invalide → 401
A2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN_XYZ" -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","template_id":10,"params":"{}"}' "$B/send-email")
hcheck "A2 bearer invalide" "401" "$A2_CODE" ""

# ─── A3 : admin + template_id=99 (hors whitelist) → 400 attendu (inputerror)
A3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","to_name":"x","template_id":99,"params":"{}"}' "$B/send-email")
A3_CODE=$(echo "$A3_RESP" | tail -1)
A3_BODY=$(echo "$A3_RESP" | head -1)
hcheck "A3 admin + template_id=99 (hors whitelist)" "400" "$A3_CODE" "$A3_BODY"

# ─── A4 : partenaire + template_id=10 (admin-only) → 403
A4_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","to_name":"x","template_id":10,"params":"{}"}' "$B/send-email")
A4_CODE=$(echo "$A4_RESP" | tail -1)
A4_BODY=$(echo "$A4_RESP" | head -1)
hcheck "A4 partenaire + template_id=10 (admin-only)" "403" "$A4_CODE" "$A4_BODY"

# ─── A5 : partenaire + template_id=14 (admin-only) → 403
A5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","to_name":"x","template_id":14,"params":"{}"}' "$B/send-email")
A5_CODE=$(echo "$A5_RESP" | tail -1)
A5_BODY=$(echo "$A5_RESP" | head -1)
hcheck "A5 partenaire + template_id=14 (admin-only)" "403" "$A5_CODE" "$A5_BODY"

# ─── A7 : admin + template_id=9 (hors whitelist car réservé /send-code-email) → 400
A7_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"to_email":"x@x.x","to_name":"x","template_id":9,"params":"{}"}' "$B/send-email")
A7_CODE=$(echo "$A7_RESP" | tail -1)
A7_BODY=$(echo "$A7_RESP" | head -1)
hcheck "A7 admin + template_id=9 (réservé /send-code-email)" "400" "$A7_CODE" "$A7_BODY"

echo ""
echo "  A6 templates partenaires autorisés (T#11/T#12/T#13/T#15) :"
echo "    Vérification statique uniquement — un test runtime déclencherait Brevo."
echo "    XanoScript live laisse passer ces templates pour cms_users authentifié."
echo "    Confirmation par grep côté Claude après publication."
echo ""
echo "  A8 secret Brevo :"
echo "    Vérification statique côté Claude via getAPI live :"
echo "    - xkeysib doit rester ABSENT du xanoscript live."
echo "    - \$env.BREVO_API_KEY doit rester présent."
echo ""

echo "=== Fin tests Batch 5C 1349 ==="
echo ""
echo ">>> Aucun appel Brevo n'a été fait."
echo ">>> Aucun email réel n'a été envoyé."
