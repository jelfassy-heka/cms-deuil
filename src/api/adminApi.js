// Couche API admin — Sécurité Admin / Journal d'activité (Batch 7H.2)
// Branche le frontend sur GET /admin/audit-logs (api_id=1437, workspace 17, group api:M9mahf09).
//
// Préserve le pattern bearer existant via getAuthHeaders exporté par lib/xano.js.
// Aucun audit n'est créé côté backend pour les lectures GET (cf. Batch 7G).

import { getAuthHeaders } from '../lib/xano'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

// Construit la query string en filtrant les undefined / null / "".
const buildQuery = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  const sp = new URLSearchParams()
  entries.forEach(([k, v]) => sp.append(k, String(v)))
  return '?' + sp.toString()
}

// GET /admin/audit-logs avec bearer admin.
// params accepte : page, per_page, id, action_type, object_type, object_id,
//   actor_user_id, actor_email, actor_partner_id, object_partner_id,
//   method, endpoint, date_from, date_to.
// Toute clé absente, null ou "" est ignorée côté requête.
// Erreurs :
//  - 401/403 : message "forbidden" pour bascule UI vers état accès refusé.
//  - autre   : message générique avec status code.
export const getAuditLogs = async (params = {}) => {
  const url = `${XANO_BASE}/admin/audit-logs${buildQuery(params)}`
  const res = await fetch(url, { headers: { ...getAuthHeaders() } })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const err = new Error('forbidden')
      err.status = res.status
      throw err
    }
    const err = new Error(`GET /admin/audit-logs failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}
