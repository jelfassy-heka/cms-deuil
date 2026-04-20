import { useState, useEffect } from 'react'
import xano from '../../lib/xano'

const requestTypes = {
  codes: { label: 'Codes', icon: '🔑', color: '#2BBFB3' },
  rdv: { label: 'RDV', icon: '📅', color: '#1a2b4a' },
  assistance: { label: 'Assistance', icon: '🛟', color: '#d97706' },
  demo: { label: 'Démo', icon: '🎯', color: '#8b5cf6' },
  renouvellement: { label: 'Renouvellement', icon: '📄', color: '#ef4444' },
}

const statusConfig = {
  pending: { label: 'En attente', bg: '#fef3c7', text: '#d97706' },
  in_progress: { label: 'En cours', bg: '#e8f0fe', text: '#1a2b4a' },
  approved: { label: 'Approuvée', bg: '#e8f8f7', text: '#2BBFB3' },
  rejected: { label: 'Refusée', bg: '#fee2e2', text: '#ef4444' },
}

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [r, p] = await Promise.all([xano.getAll('code_request'), xano.getAll('partners')])
        setRequests(r); setPartners(p)
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const getPartnerName = id => { const p = partners.find(x => x.id === id); return p ? p.name : 'Inconnu' }

  const handleStatus = async (requestId, newStatus) => {
    try {
      const updated = await xano.update('code_request', requestId, { request_status: newStatus, processed_at: new Date().toISOString() })
      setRequests(requests.map(r => r.id === requestId ? { ...r, ...updated } : r))
      if (selectedRequest?.id === requestId) setSelectedRequest({ ...selectedRequest, request_status: newStatus })
    } catch (err) { console.error('Erreur:', err) }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.request_status === filter)
  const stats = { total: requests.length, pending: requests.filter(r => r.request_status === 'pending').length, inProgress: requests.filter(r => r.request_status === 'in_progress').length, approved: requests.filter(r => r.request_status === 'approved').length }

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{ color: '#8a93a2' }}>Chargement...</p></div>

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Demandes partenaires</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Gérez toutes les demandes entrantes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[{ label: 'Total', value: stats.total, color: '#1a2b4a' },{ label: 'En attente', value: stats.pending, color: '#d97706' },{ label: 'En cours', value: stats.inProgress, color: '#2BBFB3' },{ label: 'Approuvées', value: stats.approved, color: '#10b981' }].map(s => (
          <div key={s.label} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}><p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p><p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{s.label}</p></div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 md:mb-6 flex-wrap">
        {[{ key: 'all', label: 'Toutes' },{ key: 'pending', label: 'En attente' },{ key: 'in_progress', label: 'En cours' },{ key: 'approved', label: 'Approuvées' },{ key: 'rejected', label: 'Refusées' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium" style={{ backgroundColor: filter === f.key ? '#2BBFB3' : '#f4f5f7', color: filter === f.key ? 'white' : '#8a93a2' }}>
            {f.label}{f.key === 'pending' && stats.pending > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>{stats.pending}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className={`flex-1 flex flex-col gap-3 ${selectedRequest ? 'hidden lg:flex' : ''}`}>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}><span className="text-4xl">📭</span><p className="font-semibold mt-4" style={{ color: '#1a2b4a' }}>Aucune demande</p></div>
          ) : filtered.map(req => {
            const t = requestTypes[req.request_type] || requestTypes.codes; const s = statusConfig[req.request_status] || statusConfig.pending
            return (
              <div key={req.id} onClick={() => setSelectedRequest(req)} className="bg-white rounded-2xl md:rounded-3xl px-4 md:px-6 py-4 md:py-5 cursor-pointer" style={{ boxShadow: selectedRequest?.id === req.id ? '0 0 0 2px #2BBFB3' : '0 4px 24px rgba(43,191,179,0.06)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: t.color + '15' }}>{t.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-sm" style={{ color: '#1a2b4a' }}>{t.label}</p><span className="text-xs px-2 py-0.5 rounded-lg truncate" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>{getPartnerName(req.partner_id)}</span></div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#8a93a2' }}>{req.reason || req.message || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-xl font-medium whitespace-nowrap flex-shrink-0" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {selectedRequest && (
          <div className="w-full lg:w-80 lg:flex-shrink-0">
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 lg:sticky lg:top-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <button onClick={() => setSelectedRequest(null)} className="lg:hidden flex items-center gap-2 mb-4 text-sm font-medium" style={{ color: '#8a93a2' }}>← Retour</button>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3"><span className="text-2xl">{requestTypes[selectedRequest.request_type]?.icon || '📋'}</span><div><p className="font-semibold" style={{ color: '#1a2b4a' }}>{requestTypes[selectedRequest.request_type]?.label}</p><p className="text-xs" style={{ color: '#8a93a2' }}>{getPartnerName(selectedRequest.partner_id)}</p></div></div>
                <button onClick={() => setSelectedRequest(null)} className="w-7 h-7 rounded-lg items-center justify-center text-lg hidden lg:flex" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
              </div>
              <div className="flex flex-col gap-3 mb-6">
                {selectedRequest.quantity && <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}><p className="text-xs" style={{ color: '#8a93a2' }}>QUANTITÉ</p><p className="font-semibold text-sm" style={{ color: '#1a2b4a' }}>{selectedRequest.quantity} codes</p></div>}
                {selectedRequest.reason && <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}><p className="text-xs" style={{ color: '#8a93a2' }}>MOTIF</p><p className="text-sm" style={{ color: '#1a2b4a' }}>{selectedRequest.reason}</p></div>}
                {selectedRequest.preferred_date && <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}><p className="text-xs" style={{ color: '#8a93a2' }}>CRÉNEAU</p><p className="text-sm" style={{ color: '#1a2b4a' }}>{new Date(selectedRequest.preferred_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>}
                <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}><p className="text-xs" style={{ color: '#8a93a2' }}>DATE</p><p className="text-sm" style={{ color: '#1a2b4a' }}>{new Date(selectedRequest.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
              </div>
              <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>CHANGER LE STATUT</p>
              <div className="flex flex-col gap-2">
                {[{ status: 'in_progress', label: 'Marquer en cours', color: '#1a2b4a' },{ status: 'approved', label: 'Approuver', color: '#2BBFB3' },{ status: 'rejected', label: 'Refuser', color: '#ef4444' }].map(a => (
                  <button key={a.status} onClick={() => handleStatus(selectedRequest.id, a.status)} disabled={selectedRequest.request_status === a.status}
                    className="w-full py-2.5 rounded-xl text-sm font-medium" style={{
                      backgroundColor: selectedRequest.request_status === a.status ? '#f4f5f7' : a.color + '15',
                      color: selectedRequest.request_status === a.status ? '#8a93a2' : a.color,
                      border: `1px solid ${selectedRequest.request_status === a.status ? '#f4f5f7' : a.color + '30'}`
                    }}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}