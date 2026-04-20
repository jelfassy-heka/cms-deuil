import { useState, useEffect, useRef, useMemo } from 'react'
import xano from '../../lib/xano'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

const FIELDS = [
  { key: 'name', label: "Nom de l'organisation", required: true },
  { key: 'contact_firstname', label: 'Prénom contact' },
  { key: 'contact_lastname', label: 'Nom contact' },
  { key: 'contact_role', label: 'Poste' },
  { key: 'email_contact', label: 'Email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'partner_type', label: 'Type' },
  { key: 'crm_status', label: 'Statut CRM' },
  { key: 'notes_internes', label: 'Notes internes' },
]

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = line => {
    const result = []; let current = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes }
      else if ((ch === ',' || ch === ';') && !inQuotes) { result.push(current.trim()); current = '' }
      else current += ch
    }
    result.push(current.trim()); return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => { const v = parseLine(line); const row = {}; headers.forEach((h, i) => { row[h] = v[i] || '' }); return row })
  return { headers, rows }
}

function autoMap(csvHeaders) {
  const mapping = {}
  const aliases = {
    name: ['nom', 'organisation', 'entreprise', 'société', 'company', 'name', 'raison sociale'],
    contact_firstname: ['prénom', 'prenom', 'firstname', 'first_name'],
    contact_lastname: ['nom contact', 'lastname', 'last_name', 'nom de famille'],
    contact_role: ['poste', 'rôle', 'role', 'fonction', 'title', 'job'],
    email_contact: ['email', 'mail', 'e-mail', 'courriel'],
    phone: ['téléphone', 'telephone', 'tel', 'phone', 'mobile'],
    partner_type: ['type', 'catégorie', 'categorie'],
    crm_status: ['statut', 'status', 'état', 'etat'],
    notes_internes: ['notes', 'commentaire', 'remarques'],
  }
  csvHeaders.forEach(header => {
    const h = header.toLowerCase().trim()
    for (const [field, words] of Object.entries(aliases)) {
      if (words.includes(h) || words.some(w => h.includes(w))) { if (!Object.values(mapping).includes(field)) { mapping[header] = field; break } }
    }
  })
  return mapping
}

function CSVImportModal({ onClose, onImport }) {
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = file => { if (!file) return; const r = new FileReader(); r.onload = e => { const p = parseCSV(e.target.result); setCsvData(p); setMapping(autoMap(p.headers)); setStep(2) }; r.readAsText(file, 'UTF-8') }
  const handleDrop = e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }
  const hasName = Object.values(mapping).includes('name')

  const handleImport = async () => {
    setStep(3); const total = csvData.rows.length; setProgress({ current: 0, total, errors: [] })
    const imported = [], errors = []
    for (let i = 0; i < total; i++) {
      const row = csvData.rows[i]; const partner = { partner_type: 'entreprise', crm_status: 'prospect' }
      for (const [col, field] of Object.entries(mapping)) { if (field && row[col]) partner[field] = row[col] }
      if (!partner.name) { errors.push({ row: i+2, reason: 'Nom manquant' }); setProgress(p => ({ ...p, current: i+1, errors })); continue }
      try { imported.push(await xano.create('partners', partner)) } catch (err) { errors.push({ row: i+2, reason: err.message }) }
      setProgress({ current: i+1, total, errors })
    }
    setStep(4); onImport(imported)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{ backgroundColor: 'rgba(26,43,74,0.5)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-2xl md:max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>
        <div className="flex items-center justify-between p-5 md:p-6 border-b sticky top-0 bg-white z-10" style={{ borderColor: '#f4f5f7' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{step === 1 && 'Importer un fichier CSV'}{step === 2 && 'Mapper les colonnes'}{step === 3 && 'Importation en cours...'}{step === 4 && 'Import terminé'}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>{step === 1 && 'Glissez un fichier ou parcourez'}{step === 2 && `${csvData.rows.length} lignes`}{step === 3 && `${progress.current} / ${progress.total}`}{step === 4 && `${progress.total - progress.errors.length} importé(s)`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
        </div>
        <div className="p-5 md:p-6">
          {step === 1 && (
            <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current?.click()} className="rounded-2xl p-10 md:p-16 text-center cursor-pointer transition-all" style={{ backgroundColor: dragOver ? '#e8f8f7' : '#f4f5f7', border: `2px dashed ${dragOver ? '#2BBFB3' : '#d1d5db'}` }}>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              <span className="text-4xl block mb-4">📄</span>
              <p className="font-semibold" style={{ color: '#1a2b4a' }}>Glissez votre fichier CSV ici</p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>ou cliquez pour parcourir</p>
            </div>
          )}
          {step === 2 && (
            <>
              <div className="flex flex-col gap-2 mb-6">
                {csvData.headers.map(header => (
                  <div key={header} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>{header}</p><p className="text-xs truncate" style={{ color: '#8a93a2' }}>ex: {csvData.rows[0]?.[header] || '—'}</p></div>
                    <span className="text-xs" style={{ color: '#8a93a2' }}>→</span>
                    <select value={mapping[header] || ''} onChange={e => setMapping({ ...mapping, [header]: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{ color: mapping[header] ? '#1a2b4a' : '#8a93a2', minWidth: '160px' }}>
                      <option value="">— Ignorer —</option>
                      {FIELDS.map(f => <option key={f.key} value={f.key} disabled={Object.values(mapping).includes(f.key) && mapping[header] !== f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {!hasName && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>Associez au moins "Nom de l'organisation"</div>}
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleImport} disabled={!hasName} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: hasName ? '#2BBFB3' : '#d1d5db' }}>Importer {csvData.rows.length} partenaire{csvData.rows.length > 1 ? 's' : ''} →</button>
                <button onClick={() => setStep(1)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>← Changer de fichier</button>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-full rounded-full h-3 mb-4" style={{ backgroundColor: '#f4f5f7' }}><div className="h-3 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%`, backgroundColor: '#2BBFB3' }} /></div>
              <p className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{progress.current} / {progress.total}</p>
            </div>
          )}
          {step === 4 && (
            <div className="text-center py-8">
              <span className="text-4xl block mb-4">{progress.errors.length === 0 ? '✅' : '⚠️'}</span>
              <p className="text-lg font-bold mb-1" style={{ color: '#1a2b4a' }}>{progress.total - progress.errors.length} importé(s)</p>
              {progress.errors.length > 0 && <div className="mt-4 text-left rounded-xl p-3 max-h-32 overflow-y-auto" style={{ backgroundColor: '#fee2e2' }}>{progress.errors.map((e, i) => <p key={i} className="text-xs mb-1" style={{ color: '#ef4444' }}>Ligne {e.row} : {e.reason}</p>)}</div>}
              <button onClick={onClose} className="mt-6 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: '#2BBFB3' }}>Fermer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PartnerModal({ partner, onClose, onUpdate }) {
  const [activities, setActivities] = useState([])
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...partner })
  const [activityForm, setActivityForm] = useState({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })

  useEffect(() => {
    xano.getAll('crm_activity', { partner_id: partner.id }).then(setActivities).catch(console.error)
  }, [partner.id])

  const handleSave = async () => {
    try {
      const updated = await xano.update('partners', partner.id, {
        name: form.name, partner_type: form.partner_type, email_contact: form.email_contact,
        phone: form.phone, crm_status: form.crm_status, notes_internes: form.notes_internes,
        contact_firstname: form.contact_firstname, contact_lastname: form.contact_lastname, contact_role: form.contact_role,
      })
      onUpdate(updated); setEditing(false)
    } catch (err) { console.error('Erreur:', err) }
  }

  const handleAddActivity = async e => {
    e.preventDefault()
    try {
      const created = await xano.create('crm_activity', { ...activityForm, partner_id: partner.id, last_contact_at: new Date().toISOString() })
      setActivities([created, ...activities]); setShowActivityForm(false)
      setActivityForm({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
    } catch (err) { console.error('Erreur:', err) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{ backgroundColor: 'rgba(26,43,74,0.5)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:w-full md:max-w-3xl md:max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>
        <div className="flex items-start justify-between p-4 md:p-8 pb-4 md:pb-6 border-b sticky top-0 bg-white z-10" style={{ borderColor: '#f4f5f7' }}>
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-lg md:text-2xl font-bold flex-shrink-0" style={{ backgroundColor: '#2BBFB3' }}>{partner.name?.[0]}</div>
            <div className="min-w-0 flex-1">
              {editing ? <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="text-lg font-bold px-3 py-1 rounded-xl outline-none w-full" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} /> : (
                <h2 className="text-lg md:text-xl font-bold truncate" style={{ color: '#1a2b4a' }}>{[partner.contact_firstname, partner.contact_lastname].filter(Boolean).join(' ') || partner.name}{partner.contact_firstname && <span className="text-sm font-normal ml-2 hidden sm:inline" style={{ color: '#8a93a2' }}>— {partner.name}</span>}</h2>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>{partner.partner_type || 'entreprise'}</span>
                <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: statusColors[partner.crm_status]?.bg || '#f4f5f7', color: statusColors[partner.crm_status]?.text || '#8a93a2' }}>{partner.crm_status || 'prospect'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {editing ? (<><button onClick={handleSave} className="px-3 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#2BBFB3' }}>Sauvegarder</button><button onClick={() => { setEditing(false); setForm({ ...partner }) }} className="px-3 py-2 rounded-xl text-sm font-medium hidden sm:block" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>Annuler</button></>) : (
              <button onClick={() => setEditing(true)} className="px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>✏️</button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
          </div>
        </div>
        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>CONTACT PRINCIPAL</p>
              {editing ? (
                <div className="flex flex-col gap-3">{[{ key: 'contact_firstname', p: 'Prénom' },{ key: 'contact_lastname', p: 'Nom' },{ key: 'contact_role', p: 'Poste' },{ key: 'email_contact', p: 'Email' },{ key: 'phone', p: 'Téléphone' }].map(f => <input key={f.key} value={form[f.key]||''} onChange={e => setForm({...form,[f.key]:e.target.value})} placeholder={f.p} className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{color:'#1a2b4a'}} />)}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="font-semibold" style={{ color: '#1a2b4a' }}>{partner.contact_firstname || '—'} {partner.contact_lastname || ''}</p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>{partner.contact_role || 'Non renseigné'}</p>
                  <p className="text-sm" style={{ color: '#2BBFB3' }}>{partner.email_contact || 'Non renseigné'}</p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>{partner.phone || 'Non renseigné'}</p>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>STATUT & TYPE</p>
              {editing ? (
                <div className="flex flex-col gap-3">
                  <select value={form.partner_type||'entreprise'} onChange={e => setForm({...form,partner_type:e.target.value})} className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white"><option value="entreprise">Entreprise</option><option value="mutuelle">Mutuelle</option><option value="prospect">Prospect</option></select>
                  <select value={form.crm_status||'prospect'} onChange={e => setForm({...form,crm_status:e.target.value})} className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white"><option value="prospect">Prospect</option><option value="à contacter">À contacter</option><option value="à relancer">À relancer</option><option value="en cours">En cours</option><option value="client actif">Client actif</option><option value="inactif">Inactif</option></select>
                </div>
              ) : (
                <div className="flex flex-col gap-3">{[{ l: 'Type', v: partner.partner_type||'entreprise' },{ l: 'Statut', v: partner.crm_status||'prospect' },{ l: 'Créé le', v: new Date(partner.created_at).toLocaleDateString('fr-FR') }].map(i => <div key={i.l}><p className="text-xs" style={{color:'#8a93a2'}}>{i.l}</p><p className="text-sm font-medium" style={{color:'#1a2b4a'}}>{i.v}</p></div>)}</div>
              )}
            </div>
          </div>
          <div className="mb-6">
            <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>NOTES INTERNES</p>
            {editing ? <textarea value={form.notes_internes||''} onChange={e => setForm({...form,notes_internes:e.target.value})} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}} /> : (
              <div className="rounded-2xl p-4" style={{backgroundColor:'#f4f5f7'}}><p className="text-sm" style={{color:partner.notes_internes?'#1a2b4a':'#8a93a2'}}>{partner.notes_internes||'Aucune note'}</p></div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold" style={{ color: '#8a93a2' }}>ACTIVITÉS ({activities.length})</p>
              <button onClick={() => setShowActivityForm(!showActivityForm)} className="px-3 py-1.5 rounded-xl text-white text-xs font-medium" style={{ backgroundColor: '#2BBFB3' }}>+ Ajouter</button>
            </div>
            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="rounded-2xl p-4 mb-4" style={{backgroundColor:'#f4f5f7'}}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <select value={activityForm.activity_type} onChange={e => setActivityForm({...activityForm,activity_type:e.target.value})} className="px-3 py-2 rounded-xl text-sm outline-none bg-white"><option value="call">Appel</option><option value="email">Email</option><option value="meeting">Réunion</option><option value="demo">Démo</option></select>
                  <input type="date" value={activityForm.next_followup_at} onChange={e => setActivityForm({...activityForm,next_followup_at:e.target.value})} className="px-3 py-2 rounded-xl text-sm outline-none bg-white" />
                </div>
                <textarea value={activityForm.note} onChange={e => setActivityForm({...activityForm,note:e.target.value})} placeholder="Note..." rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-white mb-3" />
                <div className="flex gap-2"><button type="submit" className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{backgroundColor:'#2BBFB3'}}>Enregistrer</button><button type="button" onClick={() => setShowActivityForm(false)} className="px-4 py-2 rounded-xl text-sm bg-white" style={{color:'#8a93a2'}}>Annuler</button></div>
              </form>
            )}
            <div className="flex flex-col gap-2">
              {activities.length === 0 ? <p className="text-sm text-center py-4" style={{color:'#8a93a2'}}>Aucune activité</p> : activities.map(a => (
                <div key={a.id} className="rounded-2xl p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3" style={{backgroundColor:'#f4f5f7'}}>
                  <span className="text-xs px-2 py-1 rounded-lg font-medium w-fit" style={{backgroundColor:'#e8f8f7',color:'#2BBFB3'}}>{a.activity_type}</span>
                  <div className="flex-1">{a.note && <p className="text-sm mb-1" style={{color:'#1a2b4a'}}>{a.note}</p>}<div className="flex items-center gap-3 flex-wrap"><span className="text-xs" style={{color:'#8a93a2'}}>{new Date(a.last_contact_at).toLocaleDateString('fr-FR')}</span>{a.next_followup_at && <span className="text-xs" style={{color:'#d97706'}}>Relance : {new Date(a.next_followup_at).toLocaleDateString('fr-FR')}</span>}</div></div>
                </div>
              ))}
            </div>
          </div>
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
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [form, setForm] = useState({ name:'',email_contact:'',phone:'',partner_type:'entreprise',crm_status:'prospect',notes_internes:'',contact_firstname:'',contact_lastname:'',contact_role:'' })

  useEffect(() => { xano.getAll('partners').then(setPartners).catch(console.error).finally(() => setLoading(false)) }, [])

  const processedPartners = useMemo(() => {
    let r = [...partners]
    if (search) { const s = search.toLowerCase(); r = r.filter(p => `${p.name} ${p.contact_firstname} ${p.contact_lastname} ${p.email_contact} ${p.contact_role}`.toLowerCase().includes(s)) }
    r.sort((a, b) => { const va = (a[sortField]||'').toString().toLowerCase(); const vb = (b[sortField]||'').toString().toLowerCase(); return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) })
    return r
  }, [partners, search, sortField, sortDir])

  const groupedPartners = useMemo(() => {
    if (groupBy === 'none') return { 'Tous': processedPartners }
    const groups = {}; processedPartners.forEach(p => { const k = p[groupBy]||(groupBy==='crm_status'?'prospect':'entreprise'); if(!groups[k])groups[k]=[]; groups[k].push(p) })
    const order = groupBy==='crm_status'?['prospect','à contacter','à relancer','en cours','client actif','inactif']:['entreprise','mutuelle','prospect']
    const sorted = {}; order.forEach(k => { if(groups[k])sorted[k]=groups[k] }); Object.keys(groups).forEach(k => { if(!sorted[k])sorted[k]=groups[k] }); return sorted
  }, [processedPartners, groupBy])

  const toggleGroup = key => setCollapsedGroups(p => ({...p,[key]:!p[key]}))
  const handleSort = field => { if(sortField===field)setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortField(field);setSortDir('asc')} }
  const handleChange = e => setForm({...form,[e.target.name]:e.target.value})

  const handleSubmit = async e => {
    e.preventDefault()
    try { const n = await xano.create('partners', form); setPartners([...partners,n]); setForm({name:'',email_contact:'',phone:'',partner_type:'entreprise',crm_status:'prospect',notes_internes:'',contact_firstname:'',contact_lastname:'',contact_role:''}); setShowForm(false) }
    catch(err) { console.error(err); alert('Erreur') }
  }

  const handleUpdate = u => { setPartners(partners.map(p=>p.id===u.id?u:p)); setSelectedPartner(u) }

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{color:'#8a93a2'}}>Chargement...</p></div>

  const renderCards = list => (<div className="flex flex-col gap-3">{list.map(p => (
    <div key={p.id} onClick={() => setSelectedPartner(p)} className="bg-white rounded-2xl md:rounded-3xl px-4 md:px-6 py-4 md:py-5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer transition-all hover:shadow-md gap-3" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
      <div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-white" style={{backgroundColor:'#2BBFB3'}}>{p.name?.[0]}</div><div className="min-w-0"><p className="font-semibold truncate" style={{color:'#1a2b4a'}}>{p.name}</p><p className="text-sm truncate" style={{color:'#8a93a2'}}>{p.contact_firstname} {p.contact_lastname}{p.contact_role?` · ${p.contact_role}`:''}</p><p className="text-xs mt-0.5 truncate" style={{color:'#8a93a2'}}>{p.email_contact}</p></div></div>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-xs px-3 py-1 rounded-full font-medium" style={{backgroundColor:statusColors[p.crm_status]?.bg||'#f4f5f7',color:statusColors[p.crm_status]?.text||'#8a93a2'}}>{p.crm_status||'prospect'}</span><span className="text-xs px-3 py-1 rounded-full" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{p.partner_type||'entreprise'}</span></div>
    </div>))}</div>)

  const tableCols = [{key:'name',label:'Organisation'},{key:'contact_firstname',label:'Contact'},{key:'email_contact',label:'Email'},{key:'phone',label:'Téléphone'},{key:'partner_type',label:'Type'},{key:'crm_status',label:'Statut'}]

  const renderTable = list => (
    <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
      <div className="overflow-x-auto"><table className="w-full" style={{minWidth:'700px'}}><thead><tr style={{backgroundColor:'#f4f5f7'}}>{tableCols.map(c=><th key={c.key} onClick={()=>handleSort(c.key)} className="px-4 py-3 text-left text-xs font-semibold cursor-pointer" style={{color:'#8a93a2'}}>{c.label}{sortField===c.key&&<span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}</th>)}</tr></thead>
      <tbody>{list.map((p,i)=><tr key={p.id} onClick={()=>setSelectedPartner(p)} className="cursor-pointer" style={{borderTop:i>0?'1px solid #f4f5f7':'none'}} onMouseEnter={e=>e.currentTarget.style.backgroundColor='#fafbfc'} onMouseLeave={e=>e.currentTarget.style.backgroundColor=''}>
        <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor:'#2BBFB3'}}>{p.name?.[0]}</div><span className="text-sm font-medium" style={{color:'#1a2b4a'}}>{p.name}</span></div></td>
        <td className="px-4 py-3 text-sm" style={{color:'#1a2b4a'}}>{[p.contact_firstname,p.contact_lastname].filter(Boolean).join(' ')||'—'}</td>
        <td className="px-4 py-3 text-sm" style={{color:'#8a93a2'}}>{p.email_contact||'—'}</td>
        <td className="px-4 py-3 text-sm" style={{color:'#8a93a2'}}>{p.phone||'—'}</td>
        <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{p.partner_type||'entreprise'}</span></td>
        <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-lg font-medium" style={{backgroundColor:statusColors[p.crm_status]?.bg||'#f4f5f7',color:statusColors[p.crm_status]?.text||'#8a93a2'}}>{p.crm_status||'prospect'}</span></td>
      </tr>)}</tbody></table></div></div>)

  const kanbanStatuses = ['prospect','à contacter','à relancer','en cours','client actif','inactif']
  const kanbanGroups = {}; kanbanStatuses.forEach(s=>{kanbanGroups[s]=processedPartners.filter(p=>(p.crm_status||'prospect')===s)})

  const renderKanban = () => (<div className="flex gap-4 overflow-x-auto pb-4" style={{minHeight:'400px'}}>{kanbanStatuses.map(s=>(
    <div key={s} className="flex-shrink-0" style={{width:'260px'}}>
      <div className="flex items-center gap-2 mb-3 px-1"><div className="w-3 h-3 rounded-full" style={{backgroundColor:statusColors[s]?.text||'#8a93a2'}} /><p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>{s}</p><span className="text-xs px-1.5 py-0.5 rounded-md ml-auto" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{kanbanGroups[s].length}</span></div>
      <div className="flex flex-col gap-2">{kanbanGroups[s].map(p=>(
        <div key={p.id} onClick={()=>setSelectedPartner(p)} className="bg-white rounded-2xl p-4 cursor-pointer hover:shadow-md" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
          <div className="flex items-center gap-2 mb-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor:'#2BBFB3'}}>{p.name?.[0]}</div><p className="text-sm font-semibold truncate" style={{color:'#1a2b4a'}}>{p.name}</p></div>
          {p.email_contact&&<p className="text-xs truncate" style={{color:'#2BBFB3'}}>{p.email_contact}</p>}
        </div>
      ))}{kanbanGroups[s].length===0&&<div className="rounded-2xl p-4 text-center" style={{backgroundColor:'#f4f5f7'}}><p className="text-xs" style={{color:'#8a93a2'}}>Aucun</p></div>}</div>
    </div>))}</div>)

  const renderGrouped = fn => {
    if(groupBy==='none') return fn(processedPartners)
    return <div className="flex flex-col gap-6">{Object.entries(groupedPartners).map(([name,items])=>(
      <div key={name}><button onClick={()=>toggleGroup(name)} className="flex items-center gap-2 mb-3 w-full text-left">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{transform:collapsedGroups[name]?'rotate(-90deg)':'rotate(0deg)',transition:'transform 0.2s'}}><path d="M3 4.5L6 7.5L9 4.5" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{backgroundColor:groupBy==='crm_status'?(statusColors[name]?.bg||'#f4f5f7'):'#f4f5f7',color:groupBy==='crm_status'?(statusColors[name]?.text||'#8a93a2'):'#8a93a2'}}>{name}</span>
        <span className="text-xs" style={{color:'#8a93a2'}}>{items.length}</span>
      </button>{!collapsedGroups[name]&&fn(items)}</div>
    ))}</div>
  }

  return (
    <div>
      {selectedPartner && <PartnerModal partner={selectedPartner} onClose={()=>setSelectedPartner(null)} onUpdate={handleUpdate} />}
      {showImport && <CSVImportModal onClose={()=>setShowImport(false)} onImport={imported=>setPartners(p=>[...p,...imported])} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
        <div><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Partenaires</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>{processedPartners.length} partenaire{processedPartners.length>1?'s':''}</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>setShowImport(true)} className="px-4 py-3 rounded-2xl text-sm font-semibold flex-1 sm:flex-initial" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📄 Importer CSV</button>
          <button onClick={()=>setShowForm(!showForm)} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold flex-1 sm:flex-initial" style={{backgroundColor:'#2BBFB3'}}>+ Ajouter</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}} />
        <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{border:'1px solid #f4f5f7'}}>{[{k:'cards',i:'☰',l:'Cartes'},{k:'table',i:'▦',l:'Tableau'},{k:'kanban',i:'◫',l:'Kanban'}].map(v=><button key={v.k} onClick={()=>{setView(v.k);if(v.k==='kanban')setGroupBy('none')}} className="px-3 py-2 text-xs font-medium" style={{backgroundColor:view===v.k?'#2BBFB3':'white',color:view===v.k?'white':'#8a93a2'}}>{v.i}<span className="hidden sm:inline ml-1">{v.l}</span></button>)}</div>
        {view!=='kanban'&&<select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}><option value="none">Pas de groupe</option><option value="crm_status">Par statut</option><option value="partner_type">Par type</option></select>}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.08)'}}>
          <h2 className="font-bold text-lg mb-6" style={{color:'#1a2b4a'}}>Nouveau partenaire</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {[{n:'name',p:"Nom *",r:true},{n:'contact_firstname',p:'Prénom'},{n:'contact_lastname',p:'Nom contact'},{n:'contact_role',p:'Poste'},{n:'email_contact',p:'Email',t:'email'},{n:'phone',p:'Téléphone'}].map(f=><input key={f.n} name={f.n} value={form[f.n]} onChange={handleChange} required={f.r} placeholder={f.p} type={f.t||'text'} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} />)}
              <select name="partner_type" value={form.partner_type} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="entreprise">Entreprise</option><option value="mutuelle">Mutuelle</option><option value="prospect">Prospect</option></select>
              <select name="crm_status" value={form.crm_status} onChange={handleChange} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="prospect">Prospect</option><option value="à contacter">À contacter</option><option value="à relancer">À relancer</option><option value="en cours">En cours</option><option value="client actif">Client actif</option><option value="inactif">Inactif</option></select>
            </div>
            <textarea name="notes_internes" value={form.notes_internes} onChange={handleChange} placeholder="Notes..." rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none mb-6" style={{backgroundColor:'#f4f5f7'}} />
            <div className="flex flex-col sm:flex-row gap-3"><button type="submit" className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>Enregistrer</button><button type="button" onClick={()=>setShowForm(false)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button></div>
          </form>
        </div>
      )}

      {processedPartners.length===0&&!showForm ? (
        <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-4xl">🏢</span><p className="font-bold text-lg mt-4" style={{color:'#1a2b4a'}}>{search?'Aucun résultat':'Aucun partenaire'}</p></div>
      ) : (<>{view==='kanban'&&renderKanban()}{view==='cards'&&renderGrouped(renderCards)}{view==='table'&&renderGrouped(renderTable)}</>)}
    </div>
  )
}