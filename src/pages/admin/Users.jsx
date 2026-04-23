import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
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

export default function Users() {
  const [users, setUsers] = useState([])
  const [codes, setCodes] = useState([])
  const [spaces, setSpaces] = useState([])
  const [posts, setPosts] = useState([])
  const [reactions, setReactions] = useState([])
  const [partners, setPartners] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [selectedUser, setSelectedUser] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { toast, showToast, clearToast } = useToast()
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768)
    c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c)
  }, [])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [u, c, s, po, r, pa, b, a] = await Promise.all([
          xano.getAll('users'),
          xano.getAll('plan-activation-code'),
          xano.getAll('spaces'),
          xano.getAll('posts'),
          xano.getAll('post-reactions'),
          xano.getAll('partners'),
          xano.getAll('beneficiaries'),
          xano.getAll('alerts'),
        ])
        setUsers(Array.isArray(u) ? u : u?.items || [])
        setCodes(Array.isArray(c) ? c : c?.items || [])
        setSpaces(Array.isArray(s) ? s : s?.items || [])
        setPosts(Array.isArray(po) ? po : po?.items || [])
        setReactions(Array.isArray(r) ? r : r?.items || [])
        setPartners(Array.isArray(pa) ? pa : pa?.items || [])
        setBeneficiaries(Array.isArray(b) ? b : b?.items || [])
        setAlerts(Array.isArray(a) ? a : a?.items || [])
      } catch (err) { console.error('Erreur chargement:', err) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  // ─── Enrichir les users avec type et entreprise ───
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

      // Note: "paying" sera activé quand la table subscriptions sera prête
      // Pour l'instant on ne peut pas déterminer les payants

      const userSpaces = spaces.filter(s => s.ownerId === u.id)
      const userPosts = posts.filter(p => p.issuerId === u.id)

      return {
        ...u,
        userType,
        companyName,
        codeUsed: usedCode?.code || null,
        spacesCount: userSpaces.length,
        postsCount: userPosts.length,
      }
    })
  }, [users, codes, spaces, posts, partners, beneficiaries])

  // ─── Liste des entreprises pour le filtre ───
  const companyList = useMemo(() => {
    const names = [...new Set(enrichedUsers.filter(u => u.companyName).map(u => u.companyName))].sort()
    return names
  }, [enrichedUsers])

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = enrichedUsers.length
    const partnerCount = enrichedUsers.filter(u => u.userType === 'partner').length
    const payingCount = enrichedUsers.filter(u => u.userType === 'paying').length
    const freeCount = enrichedUsers.filter(u => u.userType === 'free').length
    const thisMonth = enrichedUsers.filter(u => {
      const d = new Date(u.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return { total, partnerCount, payingCount, freeCount, thisMonth }
  }, [enrichedUsers])

  // ─── Filtrage ───
  const filtered = useMemo(() => {
    let result = enrichedUsers

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      result = result.filter(u =>
        `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(s)
      )
    }

    if (typeFilter !== 'all') {
      result = result.filter(u => u.userType === typeFilter)
    }

    if (companyFilter !== 'all') {
      result = result.filter(u => u.companyName === companyFilter)
    }

    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      result = result.filter(u => new Date(u.created_at) >= cutoff)
    }

    // Tri
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
  }, [enrichedUsers, debouncedSearch, typeFilter, companyFilter, dateFilter, sortField, sortDir])

  const { paginated, page, totalPages, setPage, total } = usePagination(filtered, 25)

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const selectUser = u => { setSelectedUser(u); if (isMobile) setShowDetail(true) }

  // ─── Données détaillées pour le panel ───
  const selectedDetails = useMemo(() => {
    if (!selectedUser) return null
    const u = selectedUser
    const userSpaces = spaces.filter(s => s.ownerId === u.id)
    const userPosts = posts.filter(p => p.issuerId === u.id)
    const userReactions = reactions.filter(r => r.userId === u.id)
    const userAlerts = alerts.filter(a => a.sourceId === u.id)
    const usedCode = codes.find(c => c.usedBy === u.id && c.used)
    const beneficiary = beneficiaries.find(b => b.email === u.email)
    return { userSpaces, userPosts, userReactions, userAlerts, usedCode, beneficiary }
  }, [selectedUser, spaces, posts, reactions, alerts, codes, beneficiaries])

  // ─── Export RGPD ───
  const handleExportRGPD = async () => {
    if (!selectedUser || !selectedDetails) return
    setExporting(true)
    try {
      const u = selectedUser
      const d = selectedDetails
      const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

      // Collecter les documents liés aux posts
      let postDocs = []
      try {
        const allDocs = await xano.getAll('posts-documents')
        const docs = Array.isArray(allDocs) ? allDocs : allDocs?.items || []
        const postIds = d.userPosts.map(p => p.id)
        postDocs = docs.filter(doc => postIds.includes(doc.posts_id))
      } catch (e) { console.error('Erreur chargement docs:', e) }

      // Collecter les images de réactions
      let reactionImages = []
      try {
        const allImages = await xano.getAll('post-reaction-images')
        const imgs = Array.isArray(allImages) ? allImages : allImages?.items || []
        const reactionIds = d.userReactions.map(r => r.id)
        reactionImages = imgs.filter(img => reactionIds.includes(img.post_reactions_id))
      } catch (e) { console.error('Erreur chargement images:', e) }

      const html = generateRGPDhtml(u, d, postDocs, reactionImages, now)
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      showToast('Export RGPD ouvert dans un nouvel onglet — utilisez Ctrl+P pour sauvegarder en PDF')
    } catch (err) { console.error(err); showToast('Erreur export', 'error') }
    finally { setExporting(false) }
  }

  // ─── Rendu ───
  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={6} /></div>

  const showCompanyFilter = typeFilter === 'all' || typeFilter === 'partner'

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Utilisateurs</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>{stats.total} utilisateur{stats.total > 1 ? 's' : ''} de l'application Héka</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: '#2BBFB3', delta: `+${stats.thisMonth} ce mois` },
          { label: 'Payants', value: stats.payingCount, color: '#1a2b4a', delta: stats.total ? `${Math.round(stats.payingCount / stats.total * 100)}%` : '0%' },
          { label: 'Code partenaire', value: stats.partnerCount, color: '#d97706', delta: stats.total ? `${Math.round(stats.partnerCount / stats.total * 100)}%` : '0%' },
          { label: 'Gratuits / Essai', value: stats.freeCount, color: '#8a93a2', delta: stats.total ? `${Math.round(stats.freeCount / stats.total * 100)}%` : '0%' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 md:p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl md:text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{s.label}</p>
            <span className="text-xs px-2 py-0.5 rounded-lg mt-1 inline-block" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>{s.delta}</span>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, email..." />
        </div>

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setCompanyFilter('all'); setPage(1) }}
          className="px-3 py-3 rounded-2xl text-sm outline-none"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
          <option value="all">Tous les types</option>
          <option value="paying">Payant</option>
          <option value="partner">Code partenaire</option>
          <option value="free">Gratuit / Essai</option>
        </select>

        {showCompanyFilter && companyList.length > 0 && (
          <select
            value={companyFilter}
            onChange={e => { setCompanyFilter(e.target.value); setPage(1) }}
            className="px-3 py-3 rounded-2xl text-sm outline-none"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
            <option value="all">Toutes les entreprises</option>
            {companyList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1) }}
          className="px-3 py-3 rounded-2xl text-sm outline-none"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
          {dateFilters.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>

      {/* Layout table + panel */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">

        {/* Table */}
        <div className={`flex-1 min-w-0 ${isMobile && showDetail ? 'hidden' : ''}`}>
          {paginated.length === 0 ? (
            <EmptyState icon="👤" title="Aucun utilisateur" message="Aucun utilisateur ne correspond à vos filtres" />
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              {/* Header table — desktop */}
              <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 140px 150px 120px 80px', borderBottom: '1px solid #f4f5f7', backgroundColor: '#fafbfc' }}>
                {[
                  { label: 'Utilisateur', field: 'name' },
                  { label: 'Type', field: 'userType' },
                  { label: 'Entreprise', field: null },
                  { label: 'Inscription', field: 'created_at' },
                  { label: 'Murs', field: null },
                ].map(col => (
                  <div key={col.label}
                    onClick={col.field ? () => toggleSort(col.field) : undefined}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: sortField === col.field ? '#2BBFB3' : '#8a93a2', cursor: col.field ? 'pointer' : 'default' }}>
                    {col.label} {col.field && (sortField === col.field ? (sortDir === 'asc' ? '↑' : '↓') : '↕')}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {paginated.map(u => {
                const tc = typeConfig[u.userType] || typeConfig.free
                const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || u.email?.[0] || ''}`.toUpperCase()
                return (
                  <div key={u.id}
                    onClick={() => selectUser(u)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    style={{
                      borderBottom: '1px solid #f4f5f7',
                      backgroundColor: selectedUser?.id === u.id ? '#f0faf9' : 'transparent',
                    }}>
                    {/* Desktop row */}
                    <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 140px 150px 120px 80px' }}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tc.avatarBg }}>{initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{u.firstName} {u.lastName}</p>
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

                    {/* Mobile row */}
                    <div className="md:hidden px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: tc.avatarBg }}>{initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{u.firstName} {u.lastName}</p>
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

        {/* Panel latéral */}
        {(selectedUser && (!isMobile || showDetail)) && (
          <div className={`${isMobile ? 'w-full' : 'w-80'} flex-shrink-0`}>
            {isMobile && <button onClick={() => setShowDetail(false)} className="mb-4 text-sm font-medium flex items-center gap-2" style={{ color: '#2BBFB3' }}>← Retour à la liste</button>}
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 sticky top-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>

              {/* Header */}
              <div className="text-center mb-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3" style={{ backgroundColor: typeConfig[selectedUser.userType]?.avatarBg || '#2BBFB3' }}>
                  {`${selectedUser.firstName?.[0] || ''}${selectedUser.lastName?.[0] || ''}`.toUpperCase()}
                </div>
                <h2 className="font-bold text-lg" style={{ color: '#1a2b4a' }}>{selectedUser.firstName} {selectedUser.lastName}</h2>
                <p className="text-sm" style={{ color: '#8a93a2' }}>{selectedUser.email}</p>
                <span className="text-xs px-3 py-1 rounded-lg font-medium inline-block mt-2" style={{ backgroundColor: typeConfig[selectedUser.userType]?.bg, color: typeConfig[selectedUser.userType]?.color }}>
                  {typeConfig[selectedUser.userType]?.label}
                </span>
              </div>

              {/* Informations */}
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: '#8a93a2' }}>Informations</p>
              {[
                { label: 'Inscription', value: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                { label: 'Genre', value: selectedUser.gender || 'Non précisé' },
                ...(selectedUser.companyName ? [{ label: 'Entreprise (via code)', value: selectedUser.companyName }] : []),
                ...(selectedUser.codeUsed ? [{ label: 'Code utilisé', value: selectedUser.codeUsed, mono: true }] : []),
                { label: 'ID utilisateur', value: `#${selectedUser.id}` },
              ].map(i => (
                <div key={i.label} className="rounded-xl p-3 mb-2" style={{ backgroundColor: '#f8fafb' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8a93a2' }}>{i.label}</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: '#1a2b4a', fontFamily: i.mono ? 'monospace' : 'inherit', letterSpacing: i.mono ? '1px' : 'normal' }}>{i.value}</p>
                </div>
              ))}

              {/* Murs du souvenir */}
              {selectedDetails?.userSpaces.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: '#8a93a2' }}>Murs du souvenir</p>
                  {selectedDetails.userSpaces.map(s => (
                    <div key={s.id} className="rounded-xl p-3 mb-2" style={{ backgroundColor: '#f8fafb' }}>
                      <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>En mémoire de {s.deceasedFirstName} {s.deceasedLastName}</p>
                      <p className="text-xs mt-1" style={{ color: '#8a93a2' }}>
                        Créé le {new Date(s.created_at).toLocaleDateString('fr-FR')} · {posts.filter(p => p.spaceId === s.id).length} publication{posts.filter(p => p.spaceId === s.id).length > 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </>
              )}

              {/* Activité */}
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: '#8a93a2' }}>Activité</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafb' }}>
                  <p className="text-lg font-bold" style={{ color: '#2BBFB3' }}>{selectedDetails?.userPosts.length || 0}</p>
                  <p className="text-[10px]" style={{ color: '#8a93a2' }}>Publications</p>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafb' }}>
                  <p className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{selectedDetails?.userReactions.length || 0}</p>
                  <p className="text-[10px]" style={{ color: '#8a93a2' }}>Réactions</p>
                </div>
              </div>

              {/* Bouton export RGPD */}
              <button
                onClick={handleExportRGPD}
                disabled={exporting}
                className="w-full py-3 rounded-2xl text-sm font-semibold mt-5 transition-all"
                style={{
                  backgroundColor: exporting ? '#f4f5f7' : 'white',
                  color: exporting ? '#8a93a2' : '#1a2b4a',
                  border: '1px solid #1a2b4a',
                }}>
                {exporting ? 'Génération en cours...' : '📄 Exporter les données (RGPD)'}
              </button>
            </div>
          </div>
        )}

        {/* Placeholder quand rien sélectionné — desktop */}
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

// ─── Générateur HTML RGPD ───────────────────────────
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

  // Authentification
  const authMethod = user.google_oauth?.email ? 'Google OAuth' : user.facebook_oauth?.email ? 'Facebook OAuth' : 'Email / Mot de passe'

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
  Ce document contient l'intégralité des données personnelles de l'utilisateur stockées par Héka, conformément au droit d'accès (article 15) et au droit à la portabilité (article 20) du Règlement Général sur la Protection des Données.
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
  ${row('Méthode d\'authentification', authMethod)}
  ${row('Firebase ID', user.firebaseId)}
  ${row('Tokens FCM (push)', user.fcmTokens?.length ? user.fcmTokens.join(', ') : '—')}
  ${row('Magic Link — Token', user.magic_link?.token || '—')}
  ${row('Magic Link — Expiration', fmtDate(user.magic_link?.expiration))}
  ${row('Magic Link — Utilisé', user.magic_link?.used === true ? 'Oui' : user.magic_link?.used === false ? 'Non' : '—')}
  ${user.google_oauth?.email ? row('Google OAuth — Email', user.google_oauth.email) : ''}
  ${user.google_oauth?.name ? row('Google OAuth — Nom', user.google_oauth.name) : ''}
  ${user.google_oauth?.id ? row('Google OAuth — ID', user.google_oauth.id) : ''}
  ${user.facebook_oauth?.email ? row('Facebook OAuth — Email', user.facebook_oauth.email) : ''}
  ${user.facebook_oauth?.name ? row('Facebook OAuth — Nom', user.facebook_oauth.name) : ''}
  ${user.facebook_oauth?.id ? row('Facebook OAuth — ID', user.facebook_oauth.id) : ''}
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
  ${row('Département', details.beneficiary.department)}
  ${row('Code', details.beneficiary.code)}
  ${row('Statut', details.beneficiary.status)}
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