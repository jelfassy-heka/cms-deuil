import { useState, useEffect, useRef, useCallback } from 'react'
import { timeAgo } from '../../components/SharedUI'

// ─── Règles de notification ───────────────────────
function computeNotifications(datasets) {
  const notifications = []
  const now = new Date()
  const h24 = new Date(now - 24 * 60 * 60 * 1000)

  // 1. Demandes en attente (priorité haute)
  const pendingRequests = (datasets.requests || []).filter(r => r.request_status === 'pending')
  if (pendingRequests.length > 0) {
    notifications.push({
      id: 'pending-requests',
      priority: 'high',
      color: '#ef4444',
      bg: '#fee2e2',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
      label: `${pendingRequests.length} demande${pendingRequests.length > 1 ? 's' : ''} en attente`,
      detail: 'Demandes partenaires à traiter',
      action: 'requests',
      date: pendingRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at,
    })
  }

  // 2. Taux d'utilisation > 80% (priorité haute)
  const partnersMap = {}
  ;(datasets.partners || []).forEach(p => { partnersMap[p.id] = p })
  const contractsMap = {}
  ;(datasets.contracts || []).forEach(c => {
    if (c.partner_id) contractsMap[c.partner_id] = c
  })
  const codesByPartner = {}
  ;(datasets.codes || []).forEach(c => {
    const pid = c.partnerId?.id || c.partnerId
    if (pid) codesByPartner[pid] = (codesByPartner[pid] || 0) + 1
  })

  Object.entries(codesByPartner).forEach(([pid, count]) => {
    const contract = contractsMap[pid]
    if (contract && contract.max_codes && count / contract.max_codes > 0.8) {
      const pName = partnersMap[pid]?.name || 'Partenaire'
      const pct = Math.round((count / contract.max_codes) * 100)
      notifications.push({
        id: `usage-${pid}`,
        priority: 'high',
        color: '#f59e0b',
        bg: '#fef3c7',
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v6M8 11v1" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="8" cy="8" r="7" stroke="#f59e0b" strokeWidth="1.3"/>
          </svg>
        ),
        label: `${pName} — ${pct}% des codes utilisés`,
        detail: `${count} / ${contract.max_codes} codes`,
        action: 'partners',
      })
    }
  })

  // 3. Contrats expirant < 30 jours (priorité moyenne)
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  ;(datasets.contracts || []).forEach(c => {
    if (c.end_date) {
      const endDate = new Date(c.end_date)
      if (endDate > now && endDate < in30days) {
        const daysLeft = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000))
        const pName = partnersMap[c.partner_id]?.name || 'Partenaire'
        notifications.push({
          id: `expiry-${c.id}`,
          priority: 'medium',
          color: '#f59e0b',
          bg: '#fef3c7',
          icon: (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#f59e0b" strokeWidth="1.3"/>
              <path d="M8 4v4l3 2" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ),
          label: `Contrat ${pName} expire dans ${daysLeft}j`,
          detail: `Fin : ${endDate.toLocaleDateString('fr-FR')}`,
          action: 'partners',
        })
      }
    }
  })

  // 4. Nouveaux utilisateurs app (24h) — info
  const newUsers = (datasets.users || []).filter(u => u.created_at && new Date(u.created_at) > h24)
  if (newUsers.length > 0) {
    notifications.push({
      id: 'new-users-24h',
      priority: 'info',
      color: '#2BBFB3',
      bg: '#e8f8f7',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M9.5 1a2.5 2.5 0 0 1 0 5M12 14v-1.5a2.5 2.5 0 0 0-1.5-2.3M6 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" stroke="#2BBFB3" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
      label: `${newUsers.length} nouvel${newUsers.length > 1 ? 'les' : 'le'} inscription${newUsers.length > 1 ? 's' : ''} app`,
      detail: 'Dernières 24 heures',
      action: 'users',
    })
  }

  // 5. Codes générés (24h) — info
  const newCodes = (datasets.codes || []).filter(c => c.created_at && new Date(c.created_at) > h24)
  if (newCodes.length > 0) {
    notifications.push({
      id: 'new-codes-24h',
      priority: 'info',
      color: '#8b5cf6',
      bg: '#ede9fe',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="5" width="10" height="7" rx="2" stroke="#8b5cf6" strokeWidth="1.3"/>
          <circle cx="7" cy="8.5" r="1.2" fill="#8b5cf6"/>
        </svg>
      ),
      label: `${newCodes.length} code${newCodes.length > 1 ? 's' : ''} généré${newCodes.length > 1 ? 's' : ''} aujourd'hui`,
      detail: 'Dernières 24 heures',
      action: 'codes',
    })
  }

  return notifications
}

// ─── Composant principal ──────────────────────────
export default function NotificationCenter({ datasets, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('heka_dismissed_notifs') || '[]')
    } catch { return [] }
  })
  const dropdownRef = useRef(null)

  // Calcul des notifications
  const allNotifications = computeNotifications(datasets)
  const notifications = allNotifications.filter(n => !dismissedIds.includes(n.id))
  const count = notifications.length

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Fermer sur Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleDismiss = useCallback((id, e) => {
    e.stopPropagation()
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    sessionStorage.setItem('heka_dismissed_notifs', JSON.stringify(updated))
  }, [dismissedIds])

  const handleClick = useCallback((notification) => {
    if (notification.action && onNavigate) {
      onNavigate(notification.action)
    }
    setIsOpen(false)
  }, [onNavigate])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Icône cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{
          backgroundColor: isOpen ? '#e8f8f7' : '#f4f5f7',
        }}
        title="Notifications">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5ZM8 17.5a2 2 0 0 0 4 0"
            stroke={isOpen ? '#2BBFB3' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Badge compteur */}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
            style={{ backgroundColor: '#ef4444' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl overflow-hidden z-50 animate-slide-down"
          style={{ boxShadow: '0 20px 60px rgba(26,43,74,0.15)', border: '1px solid #f4f5f7' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #f4f5f7' }}>
            <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>
              Notifications
            </p>
            {notifications.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                {notifications.length}
              </span>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <span className="text-3xl block mb-2">🔔</span>
                <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>Tout est en ordre</p>
                <p className="text-xs mt-1" style={{ color: '#8a93a2' }}>Aucune notification pour le moment</p>
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <div key={notif.id}
                  onClick={() => handleClick(notif)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: idx < notifications.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                  {/* Icône */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: notif.bg }}>
                    {notif.icon}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>
                      {notif.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>
                      {notif.detail}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => handleDismiss(notif.id, e)}
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}
                    title="Masquer">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="#8a93a2" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}