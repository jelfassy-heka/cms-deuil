import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import xano from '../../lib/xano'
import PartnerCodes from './PartnerCodes'
import PartnerTeam from './PartnerTeam'

const requestTypes = [
  { type:'codes', label:'Demande de codes', icon:'🔑', description:'Demander des codes supplémentaires', color:'#2BBFB3' },
  { type:'rdv', label:'Demande de RDV', icon:'📅', description:'Planifier un rendez-vous', color:'#1a2b4a' },
  { type:'assistance', label:'Demande d\'assistance', icon:'🛟', description:'Obtenir de l\'aide', color:'#d97706' },
  { type:'demo', label:'Demande de démo', icon:'🎯', description:'Découvrir les fonctionnalités', color:'#8b5cf6' },
  { type:'renouvellement', label:'Renouvellement contrat', icon:'📄', description:'Renouveler votre contrat', color:'#ef4444' },
]

function RequestForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({ quantity:1, reason:'', preferred_date:'', preferred_date_2:'', message:'' })
  const handleSubmit = e => { e.preventDefault(); onSubmit({ ...form, request_type: type.type }) }

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{ boxShadow:'0 4px 24px rgba(43,191,179,0.08)' }}>
      <div className="flex items-center gap-3 mb-6"><span className="text-2xl">{type.icon}</span><div><h2 className="font-bold text-base md:text-lg" style={{color:'#1a2b4a'}}>{type.label}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{type.description}</p></div></div>
      <form onSubmit={handleSubmit}>
        {type.type==='codes'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Nombre de codes</label><input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Motif</label><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='rdv'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Créneau préféré</label><input type="datetime-local" value={form.preferred_date} onChange={e=>setForm({...form,preferred_date:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Créneau alternatif</label><input type="datetime-local" value={form.preferred_date_2} onChange={e=>setForm({...form,preferred_date_2:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Objet</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='assistance'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Type de problème</label><select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="">Sélectionnez...</option><option value="technique">Technique</option><option value="codes">Codes</option><option value="acces">Accès</option><option value="facturation">Facturation</option><option value="autre">Autre</option></select></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Description</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={4} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='demo'&&<><div className="mb-4"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Créneau</label><input type="datetime-local" value={form.preferred_date} onChange={e=>setForm({...form,preferred_date:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Message</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        {type.type==='renouvellement'&&<><div className="rounded-2xl p-4 mb-6" style={{backgroundColor:'#fef3c7'}}><p className="text-sm font-medium" style={{color:'#d97706'}}>⚠️ Cette demande déclenchera une révision de votre contrat.</p></div><div className="mb-6"><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Message</label><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7'}} /></div></>}
        <div className="flex flex-col sm:flex-row gap-3"><button type="submit" className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:type.color}}>Envoyer →</button><button type="button" onClick={onCancel} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button></div>
      </form>
    </div>
  )
}

const statusLabels = { pending:{label:'En attente',bg:'#fef3c7',text:'#d97706'}, approved:{label:'Approuvée',bg:'#e8f8f7',text:'#2BBFB3'}, rejected:{label:'Refusée',bg:'#fee2e2',text:'#ef4444'}, in_progress:{label:'En cours',bg:'#e8f0fe',text:'#1a2b4a'} }

export default function PartnerDashboard() {
  const { user, partnerId, memberRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [codes, setCodes] = useState([])
  const [contract, setContract] = useState(null)
  const [requests, setRequests] = useState([])
  const [partnerInfo, setPartnerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeRequestType, setActiveRequestType] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c=()=>setIsMobile(window.innerWidth<768); c(); window.addEventListener('resize',c); return()=>window.removeEventListener('resize',c) }, [])

  useEffect(() => {
    if (!user || !partnerId) { navigate('/login'); return }
    const fetchData = async () => {
      try {
        const [codesData, contractsData, requestsData, partnerData] = await Promise.all([
          xano.getAll('plan-activation-code', { partnerId }),
          xano.getAll('contracts', { partner_id: partnerId }),
          xano.getAll('code_request', { partner_id: partnerId }),
          xano.getOne('partners', partnerId),
        ])
        setCodes(codesData); setContract(contractsData[0] || null); setRequests(requestsData); setPartnerInfo(partnerData)
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [user, partnerId])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const handleNavClick = path => { setActivePage(path); setActiveRequestType(null); if(isMobile) setMobileMenuOpen(false) }

  const handleRequest = async formData => {
    try {
      const created = await xano.create('code_request', {
        quantity: formData.quantity || 1, reason: formData.reason || formData.message || '',
        request_status: 'pending', request_type: formData.request_type,
        preferred_date: formData.preferred_date || null, preferred_date_2: formData.preferred_date_2 || null,
        partner_id: partnerId,
      })
      setRequests([created, ...requests]); setActiveRequestType(null); setActivePage('requests')
    } catch (err) { console.error('Erreur:', err) }
  }

  const usedCodes = codes.filter(c => c.used).length
  const unusedCodes = codes.length - usedCodes
  const usageRate = codes.length > 0 ? Math.round((usedCodes / codes.length) * 100) : 0
  const partnerName = partnerInfo?.name || 'Espace partenaire'

  const navItems = [
    { label:'Tableau de bord', icon:'⊞', path:'dashboard' },
    { label:'Mes codes', icon:'🔑', path:'codes' },
    { label:'Mon équipe', icon:'👥', path:'team' },
    { label:'Mon contrat', icon:'📄', path:'contract' },
    { label:'Mes demandes', icon:'📋', path:'requests' },
    { label:'Nouvelle demande', icon:'✉️', path:'new_request' },
  ]

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p style={{color:'#8a93a2'}}>Chargement...</p></div>

  return (
    <div className="flex min-h-screen" style={{ backgroundColor:'#f4f5f7' }}>
      {isMobile && mobileMenuOpen && <div className="fixed inset-0 z-40" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={()=>setMobileMenuOpen(false)} />}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-white flex items-center justify-between px-4 py-3" style={{boxShadow:'0 2px 12px rgba(43,191,179,0.08)'}}>
          <div className="flex items-center gap-3">
            <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:'#f4f5f7'}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">{mobileMenuOpen?<path d="M5 5L15 15M15 5L5 15" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>:<path d="M3 5h14M3 10h14M3 15h14" stroke="#2BBFB3" strokeWidth="1.5" strokeLinecap="round"/>}</svg>
            </button>
            <img src="/logo.png" alt="Héka" className="h-8 rounded-lg" />
          </div>
          <p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>{navItems.find(n=>n.path===activePage)?.label||'Tableau de bord'}</p>
        </div>
      )}

      {/* Sidebar */}
      <div className={`bg-white flex flex-col py-6 px-4 transition-all duration-300 ${isMobile?`fixed top-0 left-0 bottom-0 z-50 ${mobileMenuOpen?'translate-x-0':'-translate-x-full'}`:'relative'}`} style={{width:isMobile?'280px':'256px',boxShadow:'2px 0 12px rgba(43,191,179,0.06)'}}>

        {/* Logo + partner name */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between">
            <img src="/logo.png" alt="Héka" className="h-10 rounded-xl" />
            {isMobile&&<button onClick={()=>setMobileMenuOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{backgroundColor:'#f4f5f7'}}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/></svg></button>}
          </div>
        </div>

        {/* Partner card in sidebar */}
        <div className="px-2 mb-6">
          <div className="rounded-2xl p-3" style={{backgroundColor:'#e8f8f7'}}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{backgroundColor:'#2BBFB3'}}>
                {partnerName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{color:'#1a2b4a'}}>{partnerName}</p>
                <p className="text-xs truncate" style={{color:'#8a93a2'}}>{partnerInfo?.partner_type || 'entreprise'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1">
          {navItems.map(item=>(
            <button key={item.path} onClick={()=>handleNavClick(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-1 text-sm font-medium transition-all"
              style={{backgroundColor:activePage===item.path?'#e8f8f7':'transparent',color:activePage===item.path?'#2BBFB3':'#8a93a2'}}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>

        {/* User card + logout */}
        <div className="px-2 mb-2">
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

        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium" style={{color:'#ef4444'}}>
          ← Se déconnecter
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 p-4 md:p-8 overflow-x-hidden" style={{paddingTop:isMobile?'72px':undefined}}>

        {/* Dashboard */}
        {activePage==='dashboard'&&(
          <div>
            {/* Welcome header with partner name */}
            <div className="mb-6">
              <h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Bonjour 👋</h1>
              <p className="text-sm mt-1" style={{color:'#8a93a2'}}>
                Bienvenue sur l'espace <strong style={{color:'#2BBFB3'}}>{partnerName}</strong>
                {user.email && <span> — connecté en tant que {user.email}</span>}
              </p>
            </div>

            {/* Partner info card */}
            <div className="bg-white rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
              style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{backgroundColor:'#2BBFB3'}}>
                {partnerName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold" style={{color:'#1a2b4a'}}>{partnerName}</p>
                <p className="text-sm" style={{color:'#8a93a2'}}>
                  {partnerInfo?.partner_type || 'entreprise'}
                  {partnerInfo?.email_contact && <span> · {partnerInfo.email_contact}</span>}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold" style={{color:'#2BBFB3'}}>{unusedCodes}</p>
                  <p className="text-xs" style={{color:'#8a93a2'}}>Codes dispo</p>
                </div>
                <div className="text-center" style={{borderLeft:'1px solid #f4f5f7', paddingLeft:'16px'}}>
                  <p className="text-xl font-bold" style={{color:'#1a2b4a'}}>{usedCodes}</p>
                  <p className="text-xs" style={{color:'#8a93a2'}}>Utilisés</p>
                </div>
                <div className="text-center" style={{borderLeft:'1px solid #f4f5f7', paddingLeft:'16px'}}>
                  <p className="text-xl font-bold" style={{color:usageRate>80?'#ef4444':'#2BBFB3'}}>{usageRate}%</p>
                  <p className="text-xs" style={{color:'#8a93a2'}}>Utilisation</p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-white rounded-2xl p-5 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold" style={{color:'#1a2b4a'}}>Utilisation des codes</p>
                <span className="text-sm font-semibold" style={{color:usageRate>80?'#ef4444':'#2BBFB3'}}>{usageRate}%</span>
              </div>
              <div className="w-full rounded-full h-3" style={{backgroundColor:'#f4f5f7'}}>
                <div className="h-3 rounded-full" style={{width:`${usageRate}%`,backgroundColor:usageRate>80?'#ef4444':'#2BBFB3'}} />
              </div>
              {usageRate > 80 && <p className="text-sm mt-3" style={{color:'#ef4444'}}>⚠️ Vous approchez de la limite — pensez à demander de nouveaux codes</p>}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requestTypes.slice(0,4).map(t=>(
                <button key={t.type} onClick={()=>{setActivePage('new_request');setActiveRequestType(t)}}
                  className="bg-white rounded-2xl p-4 text-left hover:shadow-md"
                  style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                  <span className="text-2xl">{t.icon}</span>
                  <p className="font-semibold mt-2 text-sm" style={{color:'#1a2b4a'}}>{t.label}</p>
                  <p className="text-xs mt-1" style={{color:'#8a93a2'}}>{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activePage==='codes'&&<PartnerCodes partnerId={partnerId} />}
        {activePage==='team'&&<PartnerTeam partnerId={partnerId} />}

        {activePage==='contract'&&(
          <div>
            <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Mon contrat</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>Contrat de {partnerName}</p></div>
            {contract ? (
              <div className="bg-white rounded-2xl p-5 md:p-8" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">{[{l:'Statut',v:contract.contract_status},{l:'Début',v:new Date(contract.start_date).toLocaleDateString('fr-FR')},{l:'Fin',v:new Date(contract.end_date).toLocaleDateString('fr-FR')},{l:'Renouvellement auto',v:contract.auto_renewal?'Activé':'Désactivé'},{l:'Codes inclus',v:contract.max_codes},{l:'Tarif',v:`${contract.price}€`}].map(i=><div key={i.l}><p className="text-xs font-semibold mb-1" style={{color:'#8a93a2'}}>{i.l.toUpperCase()}</p><p className="font-semibold" style={{color:'#1a2b4a'}}>{i.v}</p></div>)}</div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">{contract.document_url&&<a href={contract.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>📄 Télécharger</a>}<button onClick={()=>{setActivePage('new_request');setActiveRequestType(requestTypes[4])}} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>🔄 Renouvellement</button></div>
              </div>
            ) : <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-4xl">📄</span><p className="font-semibold mt-4" style={{color:'#1a2b4a'}}>Aucun contrat</p></div>}
          </div>
        )}

        {activePage==='new_request'&&(
          <div>
            <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Nouvelle demande</h1></div>
            {!activeRequestType ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{requestTypes.map(t=><button key={t.type} onClick={()=>setActiveRequestType(t)} className="bg-white rounded-2xl p-5 text-left hover:shadow-md" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{backgroundColor:t.color+'20'}}>{t.icon}</div><p className="font-semibold" style={{color:'#1a2b4a'}}>{t.label}</p></div><p className="text-sm" style={{color:'#8a93a2'}}>{t.description}</p></button>)}</div>
            ) : <RequestForm type={activeRequestType} onSubmit={handleRequest} onCancel={()=>setActiveRequestType(null)} />}
          </div>
        )}

        {activePage==='requests'&&(
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3"><div><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Mes demandes</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>{requests.length} demande(s)</p></div><button onClick={()=>{setActivePage('new_request');setActiveRequestType(null)}} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold w-full sm:w-auto" style={{backgroundColor:'#2BBFB3'}}>+ Nouvelle demande</button></div>
            {requests.length===0 ? <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-4xl">📋</span><p className="font-semibold mt-4" style={{color:'#1a2b4a'}}>Aucune demande</p></div> : (
              <div className="flex flex-col gap-3">{requests.map(req=>{const t=requestTypes.find(x=>x.type===req.request_type)||requestTypes[0];const s=statusLabels[req.request_status]||statusLabels.pending;return(
                <div key={req.id} className="bg-white rounded-2xl px-4 md:px-6 py-4 md:py-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{backgroundColor:t.color+'20'}}>{t.icon}</div><div className="min-w-0"><p className="font-semibold truncate" style={{color:'#1a2b4a'}}>{t.label}</p><p className="text-sm mt-0.5 truncate" style={{color:'#8a93a2'}}>{req.reason||'—'}</p><p className="text-xs mt-0.5" style={{color:'#8a93a2'}}>{req.created_at?new Date(req.created_at).toLocaleDateString('fr-FR'):''}</p></div></div><span className="text-xs px-2 md:px-3 py-1 rounded-xl font-medium whitespace-nowrap flex-shrink-0" style={{backgroundColor:s.bg,color:s.text}}>{s.label}</span></div></div>
              )})}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}