// scripts/regression-auth-signup.js
// Regression test for auth/signup security (Xano 6.2B / lot 7).
//
// Vérifie que /auth/signup (workspace 17, group api:IS_IPWIL) :
//   1. rejette une requête sans bearer
//   2. rejette une requête avec bearer cms_users non-admin
//   3. accepte une requête avec bearer admin + email nouveau (puis nettoie)
//   4. rejette une requête avec bearer admin + email déjà utilisé
//
// Le script fait lui-même le login pour récupérer les bearers, puis nettoie
// le compte créé par le cas 3 via DELETE /cms_users/{id}.
//
// Usage :
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//   NONADMIN_EMAIL=... NONADMIN_PASSWORD=... \
//   node scripts/regression-auth-signup.js
//
// Exit codes :
//   0 — tous les cas passent
//   1 — au moins un cas échoue
//   2 — erreur d'exécution (login impossible, env manquant, etc.)

const AUTH_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
const CMS_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

const REQUIRED_ENV = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'NONADMIN_EMAIL', 'NONADMIN_PASSWORD']
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) {
    console.error(`Missing env var: ${k}`)
    process.exit(2)
  }
}

const { ADMIN_EMAIL, ADMIN_PASSWORD, NONADMIN_EMAIL, NONADMIN_PASSWORD } = process.env

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function login(email, password) {
  const res = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`auth/login failed for ${email}: ${res.status} ${text}`)
  }
  const json = await res.json()
  if (!json.authToken) throw new Error(`auth/login returned no authToken for ${email}`)
  return json.authToken
}

async function callSignup({ token, email }) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${AUTH_BASE}/auth/signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'regression test',
      user_type: 'partner',
      password: 'NotARealPasswordX9!',
      email,
    }),
  })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = null }
  return { status: res.status, body, text }
}

async function getMe(token) {
  const res = await fetch(`${AUTH_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`auth/me failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function deleteCmsUser(adminToken, userId) {
  const res = await fetch(`${CMS_BASE}/cms_users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DELETE /cms_users/${userId} failed: ${res.status} ${text}`)
  }
}

function summarizeBody(body, text) {
  if (body && (body.message || body.error)) return body.message || body.error
  return text.slice(0, 120)
}

async function main() {
  console.log('--- Regression: auth/signup (workspace 17 / api:IS_IPWIL) ---')

  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
  const nonAdminToken = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD)

  // Case 1: no auth header → expect 4xx
  {
    const { status, body, text } = await callSignup({ token: null, email: `noop-${Date.now()}@invalid.local` })
    const ok = status >= 400 && status < 500
    record('1. no bearer → rejected', ok, `status=${status} msg="${summarizeBody(body, text)}"`)
  }

  // Case 2: non-admin bearer → expect 4xx (precondition Forbidden)
  {
    const { status, body, text } = await callSignup({ token: nonAdminToken, email: `noop-${Date.now()}@invalid.local` })
    const ok = status >= 400 && status < 500
    record('2. non-admin bearer → rejected', ok, `status=${status} msg="${summarizeBody(body, text)}"`)
  }

  // Case 3: admin bearer + new email → expect 200 + authToken, then cleanup
  {
    const email = `regression-${Date.now()}@invalid.local`
    const { status, body, text } = await callSignup({ token: adminToken, email })
    const ok = status === 200 && body && typeof body.authToken === 'string'
    record('3. admin bearer + new email → accepted', ok,
      ok ? `status=200 hasToken=true email=${email}` : `status=${status} msg="${summarizeBody(body, text)}"`)
    if (ok) {
      try {
        const me = await getMe(body.authToken)
        await deleteCmsUser(adminToken, me.id)
        record('3.cleanup. delete created cms_user', true, `id=${me.id} email=${email}`)
      } catch (e) {
        record('3.cleanup. delete created cms_user', false,
          `${e.message} — clean manuellement le compte ${email}`)
      }
    }
  }

  // Case 4: admin bearer + existing email (= ADMIN_EMAIL itself) → expect 4xx
  {
    const { status, body, text } = await callSignup({ token: adminToken, email: ADMIN_EMAIL })
    const ok = status >= 400 && status < 500
    record('4. admin bearer + existing email → rejected', ok, `status=${status} msg="${summarizeBody(body, text)}"`)
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.error('Failed:')
    for (const r of failed) console.error(` - ${r.name}: ${r.detail}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Script error:', err.message)
  process.exit(2)
})
