// Couche API cms-bridge — endpoints cross-workspace App↔CMS (Mission U3)
// Branche le frontend sur GET /cms/users-overview + GET /cms/users/{id}/details
// (workspace 16 TEST_HEKA_CLONE_TEST, api group cms-bridge canonical U7_dlZtP).
//
// Sécurité effective : bearer CMS admin validé server-side via cms_bridge/validate_cms_admin_bearer
// (qui appelle workspace 17 /auth/me et vérifie user_type == "admin").
//
// Aucun champ sensible exposé — les writers backend Batch 7 ont whitelistés en amont
// et l'overview/details ne retournent que des booleans pour fcmTokens/oauth/magic_link.

import { getAuthHeaders } from '../lib/xano'

const BRIDGE_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:U7_dlZtP'

const buildQuery = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  const sp = new URLSearchParams()
  entries.forEach(([k, v]) => sp.append(k, String(v)))
  return '?' + sp.toString()
}

const handleError = async (res, fallbackMessage) => {
  if (res.status === 401 || res.status === 403) {
    const err = new Error('forbidden')
    err.type = 'forbidden'
    err.status = res.status
    throw err
  }
  if (res.status === 404) {
    const err = new Error('not_found')
    err.type = 'not_found'
    err.status = res.status
    throw err
  }
  const err = new Error(`${fallbackMessage}: ${res.status}`)
  err.status = res.status
  throw err
}

// GET /cms/users-overview avec bearer admin.
// params : page?, per_page?, created_after?, created_before? (timestamps ms).
// Toute clé absente / null / "" est ignorée.
// Erreurs : 401/403 → Error type="forbidden", autres → Error générique.
export const getUsersOverview = async (params = {}) => {
  const url = `${BRIDGE_BASE}/cms/users-overview${buildQuery(params)}`
  const res = await fetch(url, { headers: { ...getAuthHeaders() } })
  if (!res.ok) await handleError(res, 'GET /cms/users-overview failed')
  return res.json()
}

// GET /cms/users/{user_id}/details avec bearer admin.
// userId : int min 1.
// Erreurs : 401/403 → forbidden, 404 → not_found, autres → générique.
export const getUserDetails = async (userId) => {
  const url = `${BRIDGE_BASE}/cms/users/${userId}/details`
  const res = await fetch(url, { headers: { ...getAuthHeaders() } })
  if (!res.ok) await handleError(res, `GET /cms/users/${userId}/details failed`)
  return res.json()
}

// GET /cms/app-users-stats avec bearer admin.
// Mission P0-APP-USERS-BRIDGE — remplace fetch /app-users (1409) pour Dashboard/Analytics.
// Aucun PII retourné. Shape :
//   { total, created_at_min, created_at_max,
//     created_by_day: [{date:"YYYY-MM-DD", count}],
//     created_by_month: [{month:"YYYY-MM", count}] }
export const getAppUsersStats = async () => {
  const url = `${BRIDGE_BASE}/cms/app-users-stats`
  const res = await fetch(url, { headers: { ...getAuthHeaders() } })
  if (!res.ok) await handleError(res, 'GET /cms/app-users-stats failed')
  return res.json()
}

// Helper : expand stats.created_by_day en array synthétique [{ created_at }] compatible
// avec les consumers existants (sparkline / calcDelta / filtres new Date(u.created_at)).
// Le timestamp est le minuit UTC du jour bucket (granularité jour suffisante pour stats).
export const expandUsersStatsToSyntheticArray = (stats) => {
  if (!stats || !Array.isArray(stats.created_by_day)) return []
  const out = []
  for (const { date, count } of stats.created_by_day) {
    if (!date || !count) continue
    const ts = new Date(`${date}T00:00:00Z`).getTime()
    if (Number.isNaN(ts)) continue
    for (let i = 0; i < count; i++) out.push({ created_at: ts })
  }
  return out
}
