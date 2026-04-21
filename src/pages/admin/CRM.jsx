import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { Toast, useToast, SearchInput, SkeletonStats, SkeletonList, useDebounce } from '../../components/SharedUI'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

export default function CRM() {
  const [partners, setPartners] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [filterStatus, setFilterStatus] = useState('tous')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityForm, setActivityForm] = useState({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
  const [search, setSearch] = useState('')
  const { toast, showToast, clearToast } = useToast()
  const debouncedSearch = useDebounce(search)
  const [isMobile, setIsMobile] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => { const c=()=>setIsMobile(window.innerWidth<768); c(); window.addEventListener('resize',c); return()=>window.removeEventListener('resize',c) }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [p, a] = await Promise.all([xano.getAll('partners'), xano.getAll('crm_activity')])
        setPartners(p)
        setActivities(a.sort((a, b) => new Date(b.last_contact_at) - new Date(a.last_contact_at)))
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const handleAddActivity = async e => {
    e.preventDefault()
    try {
      const created = await xano.create('crm_activity', { ...activityForm, partner_id: selectedPartner.id, last_contact_at: new Date().toISOString() })
      setActivities(prev => [created, ...prev].sort((a, b) => new Date(b.last_contact_at) - new Date(a.last_contact_at)))
      setShowActivityForm(false)
      setActivityForm({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
      showToast('Activité ajoutée')
    } catch (err) { console.error(err); showToast('Erreur', 'error') }
  }

  const partnerActivities = selectedPartner ? activities.filter(a => a.partner_id === selectedPartner.id) : []

  const filteredPartners = useMemo(() => {
    let list = filterStatus === 'tous' ? partners : partners.filter(p => p.crm_status === filterStatus)
    if (debouncedSearch) { const s = debouncedSearch.toLowerCase(); list = list.filter(p => `${p.name} ${p.contact_firstname} ${p.contact_lastname}`.toLowerCase().includes(s)) }
    return list
  }, [partners, filterStatus, debouncedSearch])

  const stats = {
    total: partners.length,
    aContacter: partners.filter(p => p.crm_status === 'à contacter').length,
    aRelancer: partners.filter(p => p.crm_status === 'à relancer').length,
    actifs: partners.filter(p => p.crm_status === 'client actif').length,
  }

  const selectPartner = p => { setSelectedPartner(p); if (isMobile) setShowDetail(true) }

  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={3} /></div>

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>CRM</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Suivi de la relation partenaires</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[{ label:'Total',value:stats.total,color:'#1a2b4a' },{ label:'À contacter',value:stats.aContacter,color:'#d97706' },{ label:'À relancer',value:stats.aRelancer,color:'#ef4444' },{ label:'Clients actifs',value:stats.actifs,color:'#2BBFB3' }].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-4 md:p-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><p className="text-xl md:text-2xl font-bold mb-1" style={{color:s.color}}>{s.value}</p><p className="text-xs md:text-sm" style={{color:'#8a93a2'}}>{s.label}</p></div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Liste */}
        <div className={`${isMobile && showDetail ? 'hidden' : ''} w-full md:w-96 flex-shrink-0`}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {['tous','à contacter','à relancer','en cours','client actif'].map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)} className="px-3 py-1.5 rounded-xl text-xs font-medium" style={{backgroundColor:filterStatus===s?'#2BBFB3':'#f4f5f7',color:filterStatus===s?'white':'#8a93a2'}}>{s}</button>
            ))}
          </div>
          <div className="mb-3"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher..." /></div>
          <div className="flex flex-col gap-2">
            {filteredPartners.map(p=>(
              <div key={p.id} onClick={()=>selectPartner(p)} className="bg-white rounded-2xl px-4 py-4 cursor-pointer transition-all" style={{boxShadow:selectedPartner?.id===p.id?'0 0 0 2px #2BBFB3':'0 2px 8px rgba(0,0,0,0.04)'}}>
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{backgroundColor:'#2BBFB3'}}>{p.name[0]}</div><p className="font-semibold text-sm" style={{color:'#1a2b4a'}}>{p.name}</p></div></div>
                <div className="flex items-center justify-between"><span className="text-xs px-2 py-1 rounded-lg font-medium" style={{backgroundColor:statusColors[p.crm_status]?.bg||'#f4f5f7',color:statusColors[p.crm_status]?.text||'#8a93a2'}}>{p.crm_status||'prospect'}</span><span className="text-xs" style={{color:'#8a93a2'}}>{activities.filter(a=>a.partner_id===p.id).length} activité(s)</span></div>
              </div>
            ))}
            {filteredPartners.length===0&&<p className="text-sm text-center py-8" style={{color:'#8a93a2'}}>Aucun partenaire</p>}
          </div>
        </div>

        {/* Détail */}
        <div className={`flex-1 ${isMobile && !showDetail ? 'hidden' : ''}`}>
          {isMobile && showDetail && <button onClick={()=>setShowDetail(false)} className="mb-4 text-sm font-medium flex items-center gap-2" style={{color:'#2BBFB3'}}>← Retour</button>}
          {selectedPartner ? (
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3 md:gap-4"><div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-lg md:text-xl font-bold" style={{backgroundColor:'#2BBFB3'}}>{selectedPartner.name[0]}</div><div><h2 className="text-lg md:text-xl font-bold" style={{color:'#1a2b4a'}}>{selectedPartner.name}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{selectedPartner.email_contact} · {selectedPartner.phone}</p></div></div>
                <span className="text-sm px-3 py-1.5 rounded-xl font-medium" style={{backgroundColor:statusColors[selectedPartner.crm_status]?.bg||'#f4f5f7',color:statusColors[selectedPartner.crm_status]?.text||'#8a93a2'}}>{selectedPartner.crm_status||'prospect'}</span>
              </div>
              {selectedPartner.notes_internes&&<div className="rounded-2xl p-4 mb-6" style={{backgroundColor:'#f4f5f7'}}><p className="text-xs font-semibold mb-1" style={{color:'#8a93a2'}}>NOTES</p><p className="text-sm" style={{color:'#1a2b4a'}}>{selectedPartner.notes_internes}</p></div>}
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold" style={{color:'#1a2b4a'}}>Activités ({partnerActivities.length})</h3><button onClick={()=>setShowActivityForm(!showActivityForm)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{backgroundColor:'#2BBFB3'}}>+ Ajouter</button></div>
              {showActivityForm&&(
                <form onSubmit={handleAddActivity} className="rounded-2xl p-4 mb-4" style={{backgroundColor:'#f4f5f7'}}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3"><select value={activityForm.activity_type} onChange={e=>setActivityForm({...activityForm,activity_type:e.target.value})} className="px-3 py-2 rounded-xl text-sm outline-none bg-white"><option value="call">Appel</option><option value="email">Email</option><option value="meeting">Réunion</option><option value="demo">Démo</option></select><input type="date" value={activityForm.next_followup_at} onChange={e=>setActivityForm({...activityForm,next_followup_at:e.target.value})} className="px-3 py-2 rounded-xl text-sm outline-none bg-white" /></div>
                  <textarea value={activityForm.note} onChange={e=>setActivityForm({...activityForm,note:e.target.value})} placeholder="Note..." rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-white mb-3" />
                  <div className="flex gap-2"><button type="submit" className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{backgroundColor:'#2BBFB3'}}>Enregistrer</button><button type="button" onClick={()=>setShowActivityForm(false)} className="px-4 py-2 rounded-xl text-sm bg-white" style={{color:'#8a93a2'}}>Annuler</button></div>
                </form>
              )}
              {partnerActivities.length===0?<p className="text-sm text-center py-6" style={{color:'#8a93a2'}}>Aucune activité</p>:(
                <div className="flex flex-col gap-2">{partnerActivities.map(a=>(
                  <div key={a.id} className="rounded-2xl p-3" style={{backgroundColor:'#f4f5f7'}}>
                    <div className="flex items-center justify-between mb-1"><span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{backgroundColor:'#e8f8f7',color:'#2BBFB3'}}>{a.activity_type}</span><span className="text-xs" style={{color:'#8a93a2'}}>{new Date(a.last_contact_at).toLocaleDateString('fr-FR')}</span></div>
                    {a.note&&<p className="text-sm mt-1" style={{color:'#1a2b4a'}}>{a.note}</p>}
                    {a.next_followup_at&&<p className="text-xs mt-1" style={{color:'#d97706'}}>Relance : {new Date(a.next_followup_at).toLocaleDateString('fr-FR')}</p>}
                  </div>
                ))}</div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)',minHeight:'400px'}}><div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-16" style={{backgroundColor:'#e8f8f7'}}><span className="text-2xl">👆</span></div><p className="font-semibold" style={{color:'#1a2b4a'}}>Sélectionnez un partenaire</p><p className="text-sm mt-1" style={{color:'#8a93a2'}}>pour voir sa fiche et ses activités</p></div>
          )}
        </div>
      </div>
    </div>
  )
}