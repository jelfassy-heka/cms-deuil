import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { SearchInput, useDebounce, usePagination, Pagination, SkeletonList, EmptyState, CopyButton, exportToCSV } from '../../components/SharedUI'

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#d97706', bg: '#fef3c7' },
  sent: { label: 'Envoyé', color: '#2BBFB3', bg: '#e8f8f7' },
  activated: { label: 'Activé', color: '#1a2b4a', bg: '#e8f0fe' },
}

export default function AllBeneficiaries() {
  const [beneficiaries, setBeneficiaries] = useState([])
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPartner, setFilterPartner] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const debouncedSearch = useDebounce(search)

  // Fetch all data
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [benefs, parts] = await Promise.all([
          xano.getAll('beneficiaries'),
          xano.getAll('partners'),
        ])
        setBeneficiaries(benefs)
        setPartners(parts)
      } catch (err) {
        console.error('Erreur chargement salariés:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Map partenaire id → nom
  const partnerMap = useMemo(() => {
    const map = {}
    partners.forEach(p => { map[p.id] = p.name })
    return map
  }, [partners])

  // Stats
  const stats = useMemo(() => ({
    total: beneficiaries.length,
    pending: beneficiaries.filter(b => !b.status || b.status === 'pending').length,
    sent: beneficiaries.filter(b => b.status === 'sent').length,
    activated: beneficiaries.filter(b => b.status === 'activated').length,
  }), [beneficiaries])

  // Filtrage
  const filtered = useMemo(() => {
    let result = beneficiaries

    if (filterPartner !== 'all') {
      result = result.filter(b => String(b.partner_id) === String(filterPartner))
    }

    if (filterStatus !== 'all') {
      result = result.filter(b => {
        if (filterStatus === 'pending') return !b.status || b.status === 'pending'
        return b.status === filterStatus
      })
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(b =>
        [b.first_name, b.last_name, b.email, b.department, partnerMap[b.partner_id]]
          .filter(Boolean).some(f => f.toLowerCase().includes(q))
      )
    }

    return result.sort((a, b) => {
      const dateA = a.sent_at || a.created_at || ''
      const dateB = b.sent_at || b.created_at || ''
      return new Date(dateB) - new Date(dateA)
    })
  }, [beneficiaries, filterPartner, filterStatus, debouncedSearch, partnerMap])

  const { paginated, page, totalPages, setPage, total } = usePagination(filtered, 30)

  // Export CSV
  const handleExport = () => {
    const data = filtered.map(b => ({
      ...b,
      partner_name: partnerMap[b.partner_id] || '',
      status_label: STATUS_CONFIG[b.status]?.label || 'En attente',
    }))
    exportToCSV(data, 'tous-les-salaries', [
      { key: 'first_name', label: 'Prénom' },
      { key: 'last_name', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Service' },
      { key: 'partner_name', label: 'Partenaire' },
      { key: 'code', label: 'Code' },
      { key: 'status_label', label: 'Statut' },
      { key: 'sent_at', label: 'Envoyé le' },
    ])
  }

  // Partenaires ayant des bénéficiaires (pour le filtre)
  const partnerOptions = useMemo(() => {
    const ids = new Set(beneficiaries.map(b => b.partner_id))
    return partners.filter(p => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [beneficiaries, partners])

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Tous les salariés</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Vue consolidée de tous les bénéficiaires</p>
        </div>
        <SkeletonList count={8} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Tous les salariés</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Vue consolidée de tous les bénéficiaires</p>
        </div>
        <button onClick={handleExport}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
          📥 Exporter CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: '#1a2b4a' },
          { label: 'En attente', value: stats.pending, color: '#d97706' },
          { label: 'Envoyés', value: stats.sent, color: '#2BBFB3' },
          { label: 'Activés', value: stats.activated, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4"
            style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: '#8a93a2' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Recherche */}
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, email, partenaire..." />
          </div>

          {/* Filtre partenaire */}
          <select
            value={filterPartner}
            onChange={e => setFilterPartner(e.target.value)}
            className="px-3 py-3 rounded-2xl text-sm outline-none flex-shrink-0"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', minWidth: '180px' }}>
            <option value="all">Tous les partenaires</option>
            {partnerOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Filtre statut (pills) */}
        <div className="flex gap-1.5 mt-3">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'pending', label: 'En attente' },
            { key: 'sent', label: 'Envoyés' },
            { key: 'activated', label: 'Activés' },
          ].map(f => (
            <button key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: filterStatus === f.key ? '#1a2b4a' : '#f4f5f7',
                color: filterStatus === f.key ? 'white' : '#8a93a2',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Aucun salarié trouvé"
          message="Aucun salarié ne correspond à vos filtres."
        />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          {/* Header tableau */}
          <div className="hidden sm:grid px-5 py-3 text-xs font-semibold"
            style={{
              backgroundColor: '#f4f5f7',
              color: '#8a93a2',
              gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr',
            }}>
            <span>Nom</span>
            <span>Email</span>
            <span>Partenaire</span>
            <span>Code</span>
            <span>Statut</span>
          </div>

          {/* Lignes */}
          {paginated.map((b, idx) => {
            const status = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
            return (
              <div key={b.id}
                className="flex sm:grid items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                style={{
                  borderBottom: idx < paginated.length - 1 ? '1px solid #f4f5f7' : 'none',
                  gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr',
                }}>
                {/* Nom avec avatar */}
                <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                    style={{ backgroundColor: b.status === 'sent' || b.status === 'activated' ? '#8a93a2' : '#2BBFB3' }}>
                    {(b.first_name?.[0] || '').toUpperCase()}{(b.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>
                      {b.first_name} {b.last_name}
                    </p>
                    {/* Email mobile */}
                    <p className="text-xs truncate sm:hidden" style={{ color: '#8a93a2' }}>
                      {b.email}
                    </p>
                  </div>
                </div>

                {/* Email desktop */}
                <p className="text-sm truncate hidden sm:block" style={{ color: '#8a93a2' }}>
                  {b.email}
                </p>

                {/* Partenaire */}
                <p className="text-sm truncate hidden sm:block" style={{ color: '#1a2b4a' }}>
                  {partnerMap[b.partner_id] || '—'}
                </p>

                {/* Code */}
                <div className="hidden sm:flex items-center gap-1">
                  {b.code ? (
                    <>
                      <span className="text-xs font-medium" style={{ fontFamily: 'monospace', color: '#1a2b4a' }}>
                        {b.code}
                      </span>
                      <CopyButton text={b.code} />
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: '#d1d5db' }}>—</span>
                  )}
                </div>

                {/* Statut */}
                <span className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
                  style={{ backgroundColor: status.bg, color: status.color }}>
                  {status.label}
                </span>
              </div>
            )
          })}

          <div className="px-5 pb-3">
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}