import { useState, useEffect, useRef, useCallback } from 'react'

export function computePartnerNotifications({ requests, codes, contract, beneficiaries }) {
  const notifications = []
  const now = new Date()

  // 1. Demandes approuvées récentes (7 derniers jours)
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const approvedRecent = (requests || []).filter(r =>
    r.request_status === 'approved' && r.created_at && new Date(r.created_at) > d7
  )
  if (approvedRecent.length > 0) {
    notifications.push({
      id: 'approved-requests',
      color: '#2BBFB3',
      bg: '#e8f8f7',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="#2BBFB3" strokeWidth="1.3"/>
          <path d="M5.5 8l2 2 3.5-4" stroke="#2BBFB3" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: `${approvedRecent.length} demande${approvedRecent.length > 1 ? 's' : ''} approuvée${approvedRecent.length > 1 ? 's' : ''}`,
      detail: 'Consultez vos demandes',
      action: 'requests',
    })
  }

  // 2. Codes presque épuisés (>80%)
  const usedCodes = (codes || []).filter(c => c.used).length
  const totalCodes = (codes || []).length
  if (totalCodes > 0 && usedCodes / totalCodes > 0.8) {
    const pct = Math.round((usedCodes / totalCodes) * 100)
    notifications.push({
      id: 'codes-low',
      color: '#f59e0b',
      bg: '#fef3c7',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1v6M8 11v1" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="8" cy="8" r="7" stroke="#f59e0b" strokeWidth="1.3"/>
        </svg>
      ),
      label: `${pct}% des codes utilisés`,
      detail: 'Pensez à demander de nouveaux codes',
      action: 'requests',
    })
  }

  // 3. Contrat expire bientôt (<30j)
  if (contract?.end_date) {
    const endDate = new Date(contract.end_date)
    const daysLeft = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000))
    if (daysLeft > 0 && daysLeft < 30) {
      notifications.push({
        id: 'contract-expiry',
        color: '#ef4444',
        bg: '#fee2e2',
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#ef4444" strokeWidth="1.3"/>
            <path d="M8 4v4l3 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        ),
        label: `Contrat expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        detail: `Fin : ${endDate.toLocaleDateString('fr-FR')}`,
        action: 'contract',
      })
    }
  }

  // 4. Nouveaux codes disponibles (non assignés)
  const assignedCodes = new Set((beneficiaries || []).filter(b => b.code).map(b => b.code))
  const availableCodes = (codes || []).filter(c => !c.used && !assignedCodes.has(c.code))
  if (availableCodes.length > 0) {
    const recentCodes = availableCodes.filter(c => c.created_at && new Date(c.created_at) > d7)
    if (recentCodes.length > 0) {
      notifications.push({
        id: 'new-codes',
        color: '#8b5cf6',
        bg: '#ede9fe',
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="5" width="10" height="7" rx="2" stroke="#8b5cf6" strokeWidth="1.3"/>
            <circle cx="7" cy="8.5" r="1.2" fill="#8b5cf6"/>
          </svg>
        ),
        label: `${recentCodes.length} nouveau${recentCodes.length > 1 ? 'x' : ''} code${recentCodes.length > 1 ? 's' : ''} disponible${recentCodes.length > 1 ? 's' : ''}`,
        detail: 'Prêts à être envoyés',
        action: 'codes',
      })
    }
  }

  return notifications
}

export default function PartnerNotifications({ data, onNavigate, align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('heka_partner_notifs') || '[]') }
    catch { return [] }
  })
  const dropdownRef = useRef(null)

  const allNotifications = computePartnerNotifications(data)
  const notifications = allNotifications.filter(n => !dismissedIds.includes(n.id))
  const count = notifications.length

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') setIsOpen(false) }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleDismiss = useCallback((id, e) => {
    e.stopPropagation()
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    sessionStorage.setItem('heka_partner_notifs', JSON.stringify(updated))
  }, [dismissedIds])

  const handleClick = useCallback((notif) => {
    if (notif.action && onNavigate) onNavigate(notif.action)
    setIsOpen(false)
  }, [onNavigate])

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{ backgroundColor: isOpen ? '#e8f8f7' : '#f4f5f7' }}
        title="Notifications">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5ZM8 17.5a2 2 0 0 0 4 0"
            stroke={isOpen ? '#2BBFB3' : '#8a93a2'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
            style={{ backgroundColor: '#ef4444' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-12 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl overflow-hidden z-50 animate-slide-down`}
          style={{ boxShadow: '0 20px 60px rgba(26,43,74,0.15)', border: '1px solid #f4f5f7', minWidth: '340px' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #f4f5f7' }}>
            <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>Notifications</p>
            {count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{count}</span>
            )}
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <span className="text-3xl block mb-2">🔔</span>
                <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>Tout est en ordre</p>
                <p className="text-xs mt-1" style={{ color: '#8a93a2' }}>Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <div key={notif.id}
                  onClick={() => handleClick(notif)}
                  className="flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: idx < notifications.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: notif.bg }}>
                    {notif.icon}
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <p className="text-sm font-medium break-words" style={{ color: '#1a2b4a', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{notif.label}</p>
                    <p className="text-xs mt-0.5 break-words" style={{ color: '#8a93a2', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{notif.detail}</p>
                  </div>
                  <button onClick={(e) => handleDismiss(notif.id, e)}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-gray-100"
                    style={{ color: '#8a93a2' }} title="Masquer">
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