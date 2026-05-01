#!/bin/bash
# Batch 5E pilote — Tests redis.ratelimit sur 1335 POST /plan-activation-code
# Workspace 17, group api:M9mahf09. Seuil pilote temporaire max=2 ttl=3600.
#
# Stratégie : utiliser code existant R74987 + partnerId=1 pour ne créer aucune row.
#   - Appel 1 → 400 "Code already exists" (ratelimit OK, unicité fail)
#   - Appel 2 → 400 "Code already exists" (ratelimit OK, unicité fail)
#   - Appel 3 → 429 "Rate limit exceeded" (ratelimit kicks in)
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch5e-pilot-1335.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
EXISTING_CODE='R74987'

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

# ─── Logins
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
[ "$LOGIN_CODE" != "200" ] && { echo "Login admin KO [HTTP $LOGIN_CODE]"; exit 1; }
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
[ "$P_LOGIN_CODE" != "200" ] && { echo "Login partenaire KO [HTTP $P_LOGIN_CODE]"; exit 1; }
PARTNER_TOKEN=$(echo "$P_LOGIN_RESP" | head -1 | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin + partenaire OK ==="
echo ""

# ─── helper
hcheck() {
  local label="$1" expected="$2" code="$3" body="$4"
  local mark="OK"
  [ "$code" != "$expected" ] && mark="ANOMALIE"
  printf "  %-72s [HTTP %s] (attendu %s) [%s]\n" "$label" "$code" "$expected" "$mark"
  [ -n "$body" ] && printf "    body: %s\n" "$body"
}

PAYLOAD="{\"code\":\"$EXISTING_CODE\",\"partnerId\":1}"

# ─── A1 : sans bearer
A1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/plan-activation-code")
hcheck "A1 sans bearer" "401" "$A1_CODE" ""

# ─── A2 : bearer partenaire
A2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $PARTNER_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/plan-activation-code")
A2_CODE=$(echo "$A2_RESP" | tail -1)
A2_BODY=$(echo "$A2_RESP" | head -1)
hcheck "A2 bearer partenaire (admin-only)" "403" "$A2_CODE" "$A2_BODY"

echo ""
echo "  A3 admin + code existant + partnerId=1 — 3 appels successifs :"

# ─── A3.1 : admin appel 1 → attendu 400 unicité
A31_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/plan-activation-code")
A31_CODE=$(echo "$A31_RESP" | tail -1)
A31_BODY=$(echo "$A31_RESP" | head -1)
hcheck "    A3.1 appel 1 (ratelimit OK, unicité fail)" "400" "$A31_CODE" "$A31_BODY"

# ─── A3.2 : admin appel 2 → attendu 400 unicité
A32_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/plan-activation-code")
A32_CODE=$(echo "$A32_RESP" | tail -1)
A32_BODY=$(echo "$A32_RESP" | head -1)
hcheck "    A3.2 appel 2 (ratelimit OK, unicité fail)" "400" "$A32_CODE" "$A32_BODY"

# ─── A3.3 : admin appel 3 → attendu 429 rate limit
A33_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$PAYLOAD" "$B/plan-activation-code")
A33_CODE=$(echo "$A33_RESP" | tail -1)
A33_BODY=$(echo "$A33_RESP" | head -1)
echo "    A3.3 appel 3 (ratelimit doit kick in) :"
echo "      [HTTP $A33_CODE]"
echo "      body: $A33_BODY"
echo "      attendu : 429 ou erreur Xano contenant 'Rate limit exceeded'"
echo ""

# ─── A4 : vérifier qu'aucune row n'a été créée (count via GET admin)
echo "  A4 vérif : aucune row créée par les tests"
COUNT_RESP=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$B/plan-activation-code")
COUNT=$(echo "$COUNT_RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else '?')" 2>/dev/null)
echo "    rows actuels = $COUNT (attendu : 11, état pré-test 5E)"

# ─── A5 : vérifier que R74987 est intact
echo ""
echo "  A5 vérif : code R74987 toujours présent"
R_PRESENT=$(echo "$COUNT_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
present = any(r.get('code')=='R74987' and r.get('partnerId')==1 for r in d) if isinstance(d,list) else False
print('OUI' if present else 'NON')")
echo "    R74987 présent = $R_PRESENT (attendu OUI)"
echo ""

echo "=== Fin tests pilote 5E sur 1335 ==="
echo ""
echo ">>> Aucune row créée par ces tests (utilisation code existant)."
echo ">>> Si A3.3 échoue ou renvoie une erreur runtime opaque, signaler à Claude pour rollback immédiat."
