import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Partners from './Partners'
import CRM from './CRM'
import Users from './Users'
import CodeGenerator from './CodeGenerator'
import Requests from './Requests'
import AdminAccounts from './AdminAccounts'
const stats = [
  { label: 'Partenaires actifs', value: '0', color: '#2BBFB3' },
  { label: 'Codes générés', value: '0', color: '#1a2b4a' },
  { label: 'Demandes en attente', value: '0', color: '#f59e0b' },
]

const navItems = [
  { label: 'Tableau de bord', icon: '⊞', path: 'dashboard' },
  { label: 'Partenaires', icon: '🏢', path: 'partners' },
  { label: 'Demandes', icon: '📋', path: 'requests' },
  { label: 'CRM', icon: '📊', path: 'crm' },
  { label: 'Utilisateurs', icon: '👥', path: 'users' },
  { label: 'Générateur de codes', icon: '🔑', path: 'codes' },
  { label: 'Gestion des accès', icon: '🔐', path: 'accounts' },
]

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const navigate = useNavigate()

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
          <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>
            {navItems.find(n => n.path === activePage)?.label || 'Tableau de bord'}
          </p>
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  {item.path === 'dashboard' && (
                    <>
                      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={activePage === item.path ? 'white' : '#8a93a2'}/>
                      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={activePage === item.path ? 'white' : '#8a93a2'}/>
                      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={activePage === item.path ? 'white' : '#8a93a2'}/>
                      <rect x="9" y="9" width="6" height="6" rx="1.5" fill={activePage === item.path ? 'white' : '#8a93a2'}/>
                    </>
                  )}
                  {item.path === 'partners' && (
                    <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M8 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM13 7v4M15 9h-4" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round"/>
                  )}
                  {item.path === 'codes' && (
                    <>
                      <rect x="1" y="5" width="10" height="7" rx="2" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3"/>
                      <path d="M11 7.5V6a4 4 0 0 1 4 4" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round"/>
                      <circle cx="6" cy="8.5" r="1.2" fill={activePage === item.path ? 'white' : '#8a93a2'}/>
                    </>
                  )}
                  {item.path === 'requests' && (
                    <path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round"/>
                  )}
                  {item.path === 'crm' && (
                    <path d="M1 13L4 9l3 2 3-4 4 5M1 11V3h14v10" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  )}
                  {item.path === 'users' && (
                    <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M9.5 1a2.5 2.5 0 0 1 0 5M12 14v-1.5a2.5 2.5 0 0 0-1.5-2.3M6 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round"/>
                  )}
                  {item.path === 'codes' && (
                    <>
                      <circle cx="8" cy="8" r="3" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3"/>
                      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke={activePage === item.path ? 'white' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round"/>
                      </>
                  )}
                </svg>
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
        {activePage === 'dashboard' && (
          <>
            <div className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Tableau de bord</h1>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Bienvenue dans votre espace de gestion Héka</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
              {stats.map(stat => (
                <div key={stat.label} className="bg-white rounded-3xl p-5 md:p-6"
                  style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                  <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {activePage === 'partners' && <Partners />}
        {activePage === 'crm' && <CRM />}
        {activePage === 'users' && <Users />}
        {activePage === 'codes' && <CodeGenerator />}
        {activePage === 'requests' && <Requests />}
        {activePage === 'accounts' && <AdminAccounts />}
      </div>
    </div>
  )
}