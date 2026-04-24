const BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'

// Toggle data source : 'live' (prod) ou 'dev' (test)
// Configuré dans Vercel → Settings → Environment Variables → VITE_DATASOURCE
const DATASOURCE = import.meta.env.VITE_DATASOURCE || 'live'

const getHeaders = (extra = {}) => {
  const headers = { ...extra }
  if (DATASOURCE && DATASOURCE !== 'live') {
    headers['X-Data-Source'] = DATASOURCE
  }
  return headers
}
const PROXY = 'https://corsproxy.io/?url='
const REAL_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
const BASE = PROXY + encodeURIComponent(REAL_BASE)
const xano = {
  async getAll(table, params = {}) {
    const query = Object.entries(params).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')
    const url = `${BASE}/${table}${query ? '?' + query : ''}`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`)
    return res.json()
  },
  async getOne(table, id) {
    const res = await fetch(`${BASE}/${table}/${id}`, { headers: getHeaders() })
    if (!res.ok) throw new Error(`GET ${table}/${id} failed: ${res.status}`)
    return res.json()
  },
  async create(table, data) {
    const res = await fetch(`${BASE}/${table}`, { method:'POST', headers: getHeaders({'Content-Type':'application/json'}), body:JSON.stringify(data) })
    if (!res.ok) throw new Error(`POST ${table} failed: ${res.status}`)
    return res.json()
  },
  async update(table, id, data) {
    const res = await fetch(`${BASE}/${table}/${id}`, { method:'PATCH', headers: getHeaders({'Content-Type':'application/json'}), body:JSON.stringify(data) })
    if (!res.ok) throw new Error(`PATCH ${table}/${id} failed: ${res.status}`)
    return res.json()
  },
  async remove(table, id) {
    const res = await fetch(`${BASE}/${table}/${id}`, { method:'DELETE', headers: getHeaders() })
    if (!res.ok) throw new Error(`DELETE ${table}/${id} failed: ${res.status}`)
    return true
  },
}

export default xano