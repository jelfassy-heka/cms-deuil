#!/bin/bash
# Batch 3A — admin tests (à lancer avec ADMIN_PASSWORD en env var).
# Aucun secret stocké dans ce fichier. Le MDP est lu depuis $ADMIN_PASSWORD.
#
# Usage :
#   ADMIN_PASSWORD='ton_mdp' bash scripts/batch3a-admin-tests.sh
#
# Les sorties sont safe à coller dans le chat (aucun bearer/MDP).

set -u

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Error: set ADMIN_PASSWORD env var first."
  exit 2
fi

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

# Login admin (single line — no line continuation issues)
LOGIN_BODY="{\"email\":\"jelfassy@heka-app.fr\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)
echo "=== D1 login admin ==="
echo "[HTTP $LOGIN_CODE]"

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login failed. Stop."
  exit 1
fi

AT=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo ""
echo "=== D3 /auth/me admin ==="
curl -s -o /dev/null -w "[HTTP %{http_code}]\n" -H "Authorization: Bearer $AT" "$A/auth/me"

echo ""
echo "=== D6 GET /partners admin ==="
D6_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $AT" "$B/partners")
D6_CODE=$(echo "$D6_RESP" | tail -1)
D6_BODY=$(echo "$D6_RESP" | head -1)
echo "[HTTP $D6_CODE]"
echo "$D6_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'rows={len(d) if isinstance(d,list) else \"?\"}, ids={[r.get(\"id\") for r in d] if isinstance(d,list) else \"?\"}')"

echo ""
echo "=== A2 admin POST /beneficiaries partner_id=1 ==="
A2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"first_name":"AdminA2","email":"a2@invalid.local","partner_id":1}' "$B/beneficiaries")
A2_CODE=$(echo "$A2_RESP" | tail -1)
A2_BODY=$(echo "$A2_RESP" | head -1)
echo "[HTTP $A2_CODE]"
echo "$A2_BODY"

echo ""
echo "=== A3 admin POST /beneficiaries partner_id=4 ==="
A3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"first_name":"AdminA3","email":"a3@invalid.local","partner_id":4}' "$B/beneficiaries")
A3_CODE=$(echo "$A3_RESP" | tail -1)
A3_BODY=$(echo "$A3_RESP" | head -1)
echo "[HTTP $A3_CODE]"
echo "$A3_BODY"

echo ""
echo "=== B2 admin PATCH /beneficiaries/1 ==="
B2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"code":"ADMIN_TEST"}' "$B/beneficiaries/1")
B2_CODE=$(echo "$B2_RESP" | tail -1)
B2_BODY=$(echo "$B2_RESP" | head -1)
echo "[HTTP $B2_CODE]"
echo "$B2_BODY"

echo ""
echo "=== C2 admin POST /code_request partner_id=1 ==="
C2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"reason":"AdminC2","quantity":1,"request_type":"codes","request_status":"pending","partner_id":1}' "$B/code_request")
C2_CODE=$(echo "$C2_RESP" | tail -1)
C2_BODY=$(echo "$C2_RESP" | head -1)
echo "[HTTP $C2_CODE]"
echo "$C2_BODY"

echo ""
echo "=== C3 admin POST /code_request partner_id=4 ==="
C3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"reason":"AdminC3","quantity":1,"request_type":"codes","request_status":"pending","partner_id":4}' "$B/code_request")
C3_CODE=$(echo "$C3_RESP" | tail -1)
C3_BODY=$(echo "$C3_RESP" | head -1)
echo "[HTTP $C3_CODE]"
echo "$C3_BODY"

# Extract created row IDs for cleanup tracking
A2_ID=$(echo "$A2_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
A3_ID=$(echo "$A3_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
C2_ID=$(echo "$C2_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
C3_ID=$(echo "$C3_BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)

echo ""
echo "=== IDs créés (à supprimer côté Claude via MCP) ==="
echo "Beneficiaries A2=$A2_ID A3=$A3_ID"
echo "code_request C2=$C2_ID C3=$C3_ID"
echo "(B2 a modifié beneficiaries.id=1.code='ADMIN_TEST', à restaurer à '')"
