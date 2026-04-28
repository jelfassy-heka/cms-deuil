import { useState, useRef, useMemo } from 'react'
import { Toast, useToast, ConfirmModal, useConfirm, SearchInput, CopyButton, SkeletonStats, SkeletonList, useDebounce, EmptyState, exportToCSV, MetricCard, StatusBadge } from '../../components/SharedUI'
import * as partnerApi from '../../api/partnerApi'
import { usePartnerCodes } from '../../hooks/usePartnerCodes'
import { computeCodeStats, enrichBeneficiaries, countByEnrichedStatus } from '../../utils/partnerMetrics'

// Masque un code en ne laissant visibles que les 3 derniers caractères
const maskCode = (code) => {
  if (!code) return ''
  if (code.length <= 4) return code
  return '••••' + code.slice(-3)
}

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#d97706', bg: '#fef3c7', order: 0 },
  sent: { label: 'Envoyé', color: '#2BBFB3', bg: '#e8f8f7', order: 1 },
  opened: { label: 'Ouvert', color: '#3b82f6', bg: '#dbeafe', order: 2 },
  activated: { label: 'Activé', color: '#1a2b4a', bg: '#e8f0fe', order: 3 },
}

const BENEF_FIELDS = [
  { key: 'first_name', label: 'Prénom', required: true },
  { key: 'last_name', label: 'Nom', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'department', label: 'Service' },
]

// ─── CSV parser ───────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = line => { const r=[]; let c='',q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++}else q=!q}else if((ch===','||ch===';')&&!q){r.push(c.trim());c=''}else c+=ch}; r.push(c.trim()); return r }
  const headers = parseLine(lines[0])
  return { headers, rows: lines.slice(1).map(l => { const v=parseLine(l); const row={}; headers.forEach((h,i)=>{row[h]=v[i]||''}); return row }) }
}

function autoMap(csvHeaders) {
  const mapping = {}
  const aliases = { first_name:['prénom','prenom','firstname'], last_name:['nom','lastname','last_name'], email:['email','mail','e-mail'], department:['service','département','department'] }
  csvHeaders.forEach(h => { const hl=h.toLowerCase().trim(); for(const[f,w]of Object.entries(aliases)){if(w.includes(hl)||w.some(x=>hl.includes(x))){if(!Object.values(mapping).includes(f)){mapping[h]=f;break}}} })
  return mapping
}

// ─── Import Modal ─────────────────────────────────
function ImportModal({ onClose, onImport, partnerId }) {
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = file => { if(!file)return; const r=new FileReader(); r.onload=e=>{const p=parseCSV(e.target.result);setCsvData(p);setMapping(autoMap(p.headers));setStep(2)}; r.readAsText(file,'UTF-8') }
  const hasRequired = ['first_name','last_name','email'].every(f => Object.values(mapping).includes(f))

  const handleImport = async () => {
    setStep(3); const total=csvData.rows.length; setProgress({current:0,total,errors:[]}); const imported=[],errors=[]
    for(let i=0;i<total;i++){
      const row=csvData.rows[i]; const b={partner_id:partnerId}
      for(const[col,field]of Object.entries(mapping)){if(field&&row[col])b[field]=row[col]}
      if(!b.first_name||!b.email){errors.push({row:i+2,reason:'Données manquantes'});setProgress(p=>({...p,current:i+1,errors}));continue}
      try{imported.push(await partnerApi.createBeneficiary(b))}catch(err){errors.push({row:i+2,reason:err.message})}
      setProgress({current:i+1,total,errors})
    }
    setStep(4); onImport(imported)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-xl md:max-h-[90vh] overflow-y-auto" style={{boxShadow:'0 20px 60px rgba(43,191,179,0.15)'}}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10" style={{borderColor:'#f4f5f7'}}><h2 className="text-lg font-bold" style={{color:'#1a2b4a'}}>{step===1&&'Importer des salariés'}{step===2&&'Mapper les colonnes'}{step===3&&'Import...'}{step===4&&'Terminé'}</h2><button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>×</button></div>
        <div className="p-5">
          {step===1&&<div onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}} onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onClick={()=>fileRef.current?.click()} className="rounded-2xl p-10 text-center cursor-pointer" style={{backgroundColor:dragOver?'#e8f8f7':'#f4f5f7',border:`2px dashed ${dragOver?'#2BBFB3':'#d1d5db'}`}}><input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])} /><span className="text-4xl block mb-4">👥</span><p className="font-semibold" style={{color:'#1a2b4a'}}>Glissez votre CSV ici</p></div>}
          {step===2&&<><div className="flex flex-col gap-2 mb-6">{csvData.headers.map(h=><div key={h} className="flex items-center gap-3 rounded-xl p-3" style={{backgroundColor:'#f4f5f7'}}><p className="text-sm font-medium truncate flex-1" style={{color:'#1a2b4a'}}>{h}</p><select value={mapping[h]||''} onChange={e=>setMapping({...mapping,[h]:e.target.value})} className="px-3 py-2 rounded-xl text-sm bg-white" style={{minWidth:'140px'}}><option value="">Ignorer</option>{BENEF_FIELDS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select></div>)}</div><button onClick={handleImport} disabled={!hasRequired} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:hasRequired?'#2BBFB3':'#d1d5db'}}>Importer →</button></>}
          {step===3&&<div className="text-center py-8"><div className="w-full rounded-full h-3 mb-4" style={{backgroundColor:'#f4f5f7'}}><div className="h-3 rounded-full" style={{width:`${(progress.current/progress.total)*100}%`,backgroundColor:'#2BBFB3'}} /></div><p className="font-bold" style={{color:'#1a2b4a'}}>{progress.current}/{progress.total}</p></div>}
          {step===4&&<div className="text-center py-8"><span className="text-4xl block mb-4">✅</span><p className="font-bold" style={{color:'#1a2b4a'}}>{progress.total-progress.errors.length} importé(s)</p><button onClick={onClose} className="mt-6 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>Fermer</button></div>}
        </div>
      </div>
    </div>
  )
}

// ─── Add Beneficiary Modal ────────────────────────
function AddBeneficiaryModal({ onClose, onAdd, partnerId }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', department:'' })
  const [loading, setLoading] = useState(false)
  const handleSubmit = async e => { e.preventDefault(); setLoading(true); try { const c=await partnerApi.createBeneficiary({...form,partner_id:partnerId,code:'',status:'pending'}); onAdd(c); onClose() } catch(err){console.error(err)} finally{setLoading(false)} }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-md overflow-y-auto" style={{boxShadow:'0 20px 60px rgba(43,191,179,0.15)'}}>
        <div className="flex items-center justify-between p-5 border-b" style={{borderColor:'#f4f5f7'}}><h2 className="text-lg font-bold" style={{color:'#1a2b4a'}}>Ajouter un salarié</h2><button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>×</button></div>
        <form onSubmit={handleSubmit} className="p-5">
          {BENEF_FIELDS.map(f=><div key={f.key} className="mb-4"><label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>{f.label}{f.required?' *':''}</label><input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} type={f.key==='email'?'email':'text'} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div>)}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-2xl text-white text-sm font-semibold mt-2" style={{backgroundColor:loading?'#8a93a2':'#2BBFB3'}}>{loading?'Création...':'Ajouter →'}</button>
        </form>
      </div>
    </div>
  )
}

// ─── Batch Send Confirmation Panel ────────────────
function BatchSendPanel({ count, maxSendable, onSend, onCancel }) {
  const [customMessage, setCustomMessage] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" style={{backgroundColor:'rgba(26,43,74,0.5)'}} onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-md overflow-y-auto" style={{boxShadow:'0 20px 60px rgba(43,191,179,0.15)'}}>
        <div className="flex items-center justify-between p-5 border-b" style={{borderColor:'#f4f5f7'}}>
          <h2 className="text-lg font-bold" style={{color:'#1a2b4a'}}>Confirmer l'envoi groupé</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>×</button>
        </div>
        <div className="p-5">
          <div className="rounded-xl p-4 mb-4" style={{backgroundColor:'#e8f8f7'}}>
            <p className="text-sm font-medium" style={{color:'#065f46'}}>
              {maxSendable} code{maxSendable > 1 ? 's' : ''} {maxSendable > 1 ? 'seront envoyés' : 'sera envoyé'} par email.
            </p>
            {count > maxSendable && (
              <p className="text-xs mt-1" style={{color:'#92400e'}}>
                {count - maxSendable} salarié{count - maxSendable > 1 ? 's' : ''} ne recevr{count - maxSendable > 1 ? 'ont' : 'a'} pas de code (pas assez de codes disponibles).
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>
              Message personnalisé <span className="font-normal" style={{color:'#8a93a2'}}>(optionnel)</span>
            </label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="Ajoutez un message qui sera inclus dans l'email envoyé à vos collaborateurs..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
              style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}}
            />
            <p className="text-xs mt-1" style={{color:'#8a93a2'}}>Ce message apparaîtra dans l'email, en plus du template standard.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => onSend(customMessage)}
              className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold"
              style={{backgroundColor:'#2BBFB3'}}>
              Envoyer {maxSendable} code{maxSendable > 1 ? 's' : ''} →
            </button>
            <button onClick={onCancel}
              className="px-5 py-3 rounded-2xl text-sm font-semibold"
              style={{backgroundColor:'#f4f5f7', color:'#8a93a2'}}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────
export default function PartnerCodes({ partnerId }) {
  const { codes, beneficiaries, partnerName, loading, setBeneficiaries } = usePartnerCodes(partnerId)

  const [tab, setTab] = useState('beneficiaries')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [sendingTo, setSendingTo] = useState(null)
  const [sendingCode, setSendingCode] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { toast, showToast, clearToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const debouncedSearch = useDebounce(search)

  // Batch mode
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBatchConfirm, setShowBatchConfirm] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null) // { current, total, log[] }

  const codeStats = useMemo(() => computeCodeStats({ codes, beneficiaries }), [codes, beneficiaries])
  const usageRate = codeStats.activationRate
  const assignedCodes = useMemo(() => new Set(beneficiaries.filter(b => b.code).map(b => b.code)), [beneficiaries])
  const availableCodes = useMemo(() => codes.filter(c => !c.used && !assignedCodes.has(c.code)), [codes, assignedCodes])
  const sentCount = useMemo(
    () => beneficiaries.filter(b => b.status === 'sent' || b.status === 'activated').length,
    [beneficiaries],
  )

  // Funnel statut enrichi déplacé dans utils/partnerMetrics.
  const enrichedBeneficiaries = useMemo(
    () => enrichBeneficiaries({ beneficiaries, codes }),
    [beneficiaries, codes],
  )

  const filteredBeneficiaries = useMemo(() => {
    let list = enrichedBeneficiaries
    if (statusFilter !== 'all') {
      list = list.filter(b => b.enrichedStatus === statusFilter)
    }
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      list = list.filter(b => `${b.first_name} ${b.last_name} ${b.email} ${b.department||''}`.toLowerCase().includes(s))
    }
    return list
  }, [enrichedBeneficiaries, debouncedSearch, statusFilter])

  const statusCounts = useMemo(() => countByEnrichedStatus(enrichedBeneficiaries), [enrichedBeneficiaries])

  // Eligible pour batch (pas encore envoyé)
  const eligibleForBatch = filteredBeneficiaries.filter(b => b.enrichedStatus === 'pending' && !b.code)

  // ─── Envoi unitaire ─────────────────────────────
  const handleSend = async benef => {
    if (!sendingCode) return
    const ok = await confirm('Confirmer l\'envoi', `Envoyer le code ${sendingCode} à ${benef.first_name} ${benef.last_name} (${benef.email}) ?`, { confirmLabel: 'Envoyer', confirmColor: '#2BBFB3' })
    if (!ok) return
    try {
      const sentAt = new Date().toISOString()
      await partnerApi.updateBeneficiary(benef.id, { code: sendingCode, status: 'sent', sent_at: sentAt })
      await partnerApi.sendCodeEmail({
        to_email: benef.email,
        to_name: benef.first_name,
        code: sendingCode,
        partner_name: partnerName || 'Votre entreprise',
        template_id: 9,
      })
      setBeneficiaries(prev => prev.map(b => b.id === benef.id ? { ...b, code: sendingCode, status: 'sent', sent_at: sentAt } : b))
      setSendingTo(null); setSendingCode('')
      showToast(`Code ${sendingCode} envoyé à ${benef.first_name}`)
    } catch (err) { console.error(err); showToast('Erreur lors de l\'envoi', 'error') }
  }

  // ─── Envoi batch ────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    if (selectedIds.length === eligibleForBatch.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(eligibleForBatch.map(b => b.id))
    }
  }

  const maxBatchSendable = Math.min(selectedIds.length, availableCodes.length)

  const handleBatchSend = async (customMessage) => {
    setShowBatchConfirm(false)
    const total = maxBatchSendable
    const log = []
    setBatchProgress({ current: 0, total, log })

    const toSend = selectedIds.slice(0, maxBatchSendable)

    for (let i = 0; i < toSend.length; i++) {
      const benef = beneficiaries.find(b => b.id === toSend[i])
      const code = availableCodes[i]

      if (!benef || !code) {
        log.push({ name: '?', status: 'error' })
        setBatchProgress({ current: i + 1, total, log: [...log] })
        continue
      }

      try {
        const sentAt = new Date().toISOString()
        await partnerApi.updateBeneficiary(benef.id, {
          code: code.code, status: 'sent', sent_at: sentAt,
        })
        const emailBody = {
          to_email: benef.email,
          to_name: `${benef.first_name} ${benef.last_name}`,
          code: code.code,
          partner_name: partnerName || 'Votre entreprise',
          template_id: 9,
        }
        if (customMessage) emailBody.custom_message = customMessage
        await partnerApi.sendCodeEmail(emailBody)

        setBeneficiaries(prev => prev.map(b => b.id === benef.id ? { ...b, code: code.code, status: 'sent', sent_at: sentAt } : b))
        log.push({ name: `${benef.first_name} ${benef.last_name}`, status: 'success' })
      } catch {
        log.push({ name: `${benef.first_name} ${benef.last_name}`, status: 'error' })
      }
      setBatchProgress({ current: i + 1, total, log: [...log] })
    }

    const success = log.filter(l => l.status === 'success').length
    showToast(`${success} code${success > 1 ? 's' : ''} envoyé${success > 1 ? 's' : ''} avec succès`)
    setBatchMode(false)
    setSelectedIds([])
    setTimeout(() => setBatchProgress(null), 3000)
  }

  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={4} /></div>

  return (
    <div>
      {ConfirmDialog}
      {showAddModal && <AddBeneficiaryModal onClose={()=>setShowAddModal(false)} onAdd={c=>{setBeneficiaries(p=>[...p,c]);showToast('Salarié ajouté')}} partnerId={partnerId} />}
      {showImportModal && <ImportModal onClose={()=>setShowImportModal(false)} onImport={i=>{setBeneficiaries(p=>[...p,...i]);showToast(`${i.length} salarié(s) importé(s)`)}} partnerId={partnerId} />}
      {showBatchConfirm && <BatchSendPanel count={selectedIds.length} maxSendable={maxBatchSendable} onSend={handleBatchSend} onCancel={()=>setShowBatchConfirm(false)} />}

      <Toast toast={toast} onClose={clearToast} />

      <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Mes codes</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>Envoyez des codes d'accès à vos collaborateurs</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Disponibles" value={availableCodes.length} color="#2BBFB3" />
        <MetricCard label="Envoyés" value={sentCount} color="#3b82f6" />
        <MetricCard label="Salariés" value={beneficiaries.length} color="#1a2b4a" />
        <MetricCard label="Activation" value={`${usageRate}%`} color={usageRate>80?'#ef4444':'#8a93a2'} />
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl p-4 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>Utilisation</p><span className="text-sm font-semibold" style={{color:usageRate>80?'#ef4444':'#2BBFB3'}}>{usageRate}%</span></div>
        <div className="w-full rounded-full h-2.5" style={{backgroundColor:'#f4f5f7'}}><div className="h-2.5 rounded-full" style={{width:`${usageRate}%`,backgroundColor:usageRate>80?'#ef4444':'#2BBFB3'}} /></div>
      </div>

      {/* Batch progress overlay */}
      {batchProgress && (
        <div className="bg-white rounded-2xl p-4 mb-4" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)', border:'1.5px solid #2BBFB3'}}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>Envoi en cours...</p>
            <p className="text-sm font-semibold" style={{color:'#2BBFB3'}}>{batchProgress.current}/{batchProgress.total}</p>
          </div>
          <div className="w-full rounded-full h-2.5 mb-2" style={{backgroundColor:'#f4f5f7'}}>
            <div className="h-2.5 rounded-full transition-all duration-300" style={{width:`${(batchProgress.current/batchProgress.total)*100}%`,backgroundColor:'#2BBFB3'}} />
          </div>
          <div className="flex flex-wrap gap-1">
            {batchProgress.log.map((l, i) => (
              <div key={i} className="w-2 h-2 rounded-full" style={{backgroundColor: l.status === 'success' ? '#2BBFB3' : '#ef4444'}} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex rounded-xl overflow-hidden" style={{backgroundColor:'#f4f5f7'}}>
          {[{k:'beneficiaries',l:`Salariés (${beneficiaries.length})`},{k:'codes',l:`Codes (${codes.length})`}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setBatchMode(false);setSelectedIds([])}} className="px-4 py-2.5 text-sm font-medium" style={{backgroundColor:tab===t.k?'#2BBFB3':'transparent',color:tab===t.k?'white':'#8a93a2',borderRadius:tab===t.k?'10px':'0'}}>{t.l}</button>
          ))}
        </div>
        {tab==='beneficiaries'&&<div className="flex gap-2">
          <button onClick={()=>exportToCSV(beneficiaries,'salaries',[{key:'first_name',label:'Prénom'},{key:'last_name',label:'Nom'},{key:'email',label:'Email'},{key:'department',label:'Service'},{key:'code',label:'Code'},{key:'status',label:'Statut'}])} className="px-3 py-2.5 rounded-xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📥</button>
          <button onClick={()=>setShowImportModal(true)} className="px-3 py-2.5 rounded-xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📄 CSV</button>
          <button onClick={()=>{setBatchMode(!batchMode);setSelectedIds([])}}
            className="px-3 py-2.5 rounded-xl text-sm font-semibold"
            style={{backgroundColor:batchMode?'#e8f8f7':'#f4f5f7',color:batchMode?'#2BBFB3':'#1a2b4a', border: batchMode ? '1.5px solid #2BBFB3' : '1.5px solid transparent'}}>
            {batchMode ? '✕ Annuler' : '📨 Envoi groupé'}
          </button>
          <button onClick={()=>setShowAddModal(true)} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>+ Ajouter</button>
        </div>}
      </div>

      {tab==='beneficiaries'&&<div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher un salarié..." /></div>}

      {tab==='beneficiaries' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'all', label: 'Tous', color: '#1a2b4a', bg: '#f4f5f7' },
            { key: 'pending', label: 'À envoyer', color: STATUS_CONFIG.pending.color, bg: STATUS_CONFIG.pending.bg },
            { key: 'sent', label: 'Envoyés', color: STATUS_CONFIG.sent.color, bg: STATUS_CONFIG.sent.bg },
            { key: 'opened', label: 'Ouverts', color: STATUS_CONFIG.opened.color, bg: STATUS_CONFIG.opened.bg },
            { key: 'activated', label: 'Activés', color: STATUS_CONFIG.activated.color, bg: STATUS_CONFIG.activated.bg },
          ].map(f => {
            const active = statusFilter === f.key
            return (
              <button key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active ? f.color : f.bg,
                  color: active ? 'white' : f.color,
                  border: active ? `1.5px solid ${f.color}` : '1.5px solid transparent',
                }}>
                {f.label} ({statusCounts[f.key] || 0})
              </button>
            )
          })}
        </div>
      )}

      {/* Batch mode header */}
      {batchMode && tab === 'beneficiaries' && (
        <div className="flex items-center justify-between rounded-xl p-3 mb-3"
          style={{backgroundColor:'#e8f8f7', border:'1px solid #a7f3d0'}}>
          <div className="flex items-center gap-3">
            <button onClick={toggleAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{backgroundColor:'white', color:'#1a2b4a'}}>
              {selectedIds.length === eligibleForBatch.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <p className="text-sm font-medium" style={{color:'#065f46'}}>
              {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''} · {availableCodes.length} codes dispo
            </p>
          </div>
          <button onClick={()=>setShowBatchConfirm(true)}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{backgroundColor: selectedIds.length > 0 ? '#2BBFB3' : '#d1d5db'}}>
            Envoyer {maxBatchSendable} →
          </button>
        </div>
      )}

      {/* ─── TAB: Salariés ─── */}
      {tab==='beneficiaries'&&(
        filteredBeneficiaries.length===0 ? <EmptyState icon="👥" title={search?'Aucun résultat':'Aucun salarié'} message={search?'Essayez avec d\'autres mots-clés':'Ajoutez des salariés pour leur envoyer des codes'} actionLabel={!search&&'+ Ajouter un salarié'} onAction={!search?()=>setShowAddModal(true):undefined} /> : (
          <div className="flex flex-col gap-2">{filteredBeneficiaries.map(b=>{
            const isSending=sendingTo===b.id
            const status = STATUS_CONFIG[b.enrichedStatus] || STATUS_CONFIG.pending
            const hasSent = b.enrichedStatus === 'sent' || b.enrichedStatus === 'opened' || b.enrichedStatus === 'activated'
            const isEligible = b.enrichedStatus === 'pending' && !b.code
            const isSelected = selectedIds.includes(b.id)

            return (
              <div key={b.id} className="bg-white rounded-2xl px-4 py-4" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)',border:isSending?'1.5px solid #2BBFB3': isSelected?'1.5px solid #2BBFB3':'1.5px solid transparent',opacity:hasSent?0.85:1}}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox batch */}
                    {batchMode && isEligible && (
                      <button onClick={() => toggleSelect(b.id)}
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{backgroundColor:isSelected?'#2BBFB3':'white',border:isSelected?'none':'1.5px solid #d1d5db'}}>
                        {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    )}
                    {batchMode && !isEligible && <div className="w-5 h-5 flex-shrink-0" />}

                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{backgroundColor:hasSent?'#8a93a2':'#2BBFB3'}}>{b.first_name?.[0]}{b.last_name?.[0]}</div>
                    <div className="min-w-0"><p className="font-semibold text-sm truncate" style={{color:'#1a2b4a'}}>{b.first_name} {b.last_name}</p><p className="text-xs truncate" style={{color:'#8a93a2'}}>{b.email}{b.department&&` · ${b.department}`}</p></div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge label={status.label} bg={status.bg} color={status.color} />
                    {!hasSent && !batchMode && (
                      <button onClick={()=>{setSendingTo(isSending?null:b.id);setSendingCode('')}} className="px-3 py-1.5 rounded-xl text-white text-xs font-medium" style={{backgroundColor:'#2BBFB3'}}>Envoyer</button>
                    )}
                  </div>
                </div>

                {/* Code info for sent items */}
                {hasSent&&b.code&&(
                  <div className="flex items-center gap-2 mt-2 pt-2" style={{borderTop:'1px solid #f4f5f7'}}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: status.color}} />
                    <p className="text-xs flex-1" style={{color:'#8a93a2'}}>
                      Code <span style={{fontFamily:'monospace',color:'#8a93a2'}}>{maskCode(b.code)}</span>
                      {b.sent_at&&` · envoyé le ${new Date(b.sent_at).toLocaleDateString('fr-FR')}`}
                    </p>
                    <CopyButton text={b.code} />
                  </div>
                )}

                {/* Envoi unitaire panel */}
                {isSending&&!hasSent&&(
                  <div className="mt-3 pt-3" style={{borderTop:'1px solid #f4f5f7'}}>
                    <p className="text-xs font-semibold mb-2" style={{color:'#1a2b4a'}}>Code pour {b.first_name}</p>
                    {availableCodes.length===0?<p className="text-xs" style={{color:'#ef4444'}}>Aucun code disponible</p>:(
                      <>
                        <select value={sendingCode} onChange={e=>setSendingCode(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3" style={{backgroundColor:'#f4f5f7',fontFamily:sendingCode?'monospace':'inherit'}}><option value="">Sélectionner un code...</option>{availableCodes.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}</select>

                        <p className="text-xs mb-3" style={{color:'#8a93a2'}}>Le message personnalisé est disponible via l'envoi groupé.</p>

                        <div className="flex gap-2">
                          <button onClick={()=>handleSend(b)} disabled={!sendingCode} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{backgroundColor:sendingCode?'#2BBFB3':'#d1d5db'}}>Confirmer →</button>
                          <button onClick={()=>setSendingTo(null)} className="px-4 py-2 rounded-xl text-sm" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}</div>
        )
      )}

      {/* ─── TAB: Codes ─── */}
      {tab==='codes'&&(
        codes.length===0 ? <EmptyState icon="🔑" title="Aucun code" message="Les codes assignés à votre espace apparaîtront ici" /> : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
            <div className="grid grid-cols-4 px-4 py-3 text-xs font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}><span>CODE</span><span>STATUT</span><span>ATTRIBUÉ À</span><span></span></div>
            {codes.map((c,i)=>{
              const assignedTo=beneficiaries.find(b=>b.code===c.code)
              return (
                <div key={c.id} className="grid grid-cols-4 px-4 py-3 items-center" style={{borderTop:i>0?'0.5px solid #f4f5f7':'none'}}>
                  <span style={{fontFamily:'monospace',fontSize:'13px',color:'#8a93a2',textDecoration:c.used?'line-through':'none'}}>{maskCode(c.code)}</span>
                  <StatusBadge label={c.used?'Activé':(assignedTo?'Envoyé':'Disponible')} bg={c.used?'#e8f0fe':(assignedTo?'#dbeafe':'#e8f8f7')} color={c.used?'#1a2b4a':(assignedTo?'#3b82f6':'#2BBFB3')} />
                  <span className="text-xs truncate" style={{color:'#8a93a2'}}>{assignedTo?`${assignedTo.first_name} ${assignedTo.last_name}`:'—'}</span>
                  <CopyButton text={c.code} />
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}