#!/bin/bash
# Batch 4 — Sanity check non-régression après clôture famille crm_activity.
#
# Lecture seule. Aucun updateAPI, aucune mutation base.
# Vérifie que les batchs précédents (Xano 6.2A, Lot 7, Batch 0/1/2A/3A/3B) restent OK
# et que les nouveaux endpoints crm_activity bloquent bien les non-admins.
#
# Saisie masquée. Aucun secret stocké.
#
# Usage :
#   PARTNER_EMAIL='partenaire@...' bash scripts/batch4-regression-after-crm_activity.sh

set -u

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

ADMIN_EMAIL='jelfassy@heka-app.fr'

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

# ─── Saisie masquée mot de passe partenaire (requis pour ce check)
if [ -z "${PARTNER_EMAIL:-}" ]; then
  echo "PARTNER_EMAIL requis pour ce sanity check (vérifs partenaire). Stop."
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
echo "=== Login admin ==="
LOGIN_BODY="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)
echo "[HTTP $LOGIN_CODE] (attendu 200)"

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login admin échoué. Stop."
  exit 1
fi

ADMIN_TOKEN=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "Admin bearer obtenu (len=${#ADMIN_TOKEN})"
echo ""

# ─── Login partenaire
echo "=== Login partenaire ==="
P_LOGIN_BODY="{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}"
P_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$P_LOGIN_BODY")
P_LOGIN_CODE=$(echo "$P_LOGIN_RESP" | tail -1)
P_LOGIN_BODY_RESP=$(echo "$P_LOGIN_RESP" | head -1)
echo "[HTTP $P_LOGIN_CODE] (attendu 200)"

if [ "$P_LOGIN_CODE" != "200" ]; then
  echo "Login partenaire échoué. Stop."
  exit 1
fi

PARTNER_TOKEN=$(echo "$P_LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")
echo "Partner bearer obtenu (len=${#PARTNER_TOKEN})"
echo ""

# ─── R1 : Admin /auth/me
echo "=== R1 admin GET /auth/me ==="
R1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$A/auth/me")
echo "[HTTP $R1_CODE] (attendu 200)"
echo ""

# ─── R2 : Partenaire /me/partner_membership (Xano 6.2A)
echo "=== R2 partenaire GET /me/partner_membership ==="
R2_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$A/me/partner_membership")
R2_CODE=$(echo "$R2_RESP" | tail -1)
R2_BODY=$(echo "$R2_RESP" | head -1)
echo "[HTTP $R2_CODE] (attendu 200)"
echo "$R2_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    pid = d.get('partner_id') if isinstance(d, dict) else None
    print(f'  partner_id = {pid} (attendu 1)')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

# ─── R3 : Partenaire GET /partners (Batch 2A)
echo "=== R3 partenaire GET /partners ==="
R3_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners")
R3_CODE=$(echo "$R3_RESP" | tail -1)
R3_BODY=$(echo "$R3_RESP" | head -1)
echo "[HTTP $R3_CODE] (attendu 200)"
echo "$R3_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        print(f'  rows={len(d)}, ids={[r.get(\"id\") for r in d]}')
    else:
        print(f'  type={type(d).__name__}')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

# ─── R4 : Partenaire GET /partners/1
echo "=== R4 partenaire GET /partners/1 ==="
R4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partners/1")
echo "[HTTP $R4_CODE] (attendu 200)"
echo ""

# ─── R5 : Partenaire GET /beneficiaries (Batch 1)
echo "=== R5 partenaire GET /beneficiaries ==="
R5_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/beneficiaries")
R5_CODE=$(echo "$R5_RESP" | tail -1)
R5_BODY=$(echo "$R5_RESP" | head -1)
echo "[HTTP $R5_CODE] (attendu 200)"
echo "$R5_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        pids = sorted({r.get('partner_id') for r in d})
        print(f'  rows={len(d)}, partner_ids distincts={pids} (attendu uniquement [1])')
    else:
        print(f'  type={type(d).__name__}')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

# ─── R6 : Partenaire GET /partner_members (Batch 1)
echo "=== R6 partenaire GET /partner_members ==="
R6_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/partner_members")
R6_CODE=$(echo "$R6_RESP" | tail -1)
R6_BODY=$(echo "$R6_RESP" | head -1)
echo "[HTTP $R6_CODE] (attendu 200)"
echo "$R6_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        pids = sorted({r.get('partner_id') for r in d})
        print(f'  rows={len(d)}, partner_ids distincts={pids} (attendu uniquement [1])')
    else:
        print(f'  type={type(d).__name__}')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

# ─── R7 : Partenaire GET /plan-activation-code (Batch 1)
echo "=== R7 partenaire GET /plan-activation-code ==="
R7_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/plan-activation-code")
R7_CODE=$(echo "$R7_RESP" | tail -1)
R7_BODY=$(echo "$R7_RESP" | head -1)
echo "[HTTP $R7_CODE] (attendu 200)"
echo "$R7_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        pids = sorted({r.get('partnerId') for r in d})
        print(f'  rows={len(d)}, partnerId distincts={pids} (attendu uniquement [1])')
    else:
        print(f'  type={type(d).__name__}')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

# ─── R8 : Partenaire GET /crm_activity (NOUVEAU — doit renvoyer 403)
echo "=== R8 partenaire GET /crm_activity (nouveau hardening Batch 4) ==="
R8_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $PARTNER_TOKEN" "$B/crm_activity")
R8_CODE=$(echo "$R8_RESP" | tail -1)
R8_BODY=$(echo "$R8_RESP" | head -1)
echo "[HTTP $R8_CODE] (attendu 403)"
echo "Body: $R8_BODY"
echo ""

# ─── R9 : Admin GET /crm_activity (doit renvoyer 200, liste vide)
echo "=== R9 admin GET /crm_activity ==="
R9_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$B/crm_activity")
R9_CODE=$(echo "$R9_RESP" | tail -1)
R9_BODY=$(echo "$R9_RESP" | head -1)
echo "[HTTP $R9_CODE] (attendu 200)"
echo "$R9_BODY" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        print(f'  rows={len(d)} (attendu 0 — table vidée par les cleanups)')
    else:
        print(f'  type={type(d).__name__}')
except Exception as e:
    print(f'JSON parse error: {e}')"
echo ""

echo "=== Fin sanity check non-régression — famille crm_activity ==="
