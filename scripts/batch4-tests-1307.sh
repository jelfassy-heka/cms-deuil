#!/bin/bash
# Batch 4 — Test endpoint #1 : 1307 GET /crm_activity
# Workspace 17, group api:M9mahf09. Admin-only attendu après publication.
#
# Saisie masquée des mots de passe (stty -echo). Aucun secret stocké.
# Bearer JAMAIS affiché en clair (seules les empreintes [HTTP code] et tailles sortent).
#
# Usage :
#   bash scripts/batch4-tests-1307.sh
#
# Variables optionnelles (si déjà en env, saute la saisie correspondante) :
#   ADMIN_PASSWORD     mot de passe admin Héka (jelfassy@heka-app.fr)
#   PARTNER_EMAIL      email d'un compte partenaire test (active le test 403)
#   PARTNER_PASSWORD   mot de passe du compte partenaire test
#
# Si PARTNER_EMAIL n'est pas défini, le test partenaire est sauté.

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

# ─── Saisie masquée mot de passe admin si non fourni
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

# ─── Saisie masquée mot de passe partenaire si email fourni
PARTNER_TOKEN=""
if [ -n "${PARTNER_EMAIL:-}" ]; then
  if [ -z "${PARTNER_PASSWORD:-}" ]; then
    printf "Mot de passe partenaire (%s) : " "$PARTNER_EMAIL"
    stty -echo
    IFS= read -r PARTNER_PASSWORD
    stty echo
    printf "\n"
  fi
fi

# ─── Login admin
LOGIN_BODY="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)

echo "=== Login admin ==="
echo "[HTTP $LOGIN_CODE]"

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login admin échoué. Stop."
  exit 1
fi

ADMIN_TOKEN=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
ADMIN_TOKEN_LEN=${#ADMIN_TOKEN}
echo "Admin bearer obtenu (len=$ADMIN_TOKEN_LEN)"
echo ""

# ─── Login partenaire (optionnel)
if [ -n "${PARTNER_EMAIL:-}" ] && [ -n "${PARTNER_PASSWORD:-}" ]; then
  P_LOGIN_BODY="{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}"
  P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$P_LOGIN_BODY")
  P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
  P_LOGIN_BODY_RESP=$(echo "$P_LOGIN_RESP" | head -1)
  echo "=== Login partenaire ==="
  echo "[HTTP $P_LOGIN_CODE]"
  if [ "$P_LOGIN_CODE" = "200" ]; then
    PARTNER_TOKEN=$(echo "$P_LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
    echo "Partner bearer obtenu (len=${#PARTNER_TOKEN})"
  else
    echo "Login partenaire échoué — test 403 sera sauté."
  fi
  echo ""
fi

# ─── T1 : sans bearer → attendu 401
echo "=== T1 GET /crm_activity sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$B/crm_activity")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : bearer partenaire → attendu 403
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 GET /crm_activity bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/crm_activity")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  # On affiche le body uniquement s'il s'agit d'un message d'erreur structuré (pas la liste complète).
  T2_LEN=${#T2_BODY}
  if [ "$T2_LEN" -lt 500 ]; then
    echo "Body: $T2_BODY"
  else
    echo "Body length=$T2_LEN (tronqué — non admin ne devrait pas recevoir la liste)"
  fi
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : bearer admin → attendu 200 + liste
echo "=== T3 GET /crm_activity bearer admin ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 200)"
echo "$T3_BODY" | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    if isinstance(d, list):
        print(f'rows={len(d)}, ids={[r.get(\"id\") for r in d]}')
    else:
        print(f'type={type(d).__name__} (réponse inattendue)')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

echo "=== Fin tests 1307 ==="
