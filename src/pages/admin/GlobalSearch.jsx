import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useDebounce } from '../../components/SharedUI'

// ─── Config des sources de recherche ──────────────
const SEARCH_SOURCES = {
  partners: {
    label: 'Partenaires',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M8 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM13 7v4M15 9h-4" stroke="#2BBFB3" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '#2BBFB3',
    search: (items, q) => items
      .filter(p => [p.name, p.email_contact, p.contact_firstname, p.contact_lastname]
        .filter(Boolean).some(f => f.toLowerCase().includes(q)))
      .map(p => ({ id: p.id, title: p.name, subtitle: p.email_contact || '', raw: p })),
    action: 'partners',
  },
  beneficiaries: {
    label: 'Salariés',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M9.5 1a2.5 2.5 0 0 1 0 5M12 14v-1.5a2.5 2.5 0 0 0-1.5-2.3M6 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '#3b82f6',
    search: (items, q) => items
      .filter(b => [b.first_name, b.last_name, b.email]
        .filter(Boolean).some(f => f.toLowerCase().includes(q)))
      .map(b => ({
        id: b.id,
        title: `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email,
        subtitle: b.email || '',
        raw: b,
        parentId: b.partner_id,
      })),
    action: 'partners',
  },
  codes: {
    label: 'Codes',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="5" width="10" height="7" rx="2" stroke="#8b5cf6" strokeWidth="1.3"/>
        <circle cx="7" cy="8.5" r="1.2" fill="#8b5cf6"/>
      </svg>
    ),
    color: '#8b5cf6',
    search: (items, q) => items
      .filter(c => c.code && c.code.toLowerCase().includes(q))
      .map(c => ({ id: c.id, title: c.code, subtitle: c.used ? 'Utilisé' : 'Disponible', raw: c })),
    action: 'codes',
  },
  requests: {
    label: 'Demandes',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '#f59e0b',
    search: (items, q) => items
      .filter(r => [r.reason, r.message, r.request_type]
        .filter(Boolean).some(f => f.toLowerCase().includes(q)))
      .map(r => ({
        id: r.id,
        title: `${r.request_type || 'Demande'} — ${r.request_status || ''}`,
        subtitle: r.reason || r.message || '',
        raw: r,
      })),
    action: 'requests',
  },
  users: {
    label: 'Utilisateurs',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="#1a2b4a" strokeWidth="1.3"/>
        <path d="M2 14a6 6 0 0 1 12 0" stroke="#1a2b4a" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    color: '#1a2b4a',
    search: (items, q) => items
      .filter(u => [u.firstName, u.lastName, u.email]
        .filter(Boolean).some(f => f.toLowerCase().includes(q)))
      .map(u => ({
        id: u.id,
        title: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        subtitle: u.email || '',
        raw: u,
      })),
    action: 'users',
  },
}

const MAX_PER_GROUP = 3

// ─── Composant principal ──────────────────────────
export default function GlobalSearch({ datasets, onSelect }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  const debouncedQuery = useDebounce(query, 200)

  // Résultats groupés
  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return {}

    const q = debouncedQuery.toLowerCase()
    const grouped = {}

    Object.entries(SEARCH_SOURCES).forEach(([key, source]) => {
      const data = datasets[key] || []
      const matches = source.search(data, q)
      if (matches.length > 0) {
        grouped[key] = {
          label: source.label,
          icon: source.icon,
          color: source.color,
          action: source.action,
          items: matches.slice(0, MAX_PER_GROUP),
          total: matches.length,
        }
      }
    })

    return grouped
  }, [debouncedQuery, datasets])

  // Compter tous les résultats pour la navigation clavier
  const flatResults = useMemo(() => {
    const flat = []
    Object.entries(results).forEach(([key, group]) => {
      group.items.forEach(item => {
        flat.push({ ...item, sourceKey: key, action: group.action })
      })
    })
    return flat
  }, [results])

  const hasResults = flatResults.length > 0
  const showDropdown = isOpen && debouncedQuery.length >= 2

  // Raccourci Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = useCallback((item) => {
    if (onSelect) onSelect(item.action, item.id, item.raw, item.sourceKey)
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(0)
  }, [onSelect])

  // Navigation clavier dans les résultats
  const handleKeyDown = useCallback((e) => {
    if (!showDropdown || !hasResults) {
      if (e.key === 'Escape') { setIsOpen(false); inputRef.current?.blur() }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }, [showDropdown, hasResults, flatResults, selectedIndex, handleSelect])

  // Reset index quand les résultats changent
  useEffect(() => { setSelectedIndex(0) }, [debouncedQuery])

  return (
    <div className="relative" ref={containerRef}>
      {/* Barre de recherche */}
      <div className="relative flex items-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          className="absolute left-3 pointer-events-none">
          <circle cx="7" cy="7" r="5" stroke="#8a93a2" strokeWidth="1.3"/>
          <path d="M11 11l3.5 3.5" stroke="#8a93a2" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher partout..."
          className="w-full pl-9 pr-16 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            backgroundColor: isOpen ? 'white' : '#f4f5f7',
            color: '#1a2b4a',
            border: isOpen ? '1.5px solid #2BBFB3' : '1.5px solid transparent',
            minWidth: '240px',
          }}
        />
        {/* Indicateur raccourci */}
        {!query && (
          <div className="absolute right-3 flex items-center gap-0.5 pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: '#e8eaed', color: '#8a93a2' }}>
              Ctrl
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: '#e8eaed', color: '#8a93a2' }}>
              K
            </kbd>
          </div>
        )}
        {/* Bouton clear */}
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false) }}
            className="absolute right-3 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#e8eaed', color: '#8a93a2' }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1l-6 6" stroke="#8a93a2" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-12 bg-white rounded-2xl overflow-hidden z-50 animate-slide-down"
          style={{ boxShadow: '0 20px 60px rgba(26,43,74,0.15)', border: '1px solid #f4f5f7', minWidth: '340px' }}>
          {!hasResults ? (
            <div className="py-8 text-center">
              <span className="text-2xl block mb-2">🔍</span>
              <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>Aucun résultat</p>
              <p className="text-xs mt-1" style={{ color: '#8a93a2' }}>
                Essayez un autre terme de recherche
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.entries(results).map(([key, group]) => {
                // Trouver l'index global du premier item de ce groupe
                let groupStartIndex = 0
                for (const [k] of Object.entries(results)) {
                  if (k === key) break
                  groupStartIndex += results[k].items.length
                }

                return (
                  <div key={key}>
                    {/* Header du groupe */}
                    <div className="px-4 py-2 flex items-center justify-between"
                      style={{ backgroundColor: '#fafbfc', borderBottom: '1px solid #f4f5f7' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded flex items-center justify-center"
                          style={{ backgroundColor: `${group.color}15` }}>
                          {group.icon}
                        </span>
                        <p className="text-xs font-semibold" style={{ color: '#8a93a2' }}>
                          {group.label}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                        {group.total}
                      </span>
                    </div>

                    {/* Items */}
                    {group.items.map((item, idx) => {
                      const globalIdx = groupStartIndex + idx
                      const isSelected = globalIdx === selectedIndex

                      return (
                        <div key={`${key}-${item.id}`}
                          onClick={() => handleSelect({ ...item, action: group.action, sourceKey: key })}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                          style={{
                            backgroundColor: isSelected ? '#e8f8f7' : 'transparent',
                            borderBottom: '1px solid #f4f5f7',
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}>
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${group.color}15` }}>
                            {group.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-xs truncate" style={{ color: '#8a93a2' }}>
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                              style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                              Entrée ↵
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 flex items-center gap-3"
            style={{ backgroundColor: '#fafbfc', borderTop: '1px solid #f4f5f7' }}>
            <span className="text-[10px]" style={{ color: '#b0b7c3' }}>
              ↑↓ naviguer &nbsp; ↵ sélectionner &nbsp; Esc fermer
            </span>
          </div>
        </div>
      )}
    </div>
  )
}