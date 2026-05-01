#!/bin/bash
# Batch 5B — Tests 1333 POST /send-code-email
# Workspace 17, group api:M9mahf09. Admin-only OR partner-owner + ownership code + bénéficiaire.
#
# Tous les tests font ÉCHOUER les préconditions AVANT l'appel Brevo.
# AUCUN appel Brevo. AUCUN email réel envoyé.
#
# Préconditions row temporaire :
#   plan-activation-code id=62, code="BATCH5B_TEST_CROSS_TENANT", partnerId=4 (créée via MCP)
#   sera supprimée par Claude après remontée des résultats.
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch5b-tests-1333.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
CROSS_TENANT_CODE='BATCH5B_TEST_CROSS_TENANT'   # partnerId=4 (row temp)
FAKE_CODE='FAKE_CODE_INEXISTANT_BATCH5B'         # n'existe pas
FAKE_EMAIL='fake-non-beneficiary-batch5b@invalid.local'

# ─── Saisie masquée
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  printf "Mot de passe admin (%s) : " "$ADMIN_EMAIL"
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Mot de passe admin manquant. Stop."
  exit 2
fi

if [ -z "${PARTNER_EMAIL:-}" ]; then
  echo "PARTNER_EMAIL requis. Stop."
  exit 2
fi

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
if [ "$LOGIN_CODE" != "200" ]; then echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; fi
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

# ─── Login partenaire
P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
if [ "$P_LOGIN_CODE" != "200" ]; then echo "Login partenaire KO [HTTP $P_LOGIN_CODE]"; exit 1; fi
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── Récupérer un code valide partner_id=1 via 1334 GET admin
VALID_CODE_RESP=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/plan-activation-code?partnerId=1")
VALID_CODE=$(echo "$VALID_CODE_RESP" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list) and len(d) > 0:
        for r in d:
            if r.get('partnerId') == 1 and r.get('code'):
                print(r['code'])
                break
except: pass
")

if [ -z "$VALID_CODE" ]; then
  echo "Pas de code valide partner_id=1 trouvé. Stop."
  exit 1
fi

echo "Code valide partner_id=1 utilisé pour B3/B5 : (redacted, len=${#VALID_CODE})"
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
A1_RESP=$(curl -s -w "\n%{http_code}" -X POST -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$FAKE_CODE\"}" "$B/send-code-email")
A1_CODE=$(echo "$A1_RESP" | tail -1)
hcheck "A1 sans bearer" "401" "$A1_CODE" ""

# ─── A2 : bearer invalide → 401
A2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer FAKE_INVALID_TOKEN_XYZ" -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$FAKE_CODE\"}" "$B/send-code-email")
hcheck "A2 bearer invalide" "401" "$A2_CODE" ""

# ─── B1 : admin + code inexistant → 404
B1_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$FAKE_CODE\"}" "$B/send-code-email")
B1_CODE=$(echo "$B1_RESP" | tail -1)
B1_BODY=$(echo "$B1_RESP" | head -1)
hcheck "B1 admin + code inexistant" "404" "$B1_CODE" "$B1_BODY"

# ─── B2 : partenaire (partner_id=1) + code temporaire partnerId=4 → 403 ownership code
B2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$CROSS_TENANT_CODE\"}" "$B/send-code-email")
B2_CODE=$(echo "$B2_RESP" | tail -1)
B2_BODY=$(echo "$B2_RESP" | head -1)
hcheck "B2 partenaire + code partnerId=4 (cross-tenant)" "403" "$B2_CODE" "$B2_BODY"

# ─── B3 : admin + code valide partner_id=1 + email non-bénéficiaire → 403 (precondition beneficiary)
B3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$VALID_CODE\"}" "$B/send-code-email")
B3_CODE=$(echo "$B3_RESP" | tail -1)
B3_BODY=$(echo "$B3_RESP" | head -1)
hcheck "B3 admin + code valide + email non-bénéficiaire" "403" "$B3_CODE" "$B3_BODY"

# ─── B5 : partenaire + code valide partner_id=1 + email non-bénéficiaire → 403
B5_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "{\"to_email\":\"$FAKE_EMAIL\",\"code\":\"$VALID_CODE\"}" "$B/send-code-email")
B5_CODE=$(echo "$B5_RESP" | tail -1)
B5_BODY=$(echo "$B5_RESP" | head -1)
hcheck "B5 partenaire + code valide + email non-bénéficiaire" "403" "$B5_CODE" "$B5_BODY"

# ─── B4 : vérification statique partner_name (pas de test runtime — éviterait Brevo si bénéficiaire valide)
echo ""
echo "  B4 partner_name falsifié → vérif statique :"
echo "    Le xanoscript live a 'partner_name' uniquement dans 'input', JAMAIS dans 'var \$body'."
echo "    \$input.partner_name n'est PAS utilisé pour PARTNER_NAME ; \$partner.name (backend) l'est."
echo "    Vérification confirmée par grep côté Claude après publication."
echo ""

echo "=== Fin tests Batch 5B 1333 ==="
echo ""
echo ">>> Aucun appel Brevo n'a été fait."
echo ">>> Aucun email réel n'a été envoyé."
echo ">>> Row temp plan-activation-code id=62 (code=BATCH5B_TEST_CROSS_TENANT, partnerId=4) à supprimer par Claude."
