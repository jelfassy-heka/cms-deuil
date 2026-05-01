#!/bin/bash
# Batch 3B — admin tests + C6 last-admin protection.
# Lance localement avec ADMIN_PASSWORD en env var. Aucun secret stocké.
#
# Usage :
#   ADMIN_PASSWORD='ton_mdp' bash scripts/batch3b-admin-tests.sh
#
# Le script crée puis trace toutes les rows temporaires.
# Cleanup MCP côté Claude après pour les rows que le script ne peut pas auto-supprimer.

set -u

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Error: set ADMIN_PASSWORD env var first."
  exit 2
fi

A='https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
B='https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

# ─── Login admin
LOGIN_BODY="{\"email\":\"jelfassy@heka-app.fr\",\"password\":\"$ADMIN_PASSWORD\"}"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "$LOGIN_BODY")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY_RESP=$(echo "$LOGIN_RESP" | head -1)

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login failed [HTTP $LOGIN_CODE]. Stop."
  exit 1
fi

AT=$(echo "$LOGIN_BODY_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['authToken'])")

echo "=== Login admin OK ==="
echo ""

# ─── Snapshot original /partners/1 pour restauration finale
ORIG_PHONE=$(curl -s -H "Authorization: Bearer $AT" "$B/partners/1" | python3 -c "import json,sys;print(json.load(sys.stdin)['phone'])")
echo "Snapshot /partners/1.phone = '$ORIG_PHONE'"
echo ""

# ─── A2 admin POST /partner_members partner_id=1
echo "=== A2 admin POST /partner_members partner_id=1 ==="
A2_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"user_email":"a2admin@invalid.local","partner_id":1,"role":"member","status":"active","invited_by":"admin"}' "$B/partner_members")
A2_CODE=$(echo "$A2_RESP" | tail -1)
A2_BODY=$(echo "$A2_RESP" | head -1)
echo "[HTTP $A2_CODE] $A2_BODY"
A2_ID=$(echo "$A2_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo ""

# ─── A3 admin POST /partner_members partner_id=4 (partner test existant)
echo "=== A3 admin POST /partner_members partner_id=4 ==="
A3_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"user_email":"a3admin@invalid.local","partner_id":4,"role":"member","status":"active","invited_by":"admin"}' "$B/partner_members")
A3_CODE=$(echo "$A3_RESP" | tail -1)
A3_BODY=$(echo "$A3_RESP" | head -1)
echo "[HTTP $A3_CODE] $A3_BODY"
A3_ID=$(echo "$A3_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo ""

# ─── B2 admin PATCH /parnter_members/{A2_ID} : role: member → admin
echo "=== B2 admin PATCH /parnter_members/$A2_ID ==="
B2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"role":"admin"}' "$B/parnter_members/$A2_ID")
B2_CODE=$(echo "$B2_RESP" | tail -1)
B2_BODY=$(echo "$B2_RESP" | head -1)
echo "[HTTP $B2_CODE] $B2_BODY"
echo ""

# ─── C2 admin DELETE /partner_members/{A3_ID} (member normal — cleanup auto via le test)
echo "=== C2 admin DELETE /partner_members/$A3_ID (cleanup A3) ==="
C2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $AT" "$B/partner_members/$A3_ID")
echo "[HTTP $C2_CODE]"
echo ""

# ─── C6 last-admin protection : on a déjà ajouté A2_ID en admin sur partner_id=1.
# partner_id=1 a maintenant 3 admins actifs : id=1, id=4, $A2_ID.
# On supprime id=1 (HekaLuc partner_member) pour passer à 2 admins.
# Puis on supprime id=4 (pro.jelfassy) pour passer à 1 admin (A2_ID).
# Puis on tente de supprimer A2_ID → DOIT renvoyer 403 (last admin).
# Cleanup : on restaure id=1 et id=4 via le script (dans Xano via curl il faut un endpoint POST).
# IMPORTANT : ce scénario CASSE la connexion partenaire pendant le test.
# On préfère un test plus safe sur partner_id=4 qui a 0 admin par défaut.

# Approche safe : créer un admin sur partner_id=4 (qui n'a pas d'admin), puis tenter le DELETE.
# Le partner_id=4 a 0 admin actif normalement (pas de partner_members partner_id=4 en DB).
# Après création, il a 1 admin → tentative de delete → expect 403 last-admin.

echo "=== C6 last-admin protection (sur partner_id=4) ==="
C6_CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"user_email":"c6lastadmin@invalid.local","partner_id":4,"role":"admin","status":"active","invited_by":"admin"}' "$B/partner_members")
C6_CREATE_CODE=$(echo "$C6_CREATE_RESP" | tail -1)
C6_CREATE_BODY=$(echo "$C6_CREATE_RESP" | head -1)
echo "  Création admin temp partner_id=4 [HTTP $C6_CREATE_CODE]"
C6_ID=$(echo "$C6_CREATE_BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  → id=$C6_ID"

if [ -n "$C6_ID" ] && [ "$C6_ID" != "" ]; then
  echo "  Tentative DELETE last admin id=$C6_ID :"
  C6_DELETE_RESP=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $AT" "$B/partner_members/$C6_ID")
  C6_DELETE_CODE=$(echo "$C6_DELETE_RESP" | tail -1)
  C6_DELETE_BODY=$(echo "$C6_DELETE_RESP" | head -1)
  echo "  [HTTP $C6_DELETE_CODE] $C6_DELETE_BODY"
  echo "  ATTENDU : 403 + 'Cannot remove last active admin'"
fi
echo ""

# ─── D2 admin PATCH /partners/1 (modif phone non critique)
echo "=== D2 admin PATCH /partners/1 (modif phone) ==="
D2_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"phone":"BATCH3B_ADMIN_TEST"}' "$B/partners/1")
D2_CODE=$(echo "$D2_RESP" | tail -1)
echo "[HTTP $D2_CODE]"

# Restauration phone immédiate
RESTORE_RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$ORIG_PHONE\"}" "$B/partners/1")
RESTORE_CODE=$(echo "$RESTORE_RESP" | tail -1)
echo "Restauration phone='$ORIG_PHONE' [HTTP $RESTORE_CODE]"
echo ""

# ─── Récap IDs créés
echo "=== IDs créés (à supprimer côté Claude via MCP) ==="
echo "partner_members A2 id=$A2_ID (encore présent — role=admin sur partner_id=1)"
echo "partner_members A3 id=$A3_ID (déjà supprimé par C2)"
echo "partner_members C6 id=$C6_ID (encore présent — admin sur partner_id=4, last admin)"
echo ""
echo "NOTE: A2 et C6 doivent être supprimés via deleteTableContentItem MCP."
echo "Si A3 a échoué, vérifier aussi son id."
