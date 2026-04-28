import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import xano from '../../lib/xano'
import { SparklineChart, buildSparklineData } from '../../components/SharedUI'
import Partners from './Partners'
import CRM from './CRM'
import Users from './Users'
import CodeGenerator from './CodeGenerator'
import Requests from './Requests'
import AdminAccounts from './AdminAccounts'
import ActivityLog from './ActivityLog'
import AllBeneficiaries from './AllBeneficiaries'
import Analytics from './Analytics'
import NotificationCenter from './NotificationCenter'
import GlobalSearch from './GlobalSearch'
import Cocon from './Cocon'

const APP_USERS_URL = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8/app-users'

const navItems = [
  { label: 'Tableau de bord', icon: 'dashboard', path: 'dashboard' },
  { label: 'Partenaires', icon: 'partners', path: 'partners' },
  { label: 'Demandes', icon: 'requests', path: 'requests' },
  { label: 'CRM', icon: 'crm', path: 'crm' },
  { label: 'Utilisateurs', icon: 'users', path: 'users' },
  { label: 'Tous les salariés', icon: 'beneficiaries', path: 'all-beneficiaries' },
  { label: 'Cocon', icon: 'cocon', path: 'cocon' },
  { label: 'Générateur de codes', icon: 'codes', path: 'codes' },
  { label: 'Gestion des accès', icon: 'accounts', path: 'accounts' },
  { label: 'Analytics', icon: 'analytics', path: 'analytics' },
  { label: 'Journal d\'activité', icon: 'activity', path: 'activity-log' },
]

// ─── Icônes SVG nav ───────────────────────────────
function NavIcon({ icon, active }) {
  const color = active ? 'white' : '#8a93a2'
  switch (icon) {
    case 'dashboard':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill={color}/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" fill={color}/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" fill={color}/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" fill={color}/>
        </svg>
      )
    case 'partners':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M8 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM13 7v4M15 9h-4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )
    case 'requests':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )
    case 'crm':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M1 13L4 9l3 2 3-4 4 5M1 11V3h14v10" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'users':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M9.5 1a2.5 2.5 0 0 1 0 5M12 14v-1.5a2.5 2.5 0 0 0-1.5-2.3M6 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )
    case 'codes':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.3"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )
    case 'accounts':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7" width="10" height="7" rx="2" stroke={color} strokeWidth="1.3"/>
          <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="10.5" r="1" fill={color}/>
        </svg>
      )
    case 'activity':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 2v12h12" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 10l3-3 2 2 4-5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'beneficiaries':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1 14v-1.5A2.5 2.5 0 0 1 3.5 10h5A2.5 2.5 0 0 1 11 12.5V14" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M12 2v5M14.5 4.5h-5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )
    case 'analytics':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="9" width="3" height="5" rx="1" fill={color}/>
          <rect x="6" y="5" width="3" height="9" rx="1" fill={color}/>
          <rect x="11" y="2" width="3" height="12" rx="1" fill={color}/>
        </svg>
      )
    case 'cocon':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 7c0 4-5 7-5 7Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return null
  }
}

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // ─── Datasets centralisés ─────────────────────────
  const [datasets, setDatasets] = useState({
    partners: [],
    codes: [],
    requests: [],
    users: [],
    contracts: [],
    beneficiaries: [],
    members: [],
  })

  // Stats calculées depuis les datasets
  const stats = useMemo(() => ({
    partners: datasets.partners.filter(p => p.crm_status === 'client actif').length,
    codes: datasets.codes.length,
    pending: datasets.requests.filter(r => r.request_status === 'pending').length,
    users: datasets.users.length,
    codesUsed: datasets.codes.filter(c => c.used).length,
    activationRate: datasets.codes.length > 0 ? Math.round(datasets.codes.filter(c => c.used).length / datasets.codes.length * 100) : 0,
  }), [datasets])

  // Sparklines calculées depuis les datasets
  const sparklines = useMemo(() => ({
    partners: buildSparklineData(datasets.partners.filter(p => p.crm_status === 'client actif'), 'created_at', 7),
    codes: buildSparklineData(datasets.codes, 'created_at', 7),
    requests: buildSparklineData(datasets.requests.filter(r => r.request_status === 'pending'), 'created_at', 7),
    users: buildSparklineData(datasets.users, 'created_at', 7),
  }), [datasets])

  // Deltas 7 jours
  const deltas = useMemo(() => {
    const calcDelta = (items, dateField = 'created_at', filterFn = null) => {
      const now = new Date()
      const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
      const filtered = filterFn ? items.filter(filterFn) : items
      const recent = filtered.filter(i => i[dateField] && new Date(i[dateField]) > d7).length
      return recent
    }
    return {
      partners: calcDelta(datasets.partners, 'created_at', p => p.crm_status === 'client actif'),
      codes: calcDelta(datasets.codes),
      requests: calcDelta(datasets.requests, 'created_at', r => r.request_status === 'pending'),
      users: calcDelta(datasets.users),
    }
  }, [datasets])

  // Fetch all datasets
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [partners, codes, requests, users, contracts, beneficiaries, members] = await Promise.all([
          xano.getAll('partners'),
          xano.getAll('plan-activation-code'),
          xano.getAll('code_request'),
          fetch(APP_USERS_URL).then(r => r.json()),
          xano.getAll('contracts').catch(() => []),
          xano.getAll('beneficiaries').catch(() => []),
          xano.getAll('partner_members').catch(() => []),
        ])
        setDatasets({ partners, codes, requests, users, contracts, beneficiaries, members })
      } catch (err) {
        console.error('Erreur chargement données:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Polling notifications (refresh datasets toutes les 60s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [requests, users, codes] = await Promise.all([
          xano.getAll('code_request'),
          fetch(APP_USERS_URL).then(r => r.json()),
          xano.getAll('plan-activation-code'),
        ])
        setDatasets(prev => ({ ...prev, requests, users, codes }))
      } catch { /* silencieux */ }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Détecter mobile et fermer sidebar automatiquement
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleNavClick = (path) => {
    setActivePage(path)
    if (isMobile) setMobileMenuOpen(false)
  }

  // Callback pour la recherche globale
  const handleSearchSelect = (action, _id, _raw, _sourceKey) => {
    setActivePage(action)
    // On pourrait ouvrir une modale ici selon le type
  }

  // ─── Stat cards config ────────────────────────────
  const statCards = [
    { key: 'partners', label: 'Partenaires actifs', value: stats.partners, delta: deltas.partners, color: '#2BBFB3', sparkline: sparklines.partners },
    { key: 'codes', label: 'Codes générés', value: stats.codes, delta: deltas.codes, color: '#1a2b4a', sparkline: sparklines.codes },
    { key: 'requests', label: 'Demandes en attente', value: stats.pending, delta: deltas.requests, color: '#f59e0b', sparkline: sparklines.requests },
    { key: 'users', label: 'Utilisateurs app', value: stats.users, delta: deltas.users, color: '#8b5cf6', sparkline: sparklines.users },
  ]

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f4f5f7' }}>

      {/* Overlay mobile */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
          onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Header mobile */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-white flex items-center justify-between px-4 py-3"
          style={{ boxShadow: '0 2px 12px rgba(43,191,179,0.08)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#f4f5f7' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                {mobileMenuOpen ? (
                  <path d="M5 5L15 15M15 5L5 15" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>
                ) : (
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>
                )}
              </svg>
            </button>
            <img src="/logo.png" alt="Héka" className="h-8 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter datasets={datasets} onNavigate={handleNavClick} />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`bg-white flex flex-col py-6 transition-all duration-300 ${
        isMobile
          ? `fixed top-0 left-0 bottom-0 z-50 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'relative'
      }`}
        style={{
          width: isMobile ? '280px' : (sidebarOpen ? '240px' : '72px'),
          boxShadow: '2px 0 12px rgba(43,191,179,0.06)',
          flexShrink: 0,
        }}>

        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 mb-8">
          {(sidebarOpen || isMobile) && (
            <img src="/logo.png" alt="Héka" className="h-9 rounded-xl" />
          )}
          {isMobile ? (
            <button onClick={() => setMobileMenuOpen(false)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#f4f5f7' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ backgroundColor: '#f4f5f7', marginLeft: sidebarOpen ? '0' : 'auto', marginRight: sidebarOpen ? '0' : 'auto' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {sidebarOpen
                  ? <path d="M10 3L5 8L10 13" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M6 3L11 8L6 13" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                }
              </svg>
            </button>
          )}
        </div>

        {(sidebarOpen || isMobile) && (
          <p className="text-xs px-5 mb-3 font-semibold tracking-wider"
            style={{ color: '#8a93a2' }}>
            NAVIGATION
          </p>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3">
          {navItems.map(item => (
            <button key={item.path}
              onClick={() => handleNavClick(item.path)}
              className="w-full flex items-center mb-1 transition-all duration-200 group"
              style={{
                gap: (sidebarOpen || isMobile) ? '12px' : '0',
                padding: (sidebarOpen || isMobile) ? '10px 12px' : '10px',
                borderRadius: '12px',
                justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
                backgroundColor: activePage === item.path ? '#e8f8f7' : 'transparent',
                position: 'relative',
              }}>
              {/* Icône */}
              <div className="flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: activePage === item.path ? '#2BBFB3' : '#f4f5f7',
                }}>
                <NavIcon icon={item.icon} active={activePage === item.path} />
              </div>

              {/* Label */}
              {(sidebarOpen || isMobile) && (
                <span className="text-sm font-medium transition-all"
                  style={{ color: activePage === item.path ? '#2BBFB3' : '#8a93a2' }}>
                  {item.label}
                </span>
              )}

              {/* Tooltip quand sidebar fermée (desktop uniquement) */}
              {!sidebarOpen && !isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                  style={{ backgroundColor: '#1a2b4a' }}>
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Déconnexion */}
        <div className="px-3">
          <button onClick={() => navigate('/login')}
            className="w-full flex items-center transition-all duration-200"
            style={{
              gap: (sidebarOpen || isMobile) ? '12px' : '0',
              padding: (sidebarOpen || isMobile) ? '10px 12px' : '10px',
              borderRadius: '12px',
              justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
            }}>
            <div className="flex items-center justify-center flex-shrink-0"
              style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fee2e2' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H2V2h4M10 11l4-3-4-3M5 8h9" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {(sidebarOpen || isMobile) && (
              <span className="text-sm font-medium" style={{ color: '#ef4444' }}>
                Se déconnecter
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-4 md:p-8 overflow-x-hidden"
        style={{ paddingTop: isMobile ? '72px' : undefined }}>

        {/* Header desktop avec recherche globale + notifications */}
        {!isMobile && activePage === 'dashboard' && (
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div>
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Tableau de bord</h1>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Bienvenue dans votre espace de gestion Héka</p>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearch datasets={datasets} onSelect={handleSearchSelect} />
              <NotificationCenter datasets={datasets} onNavigate={handleNavClick} />
            </div>
          </div>
        )}

        {/* Header pages avec recherche + notifs */}
        {!isMobile && activePage !== 'dashboard' && (
          <div className="flex items-center justify-end mb-4 gap-3">
            <GlobalSearch datasets={datasets} onSelect={handleSearchSelect} />
            <NotificationCenter datasets={datasets} onNavigate={handleNavClick} />
          </div>
        )}

        {/* ─── Dashboard page ──────────────────────── */}
        {activePage === 'dashboard' && (
          <>
            {/* Stat cards avec sparklines */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-8">
              {statCards.map(stat => (
                <div key={stat.key} className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6"
                  style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-2xl md:text-3xl font-bold" style={{ color: stat.color }}>
                      {loading ? '—' : stat.value}
                    </p>
                    {!loading && stat.delta > 0 && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-lg"
                        style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                        +{stat.delta}
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm mb-2" style={{ color: '#8a93a2' }}>{stat.label}</p>
                  {!loading && <SparklineChart data={stat.sparkline} color={stat.color} height={32} />}
                </div>
              ))}
            </div>

            {/* Taux de conversion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-8">
              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8a93a2' }}>Taux d'activation des codes</p>
                    <p className="text-3xl font-bold" style={{ color: '#2BBFB3' }}>{loading ? '—' : `${stats.activationRate}%`}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#e8f8f7' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2BBFB3" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                </div>
                {!loading && (
                  <div className="flex items-center gap-4 text-xs" style={{ color: '#8a93a2' }}>
                    <span><strong style={{ color: '#1a2b4a' }}>{stats.codesUsed}</strong> activés</span>
                    <span>sur <strong style={{ color: '#1a2b4a' }}>{stats.codes}</strong> générés</span>
                  </div>
                )}
                {!loading && (
                  <div className="mt-3 rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${stats.activationRate}%`, backgroundColor: '#2BBFB3' }} />
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8a93a2' }}>Conversion essai → payant</p>
                    <p className="text-3xl font-bold" style={{ color: '#1a2b4a' }}>—</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#e8f0fe' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2b4a" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                </div>
                <p className="text-xs" style={{ color: '#8a93a2', lineHeight: '1.5' }}>
                  Disponible prochainement — nécessite la connexion avec la table des abonnements.
                </p>
                <div className="mt-3 rounded-full overflow-hidden h-2" style={{ backgroundColor: '#f4f5f7' }}>
                  <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: '#1a2b4a' }} />
                </div>
              </div>
            </div>

            {/* Section activité récente */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: '#1a2b4a' }}>Activité récente</h2>
                <button
                  onClick={() => setActivePage('activity-log')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                  style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                  Voir tout →
                </button>
              </div>
              <RecentActivity datasets={datasets} />
            </div>
          </>
        )}

        {/* ─── Pages ───────────────────────────────── */}
        {activePage === 'partners' && <Partners />}
        {activePage === 'crm' && <CRM />}
        {activePage === 'users' && <Users />}
        {activePage === 'codes' && <CodeGenerator />}
        {activePage === 'requests' && <Requests />}
        {activePage === 'accounts' && <AdminAccounts />}
        {activePage === 'activity-log' && <ActivityLog />}
        {activePage === 'all-beneficiaries' && <AllBeneficiaries />}
        {activePage === 'analytics' && <Analytics />}
        {activePage === 'cocon' && <Cocon />}
      </div>
    </div>
  )
}

// ─── Mini composant activité récente (dashboard) ──
function RecentActivity({ datasets }) {
  const recentItems = useMemo(() => {
    const items = []

    // Dernières activités CRM
    ;(datasets.requests || []).forEach(r => {
      if (r.created_at) {
        const statusLabels = { pending: 'en attente', approved: 'approuvée', rejected: 'refusée' }
        items.push({
          id: `req-${r.id}`,
          icon: '📋',
          label: `Demande ${r.request_type || 'codes'} — ${statusLabels[r.request_status] || r.request_status}`,
          date: r.created_at,
        })
      }
    })

    // Derniers envois
    ;(datasets.beneficiaries || []).filter(b => b.sent_at).forEach(b => {
      items.push({
        id: `send-${b.id}`,
        icon: '📧',
        label: `Code envoyé à ${b.first_name || ''} ${b.last_name || ''} (${b.email || ''})`,
        date: b.sent_at,
      })
    })

    // Nouveaux membres
    ;(datasets.members || []).forEach(m => {
      if (m.created_at) {
        items.push({
          id: `member-${m.id}`,
          icon: '👤',
          label: `Nouveau compte : ${m.user_email}`,
          date: m.created_at,
        })
      }
    })

    return items
      .filter(i => i.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
  }, [datasets])

  if (recentItems.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: '#8a93a2' }}>
        Aucune activité récente
      </p>
    )
  }

  return (
    <div>
      {recentItems.map((item, idx) => {
        const date = new Date(item.date)
        const timeStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        return (
          <div key={item.id}
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: idx < recentItems.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <p className="text-sm flex-1 truncate" style={{ color: '#1a2b4a' }}>{item.label}</p>
            <p className="text-xs flex-shrink-0" style={{ color: '#b0b7c3' }}>{timeStr}</p>
          </div>
        )
      })}
    </div>
  )
}