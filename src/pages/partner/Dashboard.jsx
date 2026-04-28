import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Tooltip } from 'recharts'
import xano from '../../lib/xano'
import { MetricCard } from '../../components/SharedUI'
import PartnerCodes from './PartnerCodes'
import PartnerTeam from './PartnerTeam'
import PartnerProfile from './PartnerProfile'
import PartnerHelp from './PartnerHelp'
import PartnerNotifications, { computePartnerNotifications } from './PartnerNotifications'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
const ADMIN_EMAIL = 'jelfassy@heka-app.fr'

// ─── URL de prise de RDV Google Calendar ───
// Pour configurer : Google Calendar → Créer un "Horaires de rendez-vous" → Copier le lien de la page de réservation
const GOOGLE_CALENDAR_BOOKING_URL = 'https://calendar.app.google/RfrDN99k42atgAKs5' // ← Remplacer par votre URL

const sendEmail = async (to_email, to_name, template_id, params) => {
  try {
    await fetch(`${XANO_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email, to_name, template_id, params: JSON.stringify(params) }),
    })
  } catch (err) { console.error('Erreur envoi email:', err) }
}

// ─── SVG Icons pour les types de demandes ───
function RequestTypeIcon({ type, size = 20, color = 'currentColor' }) {
  switch (type) {
    case 'codes': return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>)
    case 'rdv': return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>)
    case 'assistance': return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>)
    case 'demo': return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>)
    case 'renouvellement': return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>)
    default: return null
  }
}

const requestTypes = [
  { type:'codes', label:'Demande de codes', description:'Demander des codes d\'accès supplémentaires pour vos collaborateurs', color:'#2BBFB3' },
  { type:'rdv', label:'Prendre rendez-vous', description:'Planifier un rendez-vous avec l\'équipe Héka via notre agenda', color:'#1a2b4a', isCalendar: true },
  { type:'assistance', label:'Assistance', description:'Obtenir de l\'aide sur l\'utilisation de la plateforme ou signaler un problème', color:'#d97706' },
  { type:'demo', label:'Demander une démo', description:'Découvrir les fonctionnalités d\'Héka en visio avec notre équipe', color:'#8b5cf6', isCalendar: true },
  { type:'renouvellement', label:'Renouvellement', description:'Initier le renouvellement ou la modification de votre contrat', color:'#ef4444' },
]

function RequestForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({ quantity:1, reason:'', preferred_date:'', preferred_date_2:'', message:'' })
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const handleSubmit = e => { e.preventDefault(); onSubmit({ ...form, request_type: type.type }) }

  // Pour les types RDV et Démo → redirection Google Calendar
  if (type.isCalendar) {
    // ÉTAPE 2 — UI de confirmation après redirection Google Calendar
    if (awaitingConfirmation) {
      return (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{ boxShadow:'0 4px 24px rgba(43,191,179,0.08)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: type.color + '15' }}>
              <RequestTypeIcon type={type.type} size={22} color={type.color} />
            </div>
            <div><h2 className="font-bold text-base md:text-lg" style={{color:'#1a2b4a'}}>{type.label}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{type.description}</p></div>
          </div>

          <div className="rounded-2xl p-6 mb-6 text-center" style={{ backgroundColor: '#f8fafb' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8f8f7' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2BBFB3" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>
            </div>
            <p className="font-semibold text-base mb-2" style={{ color: '#1a2b4a' }}>Avez-vous confirmé votre rendez-vous sur Google Calendar ?</p>
            <p className="text-sm" style={{ color: '#8a93a2', lineHeight: '1.6' }}>
              Une fois votre créneau réservé, cliquez sur « J'ai pris mon rendez-vous » pour enregistrer votre demande et recevoir votre email de confirmation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button"
              onClick={() => { onSubmit({ ...form, request_type: type.type, message: form.message || `${type.label} via agenda` }); setAwaitingConfirmation(false) }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor: type.color}}>
              ✓ J'ai pris mon rendez-vous
            </button>
            <button type="button" onClick={() => setAwaitingConfirmation(false)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>← Annuler</button>
          </div>
        </div>
      )
    }

    // ÉTAPE 1 — Formulaire initial avec lien Google Calendar
    return (
      <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{ boxShadow:'0 4px 24px rgba(43,191,179,0.08)' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: type.color + '15' }}>
            <RequestTypeIcon type={type.type} size={22} color={type.color} />
          </div>
          <div><h2 className="font-bold text-base md:text-lg" style={{color:'#1a2b4a'}}>{type.label}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{type.description}</p></div>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#f8fafb' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#e8f8f7' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2BBFB3" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: '#1a2b4a' }}>Réservez un créneau en ligne</p>
              <p className="text-sm" style={{ color: '#8a93a2', lineHeight: '1.6' }}>
                Choisissez directement un créneau qui vous convient dans notre agenda. Vous recevrez une confirmation par email avec le lien de la visio.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Message (optionnel)</label>
          <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={2} placeholder="Précisez le sujet ou vos attentes..." className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href={GOOGLE_CALENDAR_BOOKING_URL} target="_blank" rel="noreferrer"
            onClick={() => setAwaitingConfirmation(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor: type.color}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Choisir un créneau →
          </a>
          <button type="button" onClick={onCancel} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{ boxShadow:'0 4px 24px rgba(43,191,179,0.08)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: type.color + '15' }}>
          <RequestTypeIcon type={type.type} size={22} color={type.color} />
        </div>
        <div><h2 className="font-bold text-base md:text-lg" style={{color:'#1a2b4a'}}>{type.label}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{type.description}</p></div>
      </div>
      <form onSubmit={handleSubmit}>
        {type.type==='codes'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Nombre de codes</label><input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Motif</label><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='assistance'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Type de problème</label><select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="">Sélectionnez...</option><option value="technique">Technique</option><option value="codes">Codes</option><option value="acces">Accès</option><option value="facturation">Facturation</option><option value="autre">Autre</option></select></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Description</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={4} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='renouvellement'&&<><div className="rounded-2xl p-4 mb-6" style={{backgroundColor:'#fef3c7'}}><p className="text-sm font-medium" style={{color:'#d97706'}}>Cette demande déclenchera une révision de votre contrat par notre équipe.</p></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Message</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        <div className="flex flex-col sm:flex-row gap-3"><button type="submit" className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:type.color}}>Envoyer la demande →</button><button type="button" onClick={onCancel} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button></div>
      </form>
    </div>
  )
}

const statusLabels = { pending:{label:'En attente',bg:'#fef3c7',text:'#d97706'}, approved:{label:'Approuvée',bg:'#e8f8f7',text:'#2BBFB3'}, rejected:{label:'Refusée',bg:'#fee2e2',text:'#ef4444'}, in_progress:{label:'En cours',bg:'#e8f0fe',text:'#1a2b4a'} }

// ─── Mini tooltip pour les charts ─────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #f4f5f7' }}>
      <p className="text-xs" style={{ color: '#1a2b4a' }}><span className="font-medium">{label}</span> : {payload[0]?.value}</p>
    </div>
  )
}

// ─── Icônes SVG navigation partenaire ─────────────
function PartnerNavIcon({ icon, active }) {
  const color = active ? 'white' : '#8a93a2'
  switch (icon) {
    case 'dashboard':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill={color}/><rect x="9" y="1" width="6" height="6" rx="1.5" fill={color}/><rect x="1" y="9" width="6" height="6" rx="1.5" fill={color}/><rect x="9" y="9" width="6" height="6" rx="1.5" fill={color}/></svg>)
    case 'codes':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="10" height="7" rx="2" stroke={color} strokeWidth="1.3"/><path d="M11 7.5V6a4 4 0 0 1 4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="8.5" r="1.2" fill={color}/></svg>)
    case 'team':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11 14v-1.5A2.5 2.5 0 0 0 8.5 10h-5A2.5 2.5 0 0 0 1 12.5V14M9.5 1a2.5 2.5 0 0 1 0 5M12 14v-1.5a2.5 2.5 0 0 0-1.5-2.3M6 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>)
    case 'contract':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 1h7l4 4v10H3V1Z" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 1v4h4M6 8h5M6 11h3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>)
    case 'requests':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v10H2V2ZM5 6h6M5 8.5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>)
    case 'new-request':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3l12 5-12 5V9l8-1-8-1V3z" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>)
    case 'profile':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.3"/><path d="M2 14a6 6 0 0 1 12 0" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>)
    case 'help':
      return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.3"/><path d="M6 6a2 2 0 0 1 3.5 1.5c0 1.5-2 1.5-2 3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="12.5" r="0.5" fill={color}/></svg>)
    default:
      return null
  }
}

// Mapping URL → identifiant de page (utilisé pour la sidebar et le rendu)
const ROUTE_TO_PAGE = {
  '': 'dashboard',
  'codes': 'codes',
  'team': 'team',
  'contract': 'contract',
  'requests': 'requests',
  'profile': 'profile',
  'help': 'help',
  'notifications': 'notifications',
}

export default function PartnerDashboard() {
  const { user, partnerId, memberRole, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [codes, setCodes] = useState([])
  const [contract, setContract] = useState(null)
  const [requests, setRequests] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [partnerInfo, setPartnerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeRequestType, setActiveRequestType] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [toast, setToast] = useState(null)

  const activePage = useMemo(() => {
    const seg = location.pathname.replace(/^\/partner\/?/, '').split('/')[0]
    return ROUTE_TO_PAGE[seg] || 'dashboard'
  }, [location.pathname])
  const isNewRequestRoute = location.pathname === '/partner/requests/new'

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => { const c=()=>{const m=window.innerWidth<768;setIsMobile(m);if(m)setSidebarOpen(false)}; c(); window.addEventListener('resize',c); return()=>window.removeEventListener('resize',c) }, [])

  useEffect(() => {
    if (!user || !partnerId) { navigate('/login'); return }
    const fetchData = async () => {
      try {
        const [codesData, contractsData, requestsData, partnerData, benefData] = await Promise.all([
          xano.getAll('plan-activation-code', { partnerId }),
          xano.getAll('contracts', { partner_id: partnerId }),
          xano.getAll('code_request', { partner_id: partnerId }),
          xano.getOne('partners', partnerId),
          xano.getAll('beneficiaries', { partner_id: partnerId }),
        ])
        setCodes(codesData); setContract(contractsData[0] || null); setRequests(requestsData); setPartnerInfo(partnerData); setBeneficiaries(benefData)
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [user, partnerId])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const handleNavClick = path => {
    const target = path === 'dashboard' ? '/partner' : `/partner/${path}`
    navigate(target)
    setActiveRequestType(null)
    if (isMobile) setMobileMenuOpen(false)
  }

  // Synchronise l'URL avec l'état du flux nouvelle demande
  useEffect(() => {
    if (isNewRequestRoute) {
      // entrée sur /partner/requests/new sans type pré-sélectionné
      setActiveRequestType(prev => prev || 'choose')
    } else if (location.pathname === '/partner/requests' || location.pathname === '/partner/requests/') {
      setActiveRequestType(null)
    }
  }, [isNewRequestRoute, location.pathname])

  const handleRequest = async formData => {
    try {
      const created = await xano.create('code_request', {
        quantity: formData.quantity || 1, reason: formData.reason || formData.message || '',
        request_status: 'pending', request_type: formData.request_type,
        preferred_date: formData.preferred_date || null, preferred_date_2: formData.preferred_date_2 || null,
        partner_id: partnerId,
      })

      const reqType = requestTypes.find(t => t.type === formData.request_type)
      const reqDetail = formData.reason || formData.message || formData.quantity ? `${formData.quantity} codes` : '—'
      const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

      // T#13 — Accusé de réception au partenaire
      await sendEmail(user.email, user.name || user.email, 13, {
        PARTNER_NAME: partnerName,
        REQUEST_TYPE: reqType?.label || formData.request_type,
        REQUEST_DETAIL: reqDetail,
        DATE: now,
        LOGIN_URL: 'https://cms-deuil.vercel.app',
      })

      // T#15 — Alerte admin
      await sendEmail(ADMIN_EMAIL, 'Admin Héka', 15, {
        PARTNER_NAME: partnerName,
        REQUEST_TYPE: reqType?.label || formData.request_type,
        REQUEST_DETAIL: reqDetail,
        LINK_CMS: 'https://cms-deuil.vercel.app',
      })

      setRequests([created, ...requests])
      setActiveRequestType(null)
      navigate('/partner/requests')

      if (reqType?.isCalendar) {
        setToast('Rendez-vous confirmé ! Un email de confirmation vous a été envoyé.')
      }
    } catch (err) { console.error('Erreur:', err) }
  }

  const usedCodes = codes.filter(c => c.used).length
  const activationRate = codes.length > 0 ? Math.round((usedCodes / codes.length) * 100) : 0
  const partnerName = partnerInfo?.name || 'Espace partenaire'

  // ─── KPI cockpit (données réellement disponibles) ─
  const assignedSet = new Set(beneficiaries.filter(b => b.code).map(b => b.code))
  const availableCodesCount = codes.filter(c => !c.used && !assignedSet.has(c.code)).length
  const sentCodesCount = codes.filter(c => !c.used && assignedSet.has(c.code)).length
  const benefWithoutCode = beneficiaries.filter(b => !b.code).length
  const openRequests = requests.filter(r => r.request_status === 'pending' || r.request_status === 'in_progress').length

  // Données pour le graphique courbe (envois par semaine sur 12 semaines)
  const sendChartData = useMemo(() => {
    const now = new Date()
    const data = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000)
      const count = beneficiaries.filter(b =>
        b.sent_at && new Date(b.sent_at) >= weekStart && new Date(b.sent_at) < weekEnd
      ).length
      const label = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      data.push({ label, value: count })
    }
    return data
  }, [beneficiaries])

  // Données pour le donut (répartition codes)
  const donutData = useMemo(() => {
    const aSet = new Set(beneficiaries.filter(b => b.code).map(b => b.code))
    const sent = codes.filter(c => !c.used && aSet.has(c.code)).length
    const available = codes.length - usedCodes - sent
    return [
      { name: 'Disponibles', value: available, color: '#2BBFB3' },
      { name: 'Envoyés', value: sent, color: '#3b82f6' },
      { name: 'Activés', value: usedCodes, color: '#1a2b4a' },
    ]
  }, [codes, beneficiaries, usedCodes])

  // Données pour les notifications
  const notifData = useMemo(() => ({
    requests, codes, contract, beneficiaries,
  }), [requests, codes, contract, beneficiaries])

  const navItems = [
    { label:'Tableau de bord', icon:'dashboard', path:'dashboard' },
    { label:'Mes codes', icon:'codes', path:'codes' },
    { label:'Mon équipe', icon:'team', path:'team' },
    { label:'Mon contrat', icon:'contract', path:'contract' },
    { label:'Mes demandes', icon:'requests', path:'requests' },
    { label:'Mon profil', icon:'profile', path:'profile' },
    { label:'Aide', icon:'help', path:'help' },
  ]

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen"><p style={{color:'#8a93a2'}}>Chargement...</p></div>

  return (
    <div className="flex min-h-screen" style={{ backgroundColor:'#f4f5f7' }}>
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-white rounded-2xl px-5 py-4 flex items-center gap-3 max-w-sm animate-[fadeIn_.2s_ease-out]"
          style={{ boxShadow:'0 8px 32px rgba(43,191,179,0.2)', border:'1px solid #e8f8f7' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor:'#e8f8f7' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2BBFB3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </div>
          <p className="text-sm font-medium" style={{ color:'#1a2b4a' }}>{toast}</p>
          <button onClick={() => setToast(null)} className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor:'#f4f5f7' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
          </button>
        </div>
      )}
      {isMobile && mobileMenuOpen && <div className="fixed inset-0 z-40" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={()=>setMobileMenuOpen(false)} />}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-white flex items-center justify-between px-4 py-3" style={{boxShadow:'0 2px 12px rgba(43,191,179,0.08)'}}>
          <div className="flex items-center gap-3">
            <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:'#f4f5f7'}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">{mobileMenuOpen?<path d="M5 5L15 15M15 5L5 15" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>:<path d="M3 5h14M3 10h14M3 15h14" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>}</svg>
            </button>
            <img src="/logo.png" alt="Héka" className="h-8 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <PartnerNotifications data={notifData} onNavigate={handleNavClick} />
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
        <div className="flex items-center justify-between px-4 mb-6">
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

        {/* Partner card */}
        {(sidebarOpen || isMobile) && (
          <div className="px-3 mb-4">
            <div className="rounded-2xl p-3" style={{backgroundColor:'#e8f8f7'}}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{backgroundColor:'#2BBFB3'}}>
                  {partnerName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{color:'#1a2b4a'}}>{partnerName}</p>
                  <p className="text-xs truncate" style={{color:'#8a93a2'}}>{partnerInfo?.partner_type || 'entreprise'}</p>
                </div>
                {!isMobile && <PartnerNotifications data={notifData} onNavigate={handleNavClick} align="left" />}
              </div>
            </div>
          </div>
        )}

        {(sidebarOpen || isMobile) && (
          <p className="text-xs px-5 mb-3 font-semibold tracking-wider" style={{ color: '#8a93a2' }}>
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
              <div className="flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: activePage === item.path ? '#2BBFB3' : '#f4f5f7',
                }}>
                <PartnerNavIcon icon={item.icon} active={activePage === item.path} />
              </div>
              {(sidebarOpen || isMobile) && (
                <span className="text-sm font-medium transition-all"
                  style={{ color: activePage === item.path ? '#2BBFB3' : '#8a93a2' }}>
                  {item.label}
                </span>
              )}
              {!sidebarOpen && !isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                  style={{ backgroundColor: '#1a2b4a' }}>
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* User card */}
        {(sidebarOpen || isMobile) && (
          <div className="px-3 mb-2">
            <div className="rounded-2xl p-3" style={{backgroundColor:'#f4f5f7'}}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{backgroundColor: memberRole === 'admin' ? '#1a2b4a' : '#8a93a2'}}>
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{color:'#1a2b4a'}}>{user.email}</p>
                  <p className="text-xs" style={{color:'#8a93a2'}}>{memberRole === 'admin' ? 'Administrateur' : 'Membre'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Déconnexion */}
        <div className="px-3">
          <button onClick={handleSignOut}
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
              <span className="text-sm font-medium" style={{ color: '#ef4444' }}>Se déconnecter</span>
            )}
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 p-4 md:p-8 overflow-x-hidden" style={{paddingTop:isMobile?'72px':undefined}}>

        {/* ─── Dashboard ─── */}
        {activePage==='dashboard'&&(
          <div>
            <div className="mb-6">
              <h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Bonjour 👋</h1>
              <p className="text-sm mt-1" style={{color:'#8a93a2'}}>
                Bienvenue sur l'espace <strong style={{color:'#2BBFB3'}}>{partnerName}</strong>
              </p>
            </div>

            {/* KPI cockpit */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Codes disponibles" value={availableCodesCount} color="#2BBFB3" />
              <MetricCard label="Codes envoyés" value={sentCodesCount} color="#3b82f6" />
              <MetricCard label="Codes activés" value={usedCodes} color="#1a2b4a" sublabel={codes.length > 0 ? `${activationRate}% du total` : undefined} />
              <MetricCard label="Demandes ouvertes" value={openRequests} color={openRequests > 0 ? '#d97706' : '#8a93a2'} />
            </div>

            {/* À faire maintenant */}
            {(benefWithoutCode > 0 || openRequests > 0 || activationRate > 80) && (
              <div className="bg-white rounded-2xl p-5 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <p className="font-bold text-base mb-3" style={{color:'#1a2b4a'}}>À faire maintenant</p>
                <div className="flex flex-col gap-2">
                  {benefWithoutCode > 0 && (
                    <button onClick={()=>handleNavClick('codes')} className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:translate-x-0.5" style={{backgroundColor:'#f4f5f7'}}>
                      <span className="text-sm" style={{color:'#1a2b4a'}}>
                        <strong>{benefWithoutCode}</strong> salarié{benefWithoutCode>1?'s':''} sans code
                      </span>
                      <span className="text-sm font-semibold" style={{color:'#2BBFB3'}}>Envoyer →</span>
                    </button>
                  )}
                  {openRequests > 0 && (
                    <button onClick={()=>handleNavClick('requests')} className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:translate-x-0.5" style={{backgroundColor:'#f4f5f7'}}>
                      <span className="text-sm" style={{color:'#1a2b4a'}}>
                        <strong>{openRequests}</strong> demande{openRequests>1?'s':''} en cours
                      </span>
                      <span className="text-sm font-semibold" style={{color:'#d97706'}}>Suivre →</span>
                    </button>
                  )}
                  {activationRate > 80 && (
                    <button onClick={()=>{setActiveRequestType(requestTypes[0]);navigate('/partner/requests/new')}} className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:translate-x-0.5" style={{backgroundColor:'#fee2e2'}}>
                      <span className="text-sm" style={{color:'#1a2b4a'}}>
                        <strong>{activationRate}%</strong> des codes activés — pensez à en demander
                      </span>
                      <span className="text-sm font-semibold" style={{color:'#ef4444'}}>Demander →</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── Graphiques ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Courbe évolution envois */}
              <div className="bg-white rounded-2xl p-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <h2 className="text-sm font-bold mb-4" style={{color:'#1a2b4a'}}>Codes envoyés (12 semaines)</h2>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sendChartData}>
                      <defs>
                        <linearGradient id="grad-sends" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2BBFB3" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#2BBFB3" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#2BBFB3" strokeWidth={2} fill="url(#grad-sends)" dot={false} activeDot={{ r: 4, fill: '#2BBFB3' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Donut répartition */}
              <div className="bg-white rounded-2xl p-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <h2 className="text-sm font-bold mb-4" style={{color:'#1a2b4a'}}>Répartition des codes</h2>
                <div style={{ height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {donutData.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs" style={{ color: '#8a93a2' }}>{s.name} ({s.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requestTypes.slice(0,4).map(t=>(
                <button key={t.type} onClick={()=>{setActiveRequestType(t);navigate('/partner/requests/new')}}
                  className="bg-white rounded-2xl p-4 text-left transition-all hover:shadow-md group"
                  style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{backgroundColor:t.color+'15'}}>
                      <RequestTypeIcon type={t.type} size={20} color={t.color} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{color:'#1a2b4a'}}>{t.label}</p>
                      <p className="text-xs mt-0.5" style={{color:'#8a93a2'}}>{t.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activePage==='codes'&&<PartnerCodes partnerId={partnerId} />}
        {activePage==='team'&&<PartnerTeam partnerId={partnerId} />}
        {activePage==='profile'&&<PartnerProfile partnerId={partnerId} />}
        {activePage==='help'&&<PartnerHelp onNavigate={handleNavClick} />}

        {activePage==='contract'&&(
          <div>
            <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Mon contrat</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>Contrat de {partnerName}</p></div>
            {contract ? (
              <div className="bg-white rounded-2xl p-5 md:p-8" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">{[{l:'Statut',v:contract.contract_status},{l:'Début',v:new Date(contract.start_date).toLocaleDateString('fr-FR')},{l:'Fin',v:new Date(contract.end_date).toLocaleDateString('fr-FR')},{l:'Renouvellement auto',v:contract.auto_renewal?'Activé':'Désactivé'},{l:'Codes inclus',v:contract.max_codes},{l:'Tarif',v:`${contract.price}€`}].map(i=><div key={i.l}><p className="text-xs font-semibold mb-1" style={{color:'#8a93a2'}}>{i.l.toUpperCase()}</p><p className="font-semibold" style={{color:'#1a2b4a'}}>{i.v}</p></div>)}</div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">{contract.document_url&&<a href={contract.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>📄 Télécharger</a>}<button onClick={()=>{setActiveRequestType(requestTypes[4]);navigate('/partner/requests/new')}} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>🔄 Renouvellement</button></div>
              </div>
            ) : <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-4xl">📄</span><p className="font-semibold mt-4" style={{color:'#1a2b4a'}}>Aucun contrat</p></div>}
          </div>
        )}

        {activePage==='requests'&&(
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Mes demandes</h1>
                <p className="text-sm mt-1" style={{color:'#8a93a2'}}>{requests.length} demande{requests.length > 1 ? 's' : ''}</p>
              </div>
              {!activeRequestType && (
                <button onClick={()=>navigate('/partner/requests/new')} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold w-full sm:w-auto" style={{backgroundColor:'#2BBFB3'}}>+ Nouvelle demande</button>
              )}
            </div>

            {/* Sélection du type de demande */}
            {activeRequestType === 'choose' && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>Quel type de demande souhaitez-vous faire ?</p>
                  <button onClick={()=>navigate('/partner/requests')} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {requestTypes.map(t=>(
                    <button key={t.type} onClick={()=>setActiveRequestType(t)} className="bg-white rounded-2xl p-5 text-left transition-all hover:shadow-md group" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)', border:'1px solid transparent'}} onMouseEnter={e=>e.currentTarget.style.borderColor=t.color+'40'} onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{backgroundColor:t.color+'15'}}>
                          <RequestTypeIcon type={t.type} size={22} color={t.color} />
                        </div>
                        <p className="font-semibold text-sm" style={{color:'#1a2b4a'}}>{t.label}</p>
                      </div>
                      <p className="text-xs leading-relaxed" style={{color:'#8a93a2'}}>{t.description}</p>
                      {t.isCalendar && (
                        <div className="flex items-center gap-1.5 mt-3">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                          <span className="text-[10px] font-medium" style={{color:t.color}}>Via agenda en ligne</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Formulaire de demande */}
            {activeRequestType && activeRequestType !== 'choose' && (
              <div className="mb-6">
                <RequestForm type={activeRequestType} onSubmit={handleRequest} onCancel={()=>navigate('/partner/requests')} />
              </div>
            )}

            {/* Liste des demandes existantes */}
            {requests.length===0 && !activeRequestType ? (
              <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <span className="text-4xl">📋</span>
                <p className="font-semibold mt-4" style={{color:'#1a2b4a'}}>Aucune demande</p>
                <p className="text-sm mt-1 mb-4" style={{color:'#8a93a2'}}>Faites votre première demande pour commencer</p>
                <button onClick={()=>navigate('/partner/requests/new')} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>+ Nouvelle demande</button>
              </div>
            ) : requests.length > 0 && (
              <div className="flex flex-col gap-3">{requests.map(req=>{const t=requestTypes.find(x=>x.type===req.request_type)||requestTypes[0];const s=statusLabels[req.request_status]||statusLabels.pending;return(
                <div key={req.id} className="bg-white rounded-2xl px-4 md:px-6 py-4 md:py-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:t.color+'15'}}>
                        <RequestTypeIcon type={t.type} size={20} color={t.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{color:'#1a2b4a'}}>{t.label}</p>
                        <p className="text-sm mt-0.5 truncate" style={{color:'#8a93a2'}}>{req.reason || req.message || '—'}</p>
                        <p className="text-xs mt-0.5" style={{color:'#8a93a2'}}>{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR') : ''}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 md:px-3 py-1 rounded-xl font-medium whitespace-nowrap flex-shrink-0" style={{backgroundColor:s.bg,color:s.text}}>{s.label}</span>
                  </div>
                </div>
              )})}</div>
            )}
          </div>
        )}

        {activePage==='notifications'&&(
          <div>
            <div className="mb-6">
              <h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Notifications</h1>
              <p className="text-sm mt-1" style={{color:'#8a93a2'}}>Vos alertes et informations importantes</p>
            </div>
            {(() => {
              const notifs = computePartnerNotifications(notifData)
              if (notifs.length === 0) {
                return (
                  <div className="bg-white rounded-3xl p-10 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                    <span className="text-4xl block mb-3">🔔</span>
                    <p className="font-semibold mb-1" style={{color:'#1a2b4a'}}>Tout est en ordre</p>
                    <p className="text-sm" style={{color:'#8a93a2'}}>Aucune notification pour le moment</p>
                  </div>
                )
              }
              return (
                <div className="flex flex-col gap-3">
                  {notifs.map(n => (
                    <button key={n.id}
                      onClick={() => n.action && handleNavClick(n.action)}
                      className="bg-white rounded-2xl px-4 md:px-6 py-4 md:py-5 text-left transition-all hover:shadow-md"
                      style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:n.bg}}>
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{color:'#1a2b4a'}}>{n.label}</p>
                          <p className="text-xs mt-0.5" style={{color:'#8a93a2'}}>{n.detail}</p>
                        </div>
                        {n.action && <span className="text-sm font-semibold flex-shrink-0" style={{color:n.color}}>→</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}