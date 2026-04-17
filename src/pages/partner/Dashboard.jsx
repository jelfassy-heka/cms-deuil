import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import client from '../../lib/directus'
import { readItems, createItem } from '@directus/sdk'
import PartnerCodes from './PartnerCodes'

const requestTypes = [
  {
    type: 'codes',
    label: 'Demande de codes',
    icon: '🔑',
    description: 'Demander des codes d\'accès supplémentaires',
    color: '#2BBFB3',
  },
  {
    type: 'rdv',
    label: 'Demande de RDV',
    icon: '📅',
    description: 'Planifier un rendez-vous avec notre équipe',
    color: '#1a2b4a',
  },
  {
    type: 'assistance',
    label: 'Demande d\'assistance',
    icon: '🛟',
    description: 'Obtenir de l\'aide sur un problème',
    color: '#d97706',
  },
  {
    type: 'demo',
    label: 'Demande de démo',
    icon: '🎯',
    description: 'Découvrir toutes les fonctionnalités',
    color: '#8b5cf6',
  },
  {
    type: 'renouvellement',
    label: 'Renouvellement contrat',
    icon: '📄',
    description: 'Demander le renouvellement de votre contrat',
    color: '#ef4444',
  },
]

function RequestForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    quantity: 1,
    reason: '',
    preferred_date: '',
    preferred_date_2: '',
    message: '',
  })

  const handleSubmit = e => {
    e.preventDefault()
    onSubmit({ ...form, request_type: type.type })
  }

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6"
      style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.08)' }}>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{type.icon}</span>
        <div>
          <h2 className="font-bold text-base md:text-lg" style={{ color: '#1a2b4a' }}>{type.label}</h2>
          <p className="text-sm" style={{ color: '#8a93a2' }}>{type.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {type.type === 'codes' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Nombre de codes souhaités
              </label>
              <input type="number" min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Motif de la demande
              </label>
              <textarea value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="Expliquez pourquoi vous avez besoin de codes supplémentaires..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
          </>
        )}

        {type.type === 'rdv' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Créneau préféré
              </label>
              <input type="datetime-local"
                value={form.preferred_date}
                onChange={e => setForm({ ...form, preferred_date: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Créneau alternatif
              </label>
              <input type="datetime-local"
                value={form.preferred_date_2}
                onChange={e => setForm({ ...form, preferred_date_2: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Objet du rendez-vous
              </label>
              <textarea value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="De quoi souhaitez-vous discuter ?"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
          </>
        )}

        {type.type === 'assistance' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Type de problème
              </label>
              <select value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }}>
                <option value="">Sélectionnez...</option>
                <option value="technique">Problème technique</option>
                <option value="codes">Problème avec les codes</option>
                <option value="acces">Problème d'accès</option>
                <option value="facturation">Question de facturation</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Description du problème
              </label>
              <textarea value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Décrivez votre problème en détail..."
                rows={4}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
          </>
        )}

        {type.type === 'demo' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Créneau souhaité
              </label>
              <input type="datetime-local"
                value={form.preferred_date}
                onChange={e => setForm({ ...form, preferred_date: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Nombre de participants
              </label>
              <input type="number" min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Message complémentaire
              </label>
              <textarea value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Des besoins particuliers pour cette démo ?"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
          </>
        )}

        {type.type === 'renouvellement' && (
          <>
            <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: '#fef3c7' }}>
              <p className="text-sm font-medium" style={{ color: '#d97706' }}>
                ⚠️ Cette demande déclenchera une révision de votre contrat actuel.
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Message (optionnel)
              </label>
              <textarea value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Souhaitez-vous modifier certaines conditions ?"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit"
            className="px-6 py-3 rounded-2xl text-white text-sm font-semibold"
            style={{ backgroundColor: type.color }}>
            Envoyer la demande
          </button>
          <button type="button" onClick={onCancel}
            className="px-6 py-3 rounded-2xl text-sm font-semibold"
            style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

const statusLabels = {
  pending: { label: 'En attente', bg: '#fef3c7', text: '#d97706' },
  approved: { label: 'Approuvée', bg: '#e8f8f7', text: '#2BBFB3' },
  rejected: { label: 'Refusée', bg: '#fee2e2', text: '#ef4444' },
  in_progress: { label: 'En cours', bg: '#e8f0fe', text: '#1a2b4a' },
}

export default function PartnerDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [codes, setCodes] = useState([])
  const [contract, setContract] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeRequestType, setActiveRequestType] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    const fetchData = async () => {
      try {
        const [codesData, contractsData, requestsData] = await Promise.all([
          client.request(readItems('access_codes', {
            filter: { partner_id: { _eq: user.id } }
          })),
          client.request(readItems('contracts', {
            filter: { partner_id: { _eq: user.id } }
          })),
          client.request(readItems('code_request', {
            filter: { partner_id: { _eq: user.id } },
            sort: ['-date_created'],
          })),
        ])
        setCodes(codesData)
        setContract(contractsData[0] || null)
        setRequests(requestsData)
      } catch (err) {
        console.error('Erreur:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavClick = (path) => {
    setActivePage(path)
    setActiveRequestType(null)
    if (isMobile) setMobileMenuOpen(false)
  }

  const handleRequest = async (formData) => {
    try {
      const newRequest = await client.request(createItem('code_request', {
        quantity: formData.quantity || 1,
        reason: formData.reason || formData.message || '',
        request_status: 'pending',
        request_type: formData.request_type,
        preferred_date: formData.preferred_date || null,
        preferred_date_2: formData.preferred_date_2 || null,
        partner_id: user.id,
      }))
      setRequests([newRequest, ...requests])
      setActiveRequestType(null)
      setActivePage('requests')
    } catch (err) {
      console.error('Erreur demande:', err)
    }
  }

  const totalCodes = codes.length
  const usedCodes = codes.filter(c => (c.current_uses || 0) > 0).length
  const unusedCodes = codes.filter(c => (c.current_uses || 0) === 0).length
  const usageRate = totalCodes > 0 ? Math.round((usedCodes / totalCodes) * 100) : 0

  const navItems = [
    { label: 'Tableau de bord', icon: '⊞', path: 'dashboard' },
    { label: 'Mes codes', icon: '🔑', path: 'codes' },
    { label: 'Mon contrat', icon: '📄', path: 'contract' },
    { label: 'Mes demandes', icon: '📋', path: 'requests' },
    { label: 'Nouvelle demande', icon: '✉️', path: 'new_request' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p style={{ color: '#8a93a2' }}>Chargement...</p>
    </div>
  )

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
      <div className={`bg-white flex flex-col py-8 px-4 transition-all duration-300 ${
        isMobile
          ? `fixed top-0 left-0 bottom-0 z-50 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'relative'
      }`}
        style={{
          width: isMobile ? '280px' : '256px',
          boxShadow: '2px 0 12px rgba(43,191,179,0.06)',
        }}>
        <div className="px-4 mb-10">
          <div className="flex items-center justify-between">
            <img src="/logo.png" alt="Héka" className="h-10 rounded-xl" />
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#f4f5f7' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: '#8a93a2' }}>Espace partenaire</p>
        </div>

        <nav className="flex-1">
          {navItems.map(item => (
            <button key={item.path}
              onClick={() => handleNavClick(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-1 text-sm font-medium transition-all"
              style={{
                backgroundColor: activePage === item.path ? '#e8f8f7' : 'transparent',
                color: activePage === item.path ? '#2BBFB3' : '#8a93a2'
              }}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ color: '#8a93a2' }}>
          ← Se déconnecter
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 p-4 md:p-8 overflow-x-hidden"
        style={{ paddingTop: isMobile ? '72px' : undefined }}>

        {/* Dashboard */}
        {activePage === 'dashboard' && (
          <div>
            <div className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>
                Tableau de bord
              </h1>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
                Bienvenue dans votre espace partenaire Héka
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#2BBFB3' }}>{unusedCodes}</p>
                <p className="text-sm" style={{ color: '#8a93a2' }}>Codes disponibles</p>
              </div>
              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#1a2b4a' }}>{usedCodes}</p>
                <p className="text-sm" style={{ color: '#8a93a2' }}>Codes utilisés</p>
              </div>
              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <p className="text-2xl md:text-3xl font-bold mb-1"
                  style={{ color: usageRate > 80 ? '#ef4444' : '#2BBFB3' }}>
                  {usageRate}%
                </p>
                <p className="text-sm" style={{ color: '#8a93a2' }}>Taux d'utilisation</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 mb-6"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold" style={{ color: '#1a2b4a' }}>Utilisation des codes</p>
                <span className="text-sm font-semibold"
                  style={{ color: usageRate > 80 ? '#ef4444' : '#2BBFB3' }}>
                  {usageRate}%
                </span>
              </div>
              <div className="w-full rounded-full h-3" style={{ backgroundColor: '#f4f5f7' }}>
                <div className="h-3 rounded-full transition-all"
                  style={{
                    width: `${usageRate}%`,
                    backgroundColor: usageRate > 80 ? '#ef4444' : '#2BBFB3'
                  }} />
              </div>
              {usageRate > 80 && (
                <p className="text-sm mt-3" style={{ color: '#ef4444' }}>
                  ⚠️ Vous approchez de la limite — pensez à demander de nouveaux codes
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {requestTypes.slice(0, 4).map(type => (
                <button key={type.type}
                  onClick={() => { setActivePage('new_request'); setActiveRequestType(type) }}
                  className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 text-left transition-all hover:shadow-md"
                  style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                  <span className="text-2xl">{type.icon}</span>
                  <p className="font-semibold mt-2 text-sm" style={{ color: '#1a2b4a' }}>
                    {type.label}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#8a93a2' }}>
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mes codes */}
        {activePage === 'codes' && <PartnerCodes user={user} />}

        {/* Mon contrat */}
        {activePage === 'contract' && (
          <div>
            <div className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Mon contrat</h1>
            </div>
            {contract ? (
              <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {[
                    { label: 'Statut', value: contract.contract_status },
                    { label: 'Début', value: new Date(contract.start_date).toLocaleDateString('fr-FR') },
                    { label: 'Fin', value: new Date(contract.end_date).toLocaleDateString('fr-FR') },
                    { label: 'Renouvellement auto', value: contract.auto_renewal ? 'Activé' : 'Désactivé' },
                    { label: 'Codes inclus', value: contract.max_codes },
                    { label: 'Tarif', value: `${contract.price}€` },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#8a93a2' }}>
                        {item.label.toUpperCase()}
                      </p>
                      <p className="font-semibold" style={{ color: '#1a2b4a' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  {contract.document_url && (
                    <a href={contract.document_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-semibold"
                      style={{ backgroundColor: '#2BBFB3' }}>
                      📄 Télécharger le contrat
                    </a>
                  )}
                  <button
                    onClick={() => { setActivePage('new_request'); setActiveRequestType(requestTypes[4]) }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold"
                    style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
                    🔄 Demander un renouvellement
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <span className="text-4xl">📄</span>
                <p className="font-semibold mt-4" style={{ color: '#1a2b4a' }}>Aucun contrat en cours</p>
              </div>
            )}
          </div>
        )}

        {/* Nouvelle demande */}
        {activePage === 'new_request' && (
          <div>
            <div className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Nouvelle demande</h1>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Choisissez le type de demande</p>
            </div>

            {!activeRequestType ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {requestTypes.map(type => (
                  <button key={type.type}
                    onClick={() => setActiveRequestType(type)}
                    className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 text-left transition-all hover:shadow-md"
                    style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                    <div className="flex items-center gap-3 md:gap-4 mb-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl flex-shrink-0"
                        style={{ backgroundColor: type.color + '20' }}>
                        {type.icon}
                      </div>
                      <p className="font-semibold" style={{ color: '#1a2b4a' }}>{type.label}</p>
                    </div>
                    <p className="text-sm" style={{ color: '#8a93a2' }}>{type.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <RequestForm
                type={activeRequestType}
                onSubmit={handleRequest}
                onCancel={() => setActiveRequestType(null)}
              />
            )}
          </div>
        )}

        {/* Mes demandes */}
        {activePage === 'requests' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Mes demandes</h1>
                <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
                  {requests.length} demande(s)
                </p>
              </div>
              <button onClick={() => { setActivePage('new_request'); setActiveRequestType(null) }}
                className="px-5 py-3 rounded-2xl text-white text-sm font-semibold w-full sm:w-auto"
                style={{ backgroundColor: '#2BBFB3' }}>
                + Nouvelle demande
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center"
                style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                <span className="text-4xl">📋</span>
                <p className="font-semibold mt-4" style={{ color: '#1a2b4a' }}>Aucune demande</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {requests.map(req => {
                  const typeInfo = requestTypes.find(t => t.type === req.request_type) || requestTypes[0]
                  const statusInfo = statusLabels[req.request_status] || statusLabels.pending
                  return (
                    <div key={req.id} className="bg-white rounded-2xl md:rounded-3xl px-4 md:px-6 py-4 md:py-5"
                      style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: typeInfo.color + '20' }}>
                            {typeInfo.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate" style={{ color: '#1a2b4a' }}>
                              {typeInfo.label}
                            </p>
                            <p className="text-sm mt-0.5 truncate" style={{ color: '#8a93a2' }}>
                              {req.reason || '—'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>
                              {req.date_created ? new Date(req.date_created).toLocaleDateString('fr-FR') : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-xl font-medium whitespace-nowrap flex-shrink-0"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}