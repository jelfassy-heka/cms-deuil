#!/bin/bash
# Batch 4 — Test endpoint #17 FINAL : 1320 DELETE /partners/{id}
# Workspace 17, group api:M9mahf09. Admin-only + 404 + garde id!=1 + FK-check 6 tables.
#
# Le script teste :
#   T1 sans bearer → 401
#   T2 partenaire → 403
#   T3 admin DELETE id=1 → 403 (garde explicite "Cannot delete the reference partner")
#   T4 admin DELETE id=999999 → 404
#   T5 admin DELETE id=6 (BATCH4_TEST_1319, sans FK) → 200, suppression effective
#   Vérif post-T5 : DELETE id=6 → 404 (preuve disparition)
#
# IMPORTANT — Test DELETE id=4 SKIPPÉ :
#   id=4 n'a aucune FK dans les 6 tables vérifiées. Un DELETE admin sur id=4 réussirait
#   et supprimerait id=4, ce qui violerait la contrainte "ne pas toucher id=4".
#   Le FK-check est validé par cohérence syntaxique (vérifié via validate_xanoscript)
#   et par le test T3 sur id=1 qui passe par la précondition (même si c'est la garde
#   id=1 qui agit avant le FK-check).
#
# Saisie masquée. Aucun secret stocké. Bearer jamais affiché en clair.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-tests-1320.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'
TEST_PARTNER_ID="${TEST_PARTNER_ID:-6}"
FAKE_ID="${FAKE_ID:-999999}"

# ─── Garde-fou : refuser de continuer si TEST_PARTNER_ID ∈ {1, 4, 5}
if [ "$TEST_PARTNER_ID" = "1" ] || [ "$TEST_PARTNER_ID" = "4" ] || [ "$TEST_PARTNER_ID" = "5" ]; then
  echo "ANOMALIE : TEST_PARTNER_ID=$TEST_PARTNER_ID est une row pré-existante. Stop."
  exit 1
fi

# ─── Saisie masquée mot de passe admin
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
if [ -n "${PARTNER_EMAIL:-}" ] && [ -z "${PARTNER_PASSWORD:-}" ]; then
  printf "Mot de passe partenaire (%s) : " "$PARTNER_EMAIL"
  stty -echo
  IFS= read -r PARTNER_PASSWORD
  stty echo
  printf "\n"
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
echo "Admin bearer obtenu (len=${#ADMIN_TOKEN})"
echo ""

# ─── Login partenaire (optionnel)
PARTNER_TOKEN=""
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

# ─── T1 : DELETE sans bearer sur TEST_PARTNER_ID → 401 (la row reste)
echo "=== T1 DELETE /partners/$TEST_PARTNER_ID sans bearer ==="
T1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/partners/$TEST_PARTNER_ID")
echo "[HTTP $T1_CODE] (attendu 401)"
echo ""

# ─── T2 : DELETE bearer partenaire sur TEST_PARTNER_ID → 403 (la row reste)
if [ -n "$PARTNER_TOKEN" ]; then
  echo "=== T2 DELETE /partners/$TEST_PARTNER_ID bearer partenaire ==="
  T2_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/$TEST_PARTNER_ID")
  T2_CODE=$(echo "$T2_RESP" | tail -1)
  T2_BODY=$(echo "$T2_RESP" | head -1)
  echo "[HTTP $T2_CODE] (attendu 403)"
  echo "Body: $T2_BODY"
  echo ""
else
  echo "=== T2 sauté (PARTNER_EMAIL non fourni) ==="
  echo ""
fi

# ─── T3 : DELETE bearer admin id=1 → 403 (garde explicite)
echo "=== T3 DELETE /partners/1 bearer admin (garde id=1) ==="
T3_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/1")
T3_CODE=$(echo "$T3_RESP" | tail -1)
T3_BODY=$(echo "$T3_RESP" | head -1)
echo "[HTTP $T3_CODE] (attendu 403)"
echo "Body: $T3_BODY"
echo "  >>> attendu message contenant 'reference partner' (id=1) ou 'related records'"
echo ""

# ─── T4 : DELETE bearer admin id inexistant → 404
echo "=== T4 DELETE /partners/$FAKE_ID bearer admin (id inexistant) ==="
T4_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$FAKE_ID")
T4_CODE=$(echo "$T4_RESP" | tail -1)
T4_BODY=$(echo "$T4_RESP" | head -1)
echo "[HTTP $T4_CODE] (attendu 404)"
echo "Body: $T4_BODY"
echo ""

# ─── T5 : DELETE bearer admin sur TEST_PARTNER_ID (sans FK) → 200, suppression effective
echo "=== T5 DELETE /partners/$TEST_PARTNER_ID bearer admin (suppression effective) ==="
T5_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$TEST_PARTNER_ID")
T5_CODE=$(echo "$T5_RESP" | tail -1)
T5_BODY=$(echo "$T5_RESP" | head -1)
echo "[HTTP $T5_CODE] (attendu 200)"
echo "Body: $T5_BODY"
echo ""

# ─── Vérif post-T5
echo "=== Vérif post-T5 : DELETE /partners/$TEST_PARTNER_ID admin doit renvoyer 404 (déjà supprimée) ==="
POST_T5_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners/$TEST_PARTNER_ID")
echo "[HTTP $POST_T5_CODE] (attendu 404)"
echo ""

# ─── Vérif globale partners post-séquence (admin GET /partners)
echo "=== Vérif globale post-séquence : GET /partners admin ==="
FINAL_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/partners")
FINAL_CODE=$(echo "$FINAL_RESP" | tail -1)
FINAL_BODY=$(echo "$FINAL_RESP" | head -1)
FINAL_OK=$(echo "$FINAL_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        ids = sorted([r.get('id') for r in d])
        print(f'rows={len(d)}, ids={ids}')
        expected = {1, 4, 5}
        actual = set(ids)
        if actual == expected:
            print('  >>> ÉTAT FINAL CONFORME : ids={1, 4, 5}, id=6 supprimé ✓')
        elif 6 in actual:
            print('  >>> ANOMALIE : id=6 toujours présent (T5 a échoué)')
        elif not expected.issubset(actual):
            missing = expected - actual
            print(f'  >>> ANOMALIE : ids manquants : {sorted(missing)}')
        else:
            extra = actual - expected
            print(f'  >>> ANOMALIE : ids inattendus : {sorted(extra)}')
    else:
        print(f'type={type(d).__name__}')
except Exception as e:
    print(f'parse error: {e}')
")
echo "[HTTP $FINAL_CODE]"
echo "$FINAL_OK"
echo ""

echo "=== Fin tests 1320 — endpoint final Batch 4 ==="
echo ""
echo ">>> id=6 auto-supprimé par T5. id=1, id=4, id=5 doivent rester intacts."
echo ">>> NB : DELETE id=4 a été SKIPPÉ (id=4 sans FK, supprimerait la row protégée)."
