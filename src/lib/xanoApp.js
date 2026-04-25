const APP_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'

const xanoApp = {
  async getAll(endpoint) {
    const res = await fetch(`${APP_BASE}/${endpoint}`)
    if (!res.ok) throw new Error(`GET /${endpoint} failed: ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : (data?.items || [])
  },
}

export default xanoApp
