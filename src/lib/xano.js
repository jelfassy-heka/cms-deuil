const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

const xano = {
  // GET all records, with optional query params
  async getAll(table, params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const url = `${XANO_BASE}/${table}${query ? `?${query}` : ''}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`GET ${table} failed: ${resp.status}`)
    const data = await resp.json()
    return Array.isArray(data) ? data : data.items || []
  },

  // GET single record by id
  async getOne(table, id) {
    const resp = await fetch(`${XANO_BASE}/${table}/${id}`)
    if (!resp.ok) throw new Error(`GET ${table}/${id} failed: ${resp.status}`)
    return resp.json()
  },

  // POST create record
  async create(table, data) {
    const resp = await fetch(`${XANO_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) throw new Error(`POST ${table} failed: ${resp.status}`)
    return resp.json()
  },

  // PATCH update record
  async update(table, id, data) {
    const resp = await fetch(`${XANO_BASE}/${table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) throw new Error(`PATCH ${table}/${id} failed: ${resp.status}`)
    return resp.json()
  },

  // DELETE record
  async remove(table, id) {
    const resp = await fetch(`${XANO_BASE}/${table}/${id}`, {
      method: 'DELETE',
    })
    if (!resp.ok) throw new Error(`DELETE ${table}/${id} failed: ${resp.status}`)
    return true
  },
}

export default xano
export { XANO_BASE }