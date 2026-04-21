import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { SearchInput, useDebounce, usePagination, Pagination, SkeletonList, EmptyState, timeAgo } from '../../components/SharedUI'

// ─── Config des types d'activité ──────────────────
const ACTIVITY_TYPES = {
  crm: {
    label: 'CRM',
    color: '#2BBFB3',
    bg: '#e8f8f7',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M1 13L4 9l3 2 3-4 4 5M1 11V3h14v10" stroke="#2BBFB3" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  request: {
    label: 'Demandes',
    color: '#f59e0b',
    bg: '#fef3c7',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  code: {
    label: 'Codes',
    color: '#8b5cf6',
    bg: '#ede9fe',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="5" width="10" height="7" rx="2" stroke="#8b5cf6" strokeWidth="1.3"/>
        <circle cx="7" cy="8.5" r="1.2" fill="#8b5cf6"/>
      </svg>
    ),
  },
  send: {
    label: 'Envois',
    color: '#3b82f6',
    bg: '#dbeafe',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 3l12 5-12 5V9l8-1-8-1V3z" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  access: {
    label: 'Accès',
    color: '#ef4444',
    bg: '#fee2e2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M8 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM13 7v4M15 9h-4" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
}

const DATE_FILTERS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: 'Tout', value: 'all' },
]

// ─── Normaliser les activités depuis les tables ───
function normalizeActivities(crmActivities, requests, codes, beneficiaries, members, partners) {
  const partnerMap = {}
  partners.forEach(p => { partnerMap[p.id] = p.name })

  const activities = []

  // CRM activities
  crmActivities.forEach(a => {
    activities.push({
      id: `crm-${a.id}`,
      type: 'crm',
      label: `Activité CRM — ${a.activity_type || 'note'}`,
      detail: `${partnerMap[a.partner_id] || 'Partenaire'} : ${a.note || ''}`.slice(0, 120),
      date: a.created_at || a.last_contact_at,
    })
  })

  // Requests
  requests.forEach(r => {
    const statusLabels = { pending: 'en attente', approved: 'approuvée', rejected: 'refusée', completed: 'terminée' }
    activities.push({
      id: `req-${r.id}`,
      type: 'request',
      label: `Demande ${r.request_type || 'codes'}`,
      detail: `${partnerMap[r.partner_id] || 'Partenaire'} — ${statusLabels[r.request_status] || r.request_status}${r.quantity ? ` — ${r.quantity} codes` : ''}`,
      date: r.created_at,
    })
  })

  // Codes — groupés par partnerId + date (même jour)
  const codesByPartnerDay = {}
  codes.forEach(c => {
    const pid = c.partnerId?.id || c.partnerId || 'unknown'
    const day = c.created_at ? new Date(c.created_at).toDateString() : 'unknown'
    const key = `${pid}-${day}`
    if (!codesByPartnerDay[key]) codesByPartnerDay[key] = { partnerId: pid, date: c.created_at, count: 0 }
    codesByPartnerDay[key].count++
  })
  Object.values(codesByPartnerDay).forEach(g => {
    activities.push({
      id: `code-${g.partnerId}-${g.date}`,
      type: 'code',
      label: `${g.count} code${g.count > 1 ? 's' : ''} généré${g.count > 1 ? 's' : ''}`,
      detail: partnerMap[g.partnerId] || 'Partenaire',
      date: g.date,
    })
  })

  // Beneficiary sends
  beneficiaries.filter(b => b.status === 'sent' || b.sent_at).forEach(b => {
    activities.push({
      id: `send-${b.id}`,
      type: 'send',
      label: `Code envoyé`,
      detail: `${b.first_name || ''} ${b.last_name || ''} (${b.email || ''}) — ${partnerMap[b.partner_id] || 'Partenaire'}`,
      date: b.sent_at || b.created_at,
    })
  })

  // Partner members created
  members.forEach(m => {
    activities.push({
      id: `access-${m.id}`,
      type: 'access',
      label: `Compte partenaire créé`,
      detail: `${m.user_email} — rôle : ${m.role || 'member'}`,
      date: m.created_at,
    })
  })

  // Tri par date décroissante
  return activities
    .filter(a => a.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ─── Composant principal ──────────────────────────
export default function ActivityLog() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('30d')

  const debouncedSearch = useDebounce(search)

  // Fetch all data
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [crm, requests, codes, beneficiaries, members, partners] = await Promise.all([
          xano.getAll('crm_activity'),
          xano.getAll('code_request'),
          xano.getAll('plan-activation-code'),
          xano.getAll('beneficiaries'),
          xano.getAll('partner_members'),
          xano.getAll('partners'),
        ])
        setActivities(normalizeActivities(crm, requests, codes, beneficiaries, members, partners))
      } catch (err) {
        console.error('Erreur chargement activités:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Filtrage
  const filtered = useMemo(() => {
    let result = activities

    // Filtre par type
    if (typeFilter !== 'all') {
      result = result.filter(a => a.type === typeFilter)
    }

    // Filtre par date
    if (dateFilter !== 'all') {
      const now = new Date()
      const cutoff = new Date()
      if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0)
      else if (dateFilter === '7d') cutoff.setDate(now.getDate() - 7)
      else if (dateFilter === '30d') cutoff.setDate(now.getDate() - 30)
      result = result.filter(a => new Date(a.date) >= cutoff)
    }

    // Filtre par recherche
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(a =>
        a.label.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q)
      )
    }

    return result
  }, [activities, typeFilter, dateFilter, debouncedSearch])

  const { paginated, page, totalPages, setPage, total } = usePagination(filtered, 30)

  // Stats par type
  const typeCounts = useMemo(() => {
    const counts = { crm: 0, request: 0, code: 0, send: 0, access: 0 }
    activities.forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++ })
    return counts
  }, [activities])

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Journal d'activité</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Traçabilité complète des actions</p>
        </div>
        <SkeletonList count={8} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Journal d'activité</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Traçabilité complète des actions</p>
      </div>

      {/* Stats par type */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {Object.entries(ACTIVITY_TYPES).map(([key, config]) => (
          <button key={key}
            onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
            className="bg-white rounded-2xl p-4 text-left transition-all"
            style={{
              boxShadow: '0 4px 24px rgba(43,191,179,0.06)',
              border: typeFilter === key ? `2px solid ${config.color}` : '2px solid transparent',
            }}>
            <p className="text-xl font-bold" style={{ color: config.color }}>{typeCounts[key]}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>{config.label}</p>
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Recherche */}
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher dans les activités..." />
          </div>

          {/* Filtre date */}
          <div className="flex gap-1.5 flex-shrink-0">
            {DATE_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => setDateFilter(f.value)}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  backgroundColor: dateFilter === f.value ? '#2BBFB3' : '#f4f5f7',
                  color: dateFilter === f.value ? 'white' : '#8a93a2',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtre type (pills) */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              backgroundColor: typeFilter === 'all' ? '#1a2b4a' : '#f4f5f7',
              color: typeFilter === 'all' ? 'white' : '#8a93a2',
            }}>
            Toutes
          </button>
          {Object.entries(ACTIVITY_TYPES).map(([key, config]) => (
            <button key={key}
              onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: typeFilter === key ? config.bg : '#f4f5f7',
                color: typeFilter === key ? config.color : '#8a93a2',
              }}>
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des activités */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Aucune activité trouvée"
          message="Aucune activité ne correspond à vos filtres."
        />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          {paginated.map((activity, idx) => {
            const config = ACTIVITY_TYPES[activity.type]
            return (
              <div key={activity.id}
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
                style={{ borderBottom: idx < paginated.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                {/* Icône type */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: config.bg }}>
                  {config.icon}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>
                      {activity.label}
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                      style={{ backgroundColor: config.bg, color: config.color }}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: '#8a93a2' }}>
                    {activity.detail}
                  </p>
                </div>

                {/* Timestamp */}
                <p className="text-xs flex-shrink-0 mt-0.5" style={{ color: '#b0b7c3' }}>
                  {timeAgo(activity.date)}
                </p>
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