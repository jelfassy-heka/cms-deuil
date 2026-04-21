import { useState, useEffect, useRef, useMemo } from 'react'
import xano from '../../lib/xano'
import PartnerModal from './PartnerModal'
import { Toast, useToast, useConfirm, SearchInput, EmptyState, Pagination, usePagination, useDebounce, SkeletonList, SkeletonStats, exportToCSV } from '../../components/SharedUI'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

function CSVImportModal({ onClose, onImport }) {
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const fields = [{ key:'name',label:'Nom entreprise' },{ key:'contact_firstname',label:'Prénom' },{ key:'contact_lastname',label:'Nom contact' },{ key:'email_contact',label:'Email' },{ key:'phone',label:'Téléphone' },{ key:'partner_type',label:'Type' },{ key:'contact_role',label:'Poste' }]
  const aliases = { name:['nom','entreprise','société','company','name','organization'], contact_firstname:['prénom','prenom','firstname','first_name'], contact_lastname:['nom contact','lastname','last_name','nom_contact'], email_contact:['email','mail','e-mail','courriel'], phone:['téléphone','telephone','phone','tel','mobile'], partner_type:['type','catégorie','category'], contact_role:['poste','role','fonction','title','job'] }

  const parseCSV = text => { const lines=text.split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2)return{headers:[],rows:[]}; const parseLine=line=>{const r=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++}else q=!q}else if((ch===','||ch===';')&&!q){r.push(c.trim());c=''}else c+=ch};r.push(c.trim());return r}; const headers=parseLine(lines[0]); return{headers,rows:lines.slice(1).map(l=>{const v=parseLine(l);const row={};headers.forEach((h,i)=>{row[h]=v[i]||''});return row})} }

  const autoMap = headers => { const m={}; headers.forEach(h=>{const hl=h.toLowerCase().trim();for(const[f,w]of Object.entries(aliases)){if(w.includes(hl)||w.some(x=>hl.includes(x))){if(!Object.values(m).includes(f)){m[h]=f;break}}}}); return m }

  const handleFile = file => { if(!file)return; const r=new FileReader(); r.onload=e=>{const p=parseCSV(e.target.result);setCsvData(p);setMapping(autoMap(p.headers));setStep(2)}; r.readAsText(file,'UTF-8') }
  const hasRequired = Object.values(mapping).includes('name')

  const handleImport = async () => {
    setStep(3); const total=csvData.rows.length; setProgress({current:0,total,errors:[]}); const imported=[],errors=[]
    for(let i=0;i<total;i++){
      const row=csvData.rows[i]; const p={partner_type:'entreprise',crm_status:'prospect'}
      for(const[col,field]of Object.entries(mapping)){if(field&&row[col])p[field]=row[col]}
      if(!p.name){errors.push({row:i+2,reason:'Nom manquant'});setProgress(prev=>({...prev,current:i+1,errors}));continue}
      try{imported.push(await xano.create('partners',p))}catch(err){errors.push({row:i+2,reason:err.message})}
      setProgress({current:i+1,total,errors})
    }
    setStep(4); onImport(imported)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-xl md:max-h-[90vh] overflow-y-auto" style={{boxShadow:'0 20px 60px rgba(43,191,179,0.15)'}}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10" style={{borderColor:'#f4f5f7'}}>
          <h2 className="text-lg font-bold" style={{color:'#1a2b4a'}}>{step===1&&'Importer des partenaires'}{step===2&&'Mapper les colonnes'}{step===3&&'Import en cours...'}{step===4&&'Terminé'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>×</button>
        </div>
        <div className="p-5">
          {step===1&&<div onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}} onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onClick={()=>fileRef.current?.click()} className="rounded-2xl p-10 text-center cursor-pointer" style={{backgroundColor:dragOver?'#e8f8f7':'#f4f5f7',border:`2px dashed ${dragOver?'#2BBFB3':'#d1d5db'}`}}><input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])} /><span className="text-4xl block mb-4">📄</span><p className="font-semibold" style={{color:'#1a2b4a'}}>Glissez votre CSV ici</p><p className="text-sm mt-1" style={{color:'#8a93a2'}}>ou cliquez pour sélectionner</p></div>}
          {step===2&&<><div className="rounded-xl p-3 mb-4" style={{backgroundColor:'#e8f8f7'}}><p className="text-xs" style={{color:'#2BBFB3'}}>{csvData.rows.length} lignes détectées · {Object.values(mapping).filter(Boolean).length} colonnes mappées</p></div><div className="flex flex-col gap-2 mb-6">{csvData.headers.map(h=><div key={h} className="flex items-center gap-3 rounded-xl p-3" style={{backgroundColor:'#f4f5f7'}}><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{color:'#1a2b4a'}}>{h}</p></div><select value={mapping[h]||''} onChange={e=>setMapping({...mapping,[h]:e.target.value})} className="px-3 py-2 rounded-xl text-sm bg-white" style={{minWidth:'140px'}}><option value="">Ignorer</option>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select></div>)}</div><button onClick={handleImport} disabled={!hasRequired} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:hasRequired?'#2BBFB3':'#d1d5db'}}>Importer {csvData.rows.length} partenaires →</button></>}
          {step===3&&<div className="text-center py-8"><div className="w-full rounded-full h-3 mb-4" style={{backgroundColor:'#f4f5f7'}}><div className="h-3 rounded-full" style={{width:`${(progress.current/progress.total)*100}%`,backgroundColor:'#2BBFB3'}} /></div><p className="font-bold" style={{color:'#1a2b4a'}}>{progress.current}/{progress.total}</p></div>}
          {step===4&&<div className="text-center py-8"><span className="text-4xl block mb-4">✅</span><p className="font-bold" style={{color:'#1a2b4a'}}>{progress.total-progress.errors.length} importé(s)</p>{progress.errors.length>0&&<p className="text-sm mt-2" style={{color:'#ef4444'}}>{progress.errors.length} erreur(s)</p>}<button onClick={onClose} className="mt-6 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>Fermer</button></div>}
        </div>
      </div>
    </div>
  )
}

export default function Partners() {
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('cards')
  const [groupBy, setGroupBy] = useState('none')
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [form, setForm] = useState({ name:'',partner_type:'entreprise',crm_status:'prospect',notes_internes:'' })
  const [contacts, setContacts] = useState([{ firstname:'',lastname:'',role:'',email:'',phone:'' }])
  const { toast, showToast, clearToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const debouncedSearch = useDebounce(search)

  useEffect(() => { xano.getAll('partners').then(setPartners).catch(console.error).finally(()=>setLoading(false)) }, [])

  const handleChange = e => setForm({...form,[e.target.name]:e.target.value})

  const handleSubmit = async e => {
    e.preventDefault()
    try {
      const primary = contacts[0] || {}
      const newPartner = await xano.create('partners', { ...form, contact_firstname:primary.firstname, contact_lastname:primary.lastname, contact_role:primary.role, email_contact:primary.email, phone:primary.phone })
      if (contacts.length > 1) { await Promise.all(contacts.slice(1).map(c=>xano.create('contacts',{partner_id:newPartner.id,first_name:c.firstname,last_name:c.lastname,email:c.email,role:c.role,is_primary:false}))) }
      setPartners([...partners,newPartner])
      setForm({name:'',partner_type:'entreprise',crm_status:'prospect',notes_internes:''})
      setContacts([{firstname:'',lastname:'',role:'',email:'',phone:''}])
      setShowForm(false)
      showToast(`${newPartner.name} ajouté`)
    } catch(err) { console.error(err); showToast('Erreur lors de la création','error') }
  }

  const handleUpdate = updated => { setPartners(partners.map(p=>p.id===updated.id?updated:p)); setSelectedPartner(updated); showToast('Partenaire mis à jour') }

  const processedPartners = useMemo(() => {
    if (!debouncedSearch) return partners
    const s = debouncedSearch.toLowerCase()
    return partners.filter(p=>`${p.name} ${p.contact_firstname} ${p.contact_lastname} ${p.email_contact}`.toLowerCase().includes(s))
  }, [partners, debouncedSearch])

  const { paginated, page, totalPages, setPage, total } = usePagination(processedPartners, 25)

  const groupedPartners = useMemo(() => {
    if (groupBy === 'none') return {}
    return processedPartners.reduce((acc, p) => { const k = p[groupBy] || 'Non défini'; (acc[k] = acc[k] || []).push(p); return acc }, {})
  }, [processedPartners, groupBy])

  const toggleGroup = name => setCollapsedGroups(prev => ({...prev,[name]:!prev[name]}))

  const renderCards = items => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(p=>(
        <div key={p.id} onClick={()=>setSelectedPartner(p)} className="bg-white rounded-2xl px-5 py-4 cursor-pointer transition-all hover:shadow-md" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{backgroundColor:'#2BBFB3'}}>{p.name?.[0]}</div><div className="min-w-0"><p className="font-semibold text-sm truncate" style={{color:'#1a2b4a'}}>{p.name}</p><p className="text-xs truncate" style={{color:'#8a93a2'}}>{p.contact_firstname} {p.contact_lastname}</p></div></div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{backgroundColor:statusColors[p.crm_status]?.bg||'#f4f5f7',color:statusColors[p.crm_status]?.text||'#8a93a2'}}>{p.crm_status||'prospect'}</span><span className="text-xs px-2 py-0.5 rounded-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{p.partner_type||'entreprise'}</span></div>
        </div>
      ))}
    </div>
  )

  const renderTable = items => (
    <div className="bg-white rounded-2xl overflow-x-auto" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
      <table className="w-full text-sm"><thead><tr style={{backgroundColor:'#f4f5f7'}}>{['Nom','Contact','Email','Type','Statut'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{color:'#8a93a2'}}>{h}</th>)}</tr></thead>
      <tbody>{items.map(p=><tr key={p.id} onClick={()=>setSelectedPartner(p)} className="cursor-pointer hover:bg-gray-50" style={{borderTop:'0.5px solid #f4f5f7'}}><td className="px-4 py-3 font-semibold" style={{color:'#1a2b4a'}}>{p.name}</td><td className="px-4 py-3" style={{color:'#8a93a2'}}>{p.contact_firstname} {p.contact_lastname}</td><td className="px-4 py-3" style={{color:'#8a93a2'}}>{p.email_contact}</td><td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{p.partner_type||'entreprise'}</span></td><td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{backgroundColor:statusColors[p.crm_status]?.bg||'#f4f5f7',color:statusColors[p.crm_status]?.text||'#8a93a2'}}>{p.crm_status||'prospect'}</span></td></tr>)}</tbody></table>
    </div>
  )

  const renderKanban = () => {
    const statuses = ['prospect','à contacter','à relancer','en cours','client actif','inactif']
    return <div className="flex gap-4 overflow-x-auto pb-4">{statuses.map(s=>{const items=processedPartners.filter(p=>(p.crm_status||'prospect')===s);return <div key={s} className="flex-shrink-0 w-64"><div className="flex items-center gap-2 mb-3"><span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{backgroundColor:statusColors[s]?.bg,color:statusColors[s]?.text}}>{s}</span><span className="text-xs" style={{color:'#8a93a2'}}>{items.length}</span></div><div className="flex flex-col gap-2">{items.map(p=><div key={p.id} onClick={()=>setSelectedPartner(p)} className="bg-white rounded-xl p-3 cursor-pointer hover:shadow-md" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}><p className="text-sm font-semibold mb-1" style={{color:'#1a2b4a'}}>{p.name}</p><p className="text-xs" style={{color:'#8a93a2'}}>{p.contact_firstname} {p.contact_lastname}</p></div>)}</div></div>})}</div>
  }

  const renderGrouped = fn => {
    if(groupBy==='none') return fn(paginated)
    return <div className="flex flex-col gap-6">{Object.entries(groupedPartners).map(([name,items])=>(
      <div key={name}><button onClick={()=>toggleGroup(name)} className="flex items-center gap-2 mb-3 w-full text-left">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{transform:collapsedGroups[name]?'rotate(-90deg)':'rotate(0deg)',transition:'transform 0.2s'}}><path d="M3 4.5L6 7.5L9 4.5" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{backgroundColor:groupBy==='crm_status'?(statusColors[name]?.bg||'#f4f5f7'):'#f4f5f7',color:groupBy==='crm_status'?(statusColors[name]?.text||'#8a93a2'):'#8a93a2'}}>{name}</span>
        <span className="text-xs" style={{color:'#8a93a2'}}>{items.length}</span>
      </button>{!collapsedGroups[name]&&fn(items)}</div>
    ))}</div>
  }

  if (loading) return <div><SkeletonStats count={3} /><SkeletonList count={4} /></div>

  return (
    <div>
      {ConfirmDialog}
      <Toast toast={toast} onClose={clearToast} />
      {selectedPartner && <PartnerModal partner={selectedPartner} onClose={()=>setSelectedPartner(null)} onUpdate={handleUpdate} />}
      {showImport && <CSVImportModal onClose={()=>setShowImport(false)} onImport={imported=>{setPartners(p=>[...p,...imported]);showToast(`${imported.length} partenaire(s) importé(s)`)}} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
        <div><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Partenaires</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>{processedPartners.length} partenaire{processedPartners.length>1?'s':''}</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>exportToCSV(processedPartners,'partenaires',[{key:'name',label:'Nom'},{key:'contact_firstname',label:'Prénom contact'},{key:'contact_lastname',label:'Nom contact'},{key:'email_contact',label:'Email'},{key:'phone',label:'Téléphone'},{key:'partner_type',label:'Type'},{key:'crm_status',label:'Statut'}])} className="px-4 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📥 Export</button>
          <button onClick={()=>setShowImport(true)} className="px-4 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📄 CSV</button>
          <button onClick={()=>setShowForm(!showForm)} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>+ Ajouter</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, contact, email..." /></div>
        <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{border:'1px solid #f4f5f7'}}>{[{k:'cards',i:'☰',l:'Cartes'},{k:'table',i:'▦',l:'Tableau'},{k:'kanban',i:'◫',l:'Kanban'}].map(v=><button key={v.k} onClick={()=>{setView(v.k);if(v.k==='kanban')setGroupBy('none')}} className="px-3 py-2 text-xs font-medium" style={{backgroundColor:view===v.k?'#2BBFB3':'white',color:view===v.k?'white':'#8a93a2'}}>{v.i}<span className="hidden sm:inline ml-1">{v.l}</span></button>)}</div>
        {view!=='kanban'&&<select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}><option value="none">Pas de groupe</option><option value="crm_status">Par statut</option><option value="partner_type">Par type</option></select>}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.08)'}}>
          <h2 className="font-bold text-lg mb-6" style={{color:'#1a2b4a'}}>Nouveau partenaire</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <input name="name" value={form.name} onChange={handleChange} required placeholder="Nom du Partenaire (Entreprise, Mutuelle...) *" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} />
              <select name="partner_type" value={form.partner_type} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="entreprise">Entreprise</option><option value="mutuelle">Mutuelle</option><option value="prospect">Prospect</option></select>
              <select name="crm_status" value={form.crm_status} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="prospect">Prospect</option><option value="à contacter">À contacter</option><option value="à relancer">À relancer</option><option value="en cours">En cours</option><option value="client actif">Client actif</option><option value="inactif">Inactif</option></select>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>Contacts ({contacts.length})</p><button type="button" onClick={()=>setContacts([...contacts,{firstname:'',lastname:'',role:'',email:'',phone:''}])} className="px-3 py-1.5 rounded-xl text-white text-xs font-medium" style={{backgroundColor:'#2BBFB3'}}>+ Ajouter un contact</button></div>
              {contacts.map((c,idx)=>(
                <div key={idx} className="rounded-2xl p-4 mb-3" style={{backgroundColor:'#f4f5f7'}}>
                  <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold" style={{color:'#8a93a2'}}>CONTACT {idx+1}{idx===0?' — principal':''}</p>{idx>0&&<button type="button" onClick={()=>setContacts(contacts.filter((_,i)=>i!==idx))} className="text-xs px-2 py-1 rounded-lg" style={{color:'#ef4444',backgroundColor:'#fee2e2'}}>Supprimer</button>}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={c.firstname} onChange={e=>{const u=[...contacts];u[idx].firstname=e.target.value;setContacts(u)}} placeholder="Prénom" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" />
                    <input value={c.lastname} onChange={e=>{const u=[...contacts];u[idx].lastname=e.target.value;setContacts(u)}} placeholder="Nom" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" />
                    <input value={c.role} onChange={e=>{const u=[...contacts];u[idx].role=e.target.value;setContacts(u)}} placeholder="Poste (ex: DRH)" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" />
                    <input type="email" value={c.email} onChange={e=>{const u=[...contacts];u[idx].email=e.target.value;setContacts(u)}} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" />
                    <input value={c.phone} onChange={e=>{const u=[...contacts];u[idx].phone=e.target.value;setContacts(u)}} placeholder="Téléphone" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" />
                  </div>
                </div>
              ))}
            </div>
            <textarea name="notes_internes" value={form.notes_internes} onChange={handleChange} placeholder="Notes internes..." rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none mb-6" style={{backgroundColor:'#f4f5f7'}} />
            <div className="flex flex-col sm:flex-row gap-3"><button type="submit" className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>Enregistrer</button><button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button></div>
          </form>
        </div>
      )}

      {processedPartners.length===0&&!showForm ? (
        <EmptyState icon="🏢" title={search?'Aucun résultat':'Aucun partenaire'} message={search?'Essayez avec d\'autres mots-clés':'Cliquez sur "Ajouter" pour commencer'} actionLabel={!search&&'+ Ajouter un partenaire'} onAction={!search?()=>setShowForm(true):undefined} />
      ) : (<>{view==='kanban'&&renderKanban()}{view==='cards'&&renderGrouped(renderCards)}{view==='table'&&renderGrouped(renderTable)}</>)}

      {view!=='kanban'&&groupBy==='none'&&<Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />}
    </div>
  )
}