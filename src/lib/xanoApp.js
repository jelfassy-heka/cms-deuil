const APP_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'

const xanoApp = {
  async getAll(endpoint) {
    const res = await fetch(`${APP_BASE}/${endpoint}`)
    if (!res.ok) throw new Error(`GET /${endpoint} failed: ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : (data?.items || [])
  },

  async post(endpoint, body) {
    const res = await fetch(`${APP_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`POST /${endpoint} failed: ${res.status} ${text}`)
    }
    return res.json()
  },

  async patch(endpoint, body) {
    const res = await fetch(`${APP_BASE}/${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PATCH /${endpoint} failed: ${res.status} ${text}`)
    }
    return res.json()
  },
}

export default xanoApp
