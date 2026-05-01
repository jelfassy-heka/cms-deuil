import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { getUsersOverview, getUserDetails } from '../../api/cmsBridgeApi'
import { Toast, useToast, SearchInput, SkeletonStats, SkeletonList, Pagination, usePagination, EmptyState, exportToCSV, useDebounce } from '../../components/SharedUI'

const typeConfig = {
  partner: { label: 'Code partenaire', bg: '#e8f8f7', color: '#2BBFB3', avatarBg: '#2BBFB3' },
  paying: { label: 'Payant', bg: '#e8f0fe', color: '#1a2b4a', avatarBg: '#1a2b4a' },
  free: { label: 'Gratuit / Essai', bg: '#f4f5f7', color: '#8a93a2', avatarBg: '#8a93a2' },
}

const dateFilters = [
  { key: 'all', label: 'Toutes les dates' },
  { key: '7', label: '7 derniers jours' },
  { key: '30', label: '30 derniers jours' },
  { key: '90', label: '90 derniers jours' },
  { key: '365', label: 'Cette année' },
]

const authMethodConfig = {
  email: { label: 'Email', icon: '@', bg: '#f4f5f7', color: '#8a93a2', textBg: '#f4f5f7' },
  google: { label: 'Google', icon: 'G', bg: '#e8f0fe', color: '#1a73e8', textBg: '#e8f0fe' },
  facebook: { label: 'Facebook', icon: 'f', bg: '#e7f3ff', color: '#1877f2', textBg: '#e7f3ff' },
}

// ─── Auth methods depuis booleans bridge ──────────────────────────
const getAuthMethod = (user) => {
  const methods = []
  if (user.hasGoogleOauth) methods.push('google')
  if (user.hasFacebookOauth) methods.push('facebook')
  if (methods.length === 0) methods.push('email')
  return methods
}

// ─── Sécurité affichage défensive (Mission U3 §8) ─────────────────
const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'authToken', 'auth_token', 'bearer', 'token',
  'api_key', 'apiKey', 'secret', 'BREVO_API_KEY',
  'magic_link', 'fcmTokens', 'google_oauth', 'facebook_oauth',
])

function sanitizeForDisplay(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sanitizeForDisplay)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '[masqué]'
      } else {
        out[k] = sanitizeForDisplay(v)
      }
    }
    return out
  }
  return value
}

export default function Users() {
  // ─── Overview state (depuis cms-bridge) ─────────────────────────
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [perPage] = useState(100) // backend cap 100 ; pagination serveur U4 si besoin
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [overviewError, setOverviewError] = useState(null)

  // ─── CMS data (workspace 17, sécurisé Batch 7) ──────────────────
  const [codes, setCodes] = useState([])
  const [partners, setPartners] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])

  // ─── UI state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [authMethodFilter, setAuthMethodFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [selectedUser, setSelectedUser] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ─── Details state (lazy-loaded au clic user) ───────────────────
  const [detailsRaw, setDetailsRaw] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  const { toast, showToast, clearToast } = useToast()
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768)
    c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c)
  }, [])

  // ─── Fetch overview + CMS data au mount ─────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setForbidden(false)
      setOverviewError(null)
      try {
        const [overview, c, pa, b] = await Promise.all([
          getUsersOverview({ page: 1, per_page: perPage }),
          xano.getAll('plan-activation-code').catch(() => []),
          xano.getAll('partners').catch(() => []),
          xano.getAll('beneficiaries').catch(() => []),
        ])
        setUsers(Array.isArray(overview?.items) ? overview.items : [])
        setUsersTotal(typeof overview?.total === 'number' ? overview.total : 0)
        setCodes(Array.isArray(c) ? c : c?.items || [])
        setPartners(Array.isArray(pa) ? pa : pa?.items || [])
        setBeneficiaries(Array.isArray(b) ? b : b?.items || [])
      } catch (err) {
        if (err?.type === 'forbidden') {
          setForbidden(true)
        } else {
          setOverviewError(err?.message || 'Erreur réseau')
          console.error('Erreur chargement Users:', err)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [perPage])

  // ─── Fetch details au clic user ─────────────────────────────────
  useEffect(() => {
    if (!selectedUser?.id) {
      setDetailsRaw(null)
      setDetailsError(null)
      setDetailsLoading(false)
      return
    }
    let cancelled = false
    setDetailsLoading(true)
    setDetailsError(null)
    getUserDetails(selectedUser.id)
      .then(d => { if (!cancelled) setDetailsRaw(d) })
      .catch(err => {
        if (cancelled) return
        if (err?.type === 'not_found') {
          setDetailsError('Utilisateur introuvable')
        } else if (err?.type === 'forbidden') {
          setDetailsError('Accès réservé aux administrateurs CMS')
        } else {
          setDetailsError(err?.message || 'Erreur réseau')
        }
        setDetailsRaw(null)
      })
      .finally(() => { if (!cancelled) setDetailsLoading(false) })
    return () => { cancelled = true }
  }, [selectedUser?.id])

  // ─── Enrichir les users avec type et entreprise (mapping CMS) ───
  const enrichedUsers = useMemo(() => {
    return users.map(u => {
      const usedCode = codes.find(c => c.usedBy === u.id && c.used)
      const partnerId = usedCode?.partnerId || usedCode?.partner_id
      const partner = partnerId ? partners.find(p => p.id === partnerId) : null
      const beneficiary = beneficiaries.find(b => b.email === u.email)
      const partnerFromBenef = beneficiary ? partners.find(p => p.id === beneficiary.partner_id) : null

      let userType = 'free'
      let companyName = null

      if (usedCode || beneficiary) {
        userType = 'partner'
        companyName = partner?.name || partnerFromBenef?.name || null
      }

      return {
        ...u,
        userType,
        companyName,
        codeUsed: usedCode?.code || null,
        authMethods: getAuthMethod(u),
      }
    })
  }, [users, codes, partners, beneficiaries])

  // ─── Détection des doublons potentiels ───
  const duplicates = useMemo(() => {
    const byEmail = {}
    enrichedUsers.forEach(u => {
      if (!u.email) return
      const email = u.email.toLowerCase()
      if (!byEmail[email]) byEmail[email] = []
      byEmail[email].push(u)
    })
    return Object.entries(byEmail)
      .filter(([, users]) => users.length > 1)
      .map(([email, users]) => ({ email, users }))
  }, [enrichedUsers])

  const companyList = useMemo(() => {
    const names = [...new Set(enrichedUsers.filter(u => u.companyName).map(u => u.companyName))].sort()
    return names
  }, [enrichedUsers])

  const stats = useMemo(() => {
    const total = enrichedUsers.length
    const emailCount = enrichedUsers.filter(u => u.authMethods.includes('email') && !u.authMethods.includes('google') && !u.authMethods.includes('facebook')).length
    const googleCount = enrichedUsers.filter(u => u.authMethods.includes('google')).length
    const facebookCount = enrichedUsers.filter(u => u.authMethods.includes('facebook')).length
    const thisMonth = enrichedUsers.filter(u => {
      const d = new Date(u.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const partnerCount = enrichedUsers.filter(u => u.userType === 'partner').length
    const payingCount = enrichedUsers.filter(u => u.userType === 'paying').length
    const freeCount = enrichedUsers.filter(u => u.userType === 'free').length
    return { total, emailCount, googleCount, facebookCount, thisMonth, partnerCount, payingCount, freeCount }
  }, [enrichedUsers])

  const filtered = useMemo(() => {
    let result = enrichedUsers

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      result = result.filter(u =>
        `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(s)
      )
    }
    if (typeFilter !== 'all') result = result.filter(u => u.userType === typeFilter)
    if (authMethodFilter !== 'all') result = result.filter(u => u.authMethods.includes(authMethodFilter))
    if (companyFilter !== 'all') result = result.filter(u => u.companyName === companyFilter)
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      result = result.filter(u => new Date(u.created_at) >= cutoff)
    }

    result.sort((a, b) => {
      let va = a[sortField], vb = b[sortField]
      if (sortField === 'created_at') { va = new Date(va || 0); vb = new Date(vb || 0) }
      else if (sortField === 'name') { va = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase(); vb = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase() }
      else if (sortField === 'userType') { va = a.userType; vb = b.userType }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [enrichedUsers, debouncedSearch, typeFilter, authMethodFilter, companyFilter, dateFilter, sortField, sortDir])

  const { paginated, page, totalPages, setPage, total } = usePagination(filtered, 25)

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const selectUser = u => { setSelectedUser(u); if (isMobile) setShowDetail(true) }

  // ─── Fusion details bridge + enrichissement client ──────────────
  const fullDetails = useMemo(() => {
    if (!detailsRaw) return null
    const usedCode = codes.find(c => c.usedBy === detailsRaw.user.id && c.used)
    const beneficiary = beneficiaries.find(b => b.email === detailsRaw.user.email)
    return {
      user: detailsRaw.user,
      stats: detailsRaw.stats,
      userSpaces: Array.isArray(detailsRaw.spaces) ? detailsRaw.spaces : [],
      userPosts: Array.isArray(detailsRaw.posts) ? detailsRaw.posts : [],
      userReactions: Array.isArray(detailsRaw.reactions) ? detailsRaw.reactions : [],
      userAlerts: Array.isArray(detailsRaw.alerts) ? detailsRaw.alerts : [],
      postsDocuments: Array.isArray(detailsRaw.postsDocuments) ? detailsRaw.postsDocuments : [],
      reactionsImages: Array.isArray(detailsRaw.reactionsImages) ? detailsRaw.reactionsImages : [],
      usedCode,
      beneficiary,
    }
  }, [detailsRaw, codes, beneficiaries])

  // ─── Export RGPD (utilise fullDetails directement, plus de xano.getAll) ──
  const handleExportRGPD = async () => {
    if (!selectedUser || !fullDetails) return
    setExporting(true)
    try {
      const u = { ...selectedUser, ...fullDetails.user }
      const d = fullDetails
      const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      const html = generateRGPDhtml(u, d, fullDetails.postsDocuments, fullDetails.reactionsImages, now)
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        showToast('Export RGPD ouvert dans un nouvel onglet — utilisez Ctrl+P pour sauvegarder en PDF')
      } else {
        showToast('Ouverture popup bloquée — autorisez les pop-ups', 'error')
      }
    } catch (err) { console.error(err); showToast('Erreur export', 'error') }
    finally { setExporting(false) }
  }

  // ─── Rendu ───
  if (forbidden) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Utilisateurs</h1>
        </div>
        <EmptyState icon="🔒" title="Accès réservé aux administrateurs CMS" message="Cette page nécessite un compte administrateur." />
      </div>
    )
  }

  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={6} /></div>

  if (overviewError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Utilisateurs</h1>
        </div>
        <EmptyState icon="⚠️" title="Impossible de charger la liste" message={overviewError} actionLabel="Réessayer" onAction={() => window.location.reload()} />
      </div>
    )
  }

  const showCompanyFilter = typeFilter === 'all' || typeFilter === 'partner'
  const showLimitWarning = usersTotal > users.length

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Utilisateurs</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>{stats.total} utilisateur{stats.total > 1 ? 's' : ''} de l'application Héka{showLimitWarning ? ` (${users.length} sur ${usersTotal})` : ''}</p>
        </div>
        <button
          onClick={() => exportToCSV(enrichedUsers, 'utilisateurs', [
            { key: 'firstName', label: 'Prénom' }, { key: 'lastName', label: 'Nom' },
            { key: 'email', label: 'Email' }, { key: 'gender', label: 'Genre' },
            { key: 'userType', label: 'Type' }, { key: 'companyName', label: 'Entreprise' },
            { key: 'created_at', label: 'Inscription' },
          ])}
          className="px-4 py-3 rounded-2xl text-sm font-semibold"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
          📥 Exporter CSV
        </button>
      </div>

      {showLimitWarning && (
        <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p className="text-sm" style={{ color: '#9a3412' }}>
            ⚠️ {users.length} premiers utilisateurs affichés sur {usersTotal}. Pagination serveur à étendre si besoin.
          </p>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="mb-4 p-3 rounded-2xl flex items-center justify-between gap-3" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#9a3412' }}>
              ⚠️ {duplicates.length} doublon{duplicates.length > 1 ? 's' : ''} potentiel{duplicates.length > 1 ? 's' : ''} détecté{duplicates.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#c2410c' }}>
              Mêmes emails avec des méthodes de connexion différentes
            </p>
          </div>
          <button
            onClick={() => {
              const list = duplicates.map(d => `${d.email}: ${d.users.map(u => u.authMethods.join('+')).join(' / ')}`).join('\n')
              alert(`Doublons potentiels:\n\n${list}`)
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: '#9a3412', color: 'white' }}>
            Voir →
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: '#2BBFB3', delta: `+${stats.thisMonth} ce mois` },
          { label: 'Email', value: stats.emailCount, color: '#8a93a2', delta: stats.total ? `${Math.round(stats.emailCount / stats.total * 100)}%` : '0%' },
          { label: 'Google', value: stats.googleCount, color: '#1a73e8', delta: stats.total ? `${Math.round(stats.googleCount / stats.total * 100)}%` : '0%' },
          { label: 'Facebook', value: stats.facebookCount, color: '#1877f2', delta: stats.total ? `${Math.round(stats.facebookCount / stats.total * 100)}%` : '0%' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 md:p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl md:text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{s.label}</p>
            <span className="text-xs px-2 py-0.5 rounded-lg mt-1 inline-block" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>{s.delta}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, email..." />
        </div>

        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCompanyFilter('all'); setPage(1) }}
          className="px-3 py-3 rounded-2xl text-sm outline-none"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
          <option value="all">Tous les types</option>
          <option value="paying">Payant</option>
          <option value="partner">Code partenaire</option>
          <option value="free">Gratuit / Essai</option>
        </select>

        <select value={authMethodFilter} onChange={e => { setAuthMethodFilter(e.target.value); setPage(1) }}
          className="px-3 py-3 rounded-2xl text-sm outline-none"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
          <option value="all">Toutes méthodes</option>
          <option value="email">Email</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
        </select>

        {showCompanyFilter && companyList.length > 0 && (
          <select value={companyFilter} onChange={e => { setCompanyFilter(e.target.value); setPage(1) }}
            className="px-3 py-3 rounded-2xl text-sm outline-none"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
            <option value="all">Toutes les entreprises</option>
            {companyList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1) }}
          className="px-3 py-3 rounded-2xl text-sm outline-none"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
          {dateFilters.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className={`flex-1 min-w-0 ${isMobile && showDetail ? 'hidden' : ''}`}>
          {paginated.length === 0 ? (
            <EmptyState icon="👤" title="Aucun utilisateur" message="Aucun utilisateur ne correspond à vos filtres" />
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 140px 150px 120px 80px', borderBottom: '1px solid #f4f5f7', backgroundColor: '#fafbfc' }}>
                {[
                  { label: 'Utilisateur', field: 'name' },
                  { label: 'Type', field: 'userType' },
                  { label: 'Entreprise', field: null },
                  { label: 'Inscription', field: 'created_at' },
                  { label: 'Murs', field: null },
                ].map(col => (
                  <div key={col.label} onClick={col.field ? () => toggleSort(col.field) : undefined}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: sortField === col.field ? '#2BBFB3' : '#8a93a2', cursor: col.field ? 'pointer' : 'default' }}>
                    {col.label} {col.field && (sortField === col.field ? (sortDir === 'asc' ? '↑' : '↓') : '↕')}
                  </div>
                ))}
              </div>

              {paginated.map(u => {
                const tc = typeConfig[u.userType] || typeConfig.free
                const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || u.email?.[0] || ''}`.toUpperCase()
                return (
                  <div key={u.id} onClick={() => selectUser(u)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    style={{
                      borderBottom: '1px solid #f4f5f7',
                      backgroundColor: selectedUser?.id === u.id ? '#f0faf9' : 'transparent',
                    }}>
                    <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 140px 150px 120px 80px' }}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tc.avatarBg }}>{initials}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{u.firstName} {u.lastName}</p>
                            {u.authMethods.map(m => {
                              const c = authMethodConfig[m]
                              return (
                                <span key={m} title={`Connexion ${c.label}`}
                                  className="inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: c.textBg, color: c.color }}>
                                  {c.icon}
                                </span>
                              )
                            })}
                          </div>
                          <p className="text-xs truncate" style={{ color: '#8a93a2' }}>{u.email}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs" style={{ color: u.companyName ? '#4a5568' : '#d0d5dd' }}>{u.companyName || '—'}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs" style={{ color: '#8a93a2' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs" style={{ color: '#8a93a2' }}>{u.spacesCount > 0 ? `${u.spacesCount} mur${u.spacesCount > 1 ? 's' : ''}` : '—'}</p>
                      </div>
                    </div>

                    <div className="md:hidden px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: tc.avatarBg }}>{initials}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{u.firstName} {u.lastName}</p>
                            {u.authMethods.map(m => {
                              const c = authMethodConfig[m]
                              return (
                                <span key={m} title={`Connexion ${c.label}`}
                                  className="inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: c.textBg, color: c.color }}>
                                  {c.icon}
                                </span>
                              )
                            })}
                          </div>
                          <p className="text-xs truncate" style={{ color: '#8a93a2' }}>{u.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                            {u.companyName && <span className="text-[10px]" style={{ color: '#8a93a2' }}>{u.companyName}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: '#8a93a2' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : ''}</span>
                    </div>
                  </div>
                )
              })}

              <div className="px-4 pb-3">
                <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>

        {(selectedUser && (!isMobile || showDetail)) && (
          <div className={`${isMobile ? 'w-full' : 'w-80'} flex-shrink-0`}>
            {isMobile && <button onClick={() => setShowDetail(false)} className="mb-4 text-sm font-medium flex items-center gap-2" style={{ color: '#2BBFB3' }}>← Retour à la liste</button>}
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 sticky top-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              {detailsLoading && (
                <p className="text-sm py-4 text-center" style={{ color: '#8a93a2' }}>Chargement du détail…</p>
              )}
              {detailsError && (
                <p className="text-sm py-4 text-center" style={{ color: '#ef4444' }}>{detailsError}</p>
              )}
              {!detailsLoading && !detailsError && fullDetails && (
                <UserDetailPanel user={selectedUser} fullDetails={fullDetails} onExport={handleExportRGPD} exporting={exporting} />
              )}
            </div>
          </div>
        )}

        {!selectedUser && !isMobile && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-3xl p-8 text-center sticky top-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <span className="text-3xl">👤</span>
              <p className="font-semibold mt-3" style={{ color: '#1a2b4a' }}>Sélectionnez un utilisateur</p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>pour voir son profil</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Panel détail utilisateur ─────────────────────────────────────
function UserDetailPanel({ user, fullDetails, onExport, exporting }) {
  const u = { ...user, ...fullDetails.user }
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: '#2BBFB3' }}>
          {`${u.firstName?.[0] || ''}${u.lastName?.[0] || u.email?.[0] || ''}`.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold truncate" style={{ color: '#1a2b4a' }}>{u.firstName} {u.lastName}</h3>
            {user.authMethods?.map(m => {
              const c = authMethodConfig[m]
              return (
                <span key={m} className="inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: c.textBg, color: c.color }}>
                  {c.icon}
                </span>
              )
            })}
          </div>
          <p className="text-xs" style={{ color: '#8a93a2' }}>
            {u.gender === 'male' ? '♂' : u.gender === 'female' ? '♀' : '·'} · ID #{u.id}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Méthodes de connexion</p>
        <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
          {user.authMethods?.map(m => {
            const c = authMethodConfig[m]
            return (
              <div key={m} className="flex items-center gap-2 mb-1 last:mb-0">
                <span className="inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ width: '22px', height: '22px', borderRadius: '4px', backgroundColor: c.textBg, color: c.color }}>
                  {c.icon}
                </span>
                <span className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>{c.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Abonnement</p>
        <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>{typeConfig[user.userType]?.label || 'Inconnu'}</span>
            {fullDetails.usedCode && (
              <span className="text-xs px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>Actif</span>
            )}
          </div>
          {user.companyName && (
            <p className="text-xs" style={{ color: '#8a93a2' }}>Partenaire : {user.companyName}</p>
          )}
          {fullDetails.usedCode && (
            <p className="text-xs mt-1 font-mono" style={{ color: '#8a93a2' }}>
              Code : <span style={{ color: '#1a2b4a' }}>{fullDetails.usedCode.code}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Activité</p>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Inscription</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>
                {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}
              </td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Genre</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>
                {u.gender === 'male' ? 'Homme' : u.gender === 'female' ? 'Femme' : '—'}
              </td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Murs</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>{fullDetails.stats.spacesCount}</td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Publications</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>{fullDetails.stats.postsCount}</td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Réactions</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>{fullDetails.stats.reactionsCount}</td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Alertes</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>{fullDetails.stats.alertsCount}</td>
            </tr>
            <tr>
              <td className="py-1" style={{ color: '#8a93a2' }}>Push activé</td>
              <td className="py-1 text-right" style={{ color: '#1a2b4a' }}>{u.hasFcmToken ? 'Oui' : 'Non'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="mb-4">
        <summary className="text-xs uppercase tracking-wider font-semibold cursor-pointer mb-2" style={{ color: '#8a93a2' }}>
          Détails techniques
        </summary>
        <div className="rounded-xl p-3 font-mono text-xs leading-relaxed" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
          user_id : {u.id}<br/>
          firebase_id : {u.firebaseId || '—'}<br/>
          created_at : {u.created_at}<br/>
          push_active : {u.hasFcmToken ? 'oui' : 'non'}
        </div>
      </details>

      <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#f4f5f7' }}>
        <button onClick={onExport} disabled={exporting}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
          {exporting ? 'Export...' : 'Export RGPD'}
        </button>
      </div>
    </div>
  )
}

// ─── Générateur HTML RGPD (champs safe uniquement) ────────────────
function generateRGPDhtml(user, details, postDocs, reactionImages, dateExport) {
  const esc = v => v === null || v === undefined ? '—' : String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const section = (title, content) => `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:16px;color:#2BBFB3;border-bottom:2px solid #e8f8f7;padding-bottom:6px;margin-bottom:12px;">${title}</h2>
      ${content}
    </div>`

  const row = (label, value) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f4f5f7;">
      <span style="color:#8a93a2;font-size:13px;">${label}</span>
      <span style="color:#1a2b4a;font-size:13px;font-weight:500;text-align:right;max-width:60%;">${esc(value)}</span>
    </div>`

  const table = (headers, rows) => {
    if (rows.length === 0) return '<p style="color:#8a93a2;font-size:13px;font-style:italic;">Aucune donnée</p>'
    return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
      <thead><tr>${headers.map(h => `<th style="text-align:left;padding:6px 8px;background:#f8fafb;color:#8a93a2;font-weight:600;border-bottom:1px solid #eef0f2;">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px 8px;border-bottom:1px solid #f4f5f7;color:#1a2b4a;">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`
  }

  const authSummary = []
  if (user.hasGoogleOauth) authSummary.push('Google')
  if (user.hasFacebookOauth) authSummary.push('Facebook')
  if (authSummary.length === 0) authSummary.push('Email / Mot de passe')

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Export RGPD — ${esc(user.firstName)} ${esc(user.lastName)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a2b4a;max-width:800px;margin:0 auto;padding:40px 32px;}
  @media print{body{padding:20px;}}
  h1{font-size:22px;margin-bottom:4px;}
  .subtitle{color:#8a93a2;font-size:13px;margin-bottom:32px;}
  .legal{background:#f8fafb;border-radius:12px;padding:16px;margin-bottom:32px;font-size:12px;color:#4a5568;line-height:1.6;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #f4f5f7;text-align:center;font-size:11px;color:#8a93a2;}
</style></head><body>

<h1>Export des données personnelles</h1>
<p class="subtitle">${esc(user.firstName)} ${esc(user.lastName)} · Généré le ${dateExport}</p>

<div class="legal">
  <strong>RGPD — Articles 15 et 20</strong><br/>
  Ce document contient les données personnelles de l'utilisateur stockées par Héka, conformément au droit d'accès (article 15) et au droit à la portabilité (article 20) du Règlement Général sur la Protection des Données. Les jetons techniques (mot de passe, tokens push, identifiants OAuth bruts) ne sont pas inclus pour des raisons de sécurité.
</div>

${section('1. Profil utilisateur', `
  ${row('ID', user.id)}
  ${row('Prénom', user.firstName)}
  ${row('Nom', user.lastName)}
  ${row('Nom complet', user.name)}
  ${row('Email', user.email)}
  ${row('Genre', user.gender)}
  ${row('Date d\'inscription', fmtDate(user.created_at))}
  ${row('Photo de profil', user.photo?.url || user.photo || '—')}
  ${row('Méthode(s) d\'authentification', authSummary.join(', '))}
  ${row('Firebase ID', user.firebaseId)}
  ${row('Notifications push', user.hasFcmToken ? 'Activées' : 'Désactivées')}
`)}

${section('2. Code d\'activation partenaire', details.usedCode ? `
  ${row('Code', details.usedCode.code)}
  ${row('Date d\'activation', fmtDate(details.usedCode.activationDateTime))}
  ${row('Partenaire ID', details.usedCode.partnerId || details.usedCode.partner_id)}
  ${row('Plan ID', details.usedCode.planId)}
` : '<p style="color:#8a93a2;font-size:13px;font-style:italic;">Aucun code partenaire utilisé</p>')}

${section('3. Fiche bénéficiaire', details.beneficiary ? `
  ${row('Partenaire ID', details.beneficiary.partner_id)}
  ${row('Prénom', details.beneficiary.first_name)}
  ${row('Nom', details.beneficiary.last_name)}
  ${row('Email', details.beneficiary.email)}
  ${row('Date d\'envoi', fmtDate(details.beneficiary.sent_at))}
` : '<p style="color:#8a93a2;font-size:13px;font-style:italic;">Aucune fiche bénéficiaire</p>')}

${section('4. Espaces de souvenir (murs)', table(
  ['ID', 'Prénom défunt', 'Nom défunt', 'Date de décès', 'Code', 'Créé le'],
  details.userSpaces.map(s => [s.id, s.deceasedFirstName, s.deceasedLastName, fmtDate(s.deathDate), s.code, fmtDate(s.created_at)])
))}

${section('5. Publications', table(
  ['ID', 'Espace ID', 'Type', 'Contenu (extrait)', 'Modérateur ID', 'Refusé', 'Créé le'],
  details.userPosts.map(p => [p.id, p.spaceId, p.type, (p.content || '').substring(0, 80) + ((p.content || '').length > 80 ? '...' : ''), p.approverId || '—', p.refused ? 'Oui' : 'Non', fmtDate(p.created_at)])
))}

${section('6. Documents joints aux publications', table(
  ['ID', 'Publication ID', 'Fichier', 'Thumbnail', 'Créé le'],
  postDocs.map(d => [d.id, d.posts_id, d.file?.url || d.file || '—', d.thumbnail?.url || d.thumbnail || '—', fmtDate(d.created_at)])
))}

${section('7. Réactions / Commentaires', table(
  ['ID', 'Publication ID', 'Type', 'Contenu', 'Créé le'],
  details.userReactions.map(r => [r.id, r.postId, r.type, (r.content || '').substring(0, 100), fmtDate(r.created_at)])
))}

${section('8. Images de réactions', table(
  ['ID', 'Réaction ID', 'Image', 'Créé le'],
  reactionImages.map(i => [i.id, i.post_reactions_id, i.image?.url || i.image || '—', fmtDate(i.created_at)])
))}

${section('9. Alertes / Signalements', table(
  ['ID', 'Raison', 'Comment ID', 'Réaction ID', 'IA Message ID', 'Créé le'],
  details.userAlerts.map(a => [a.id, a.reason, a.sessionCommentId || '—', a.postReactionId || '—', a.aiMessageId || '—', fmtDate(a.created_at)])
))}

<div class="footer">
  <p>Document généré le ${dateExport} depuis le CMS Héka</p>
  <p>Conformément au RGPD (Règlement UE 2016/679) — Articles 15 et 20</p>
  <p style="margin-top:8px;">Héka · Accompagnement du deuil</p>
</div>

</body></html>`
}

// Export non utilisé en runtime mais conservé pour cohérence (sanitizeForDisplay
// peut servir si on ajoute un drawer JSON détaillé en U4).
export { sanitizeForDisplay }
