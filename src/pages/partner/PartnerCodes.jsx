import { useState, useEffect, useRef, useMemo } from 'react'
import client from '../../lib/directus'
import { readItems } from '@directus/sdk'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

// ─── CSV Parser ────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = line => {
    const result = []
    let current = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim()); current = ''
      } else current += ch
    }
    result.push(current.trim())
    return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
  return { headers, rows }
}

function autoMap(csvHeaders) {
  const mapping = {}
  const aliases = {
    first_name: ['prénom', 'prenom', 'firstname', 'first_name', 'prénom salarié'],
    last_name: ['nom', 'lastname', 'last_name', 'nom de famille', 'nom salarié'],
    email: ['email', 'mail', 'e-mail', 'courriel', 'adresse email'],
    department: ['service', 'département', 'department', 'dept', 'equipe', 'équipe'],
  }
  csvHeaders.forEach(header => {
    const h = header.toLowerCase().trim()
    for (const [field, words] of Object.entries(aliases)) {
      if (words.includes(h) || words.some(w => h.includes(w))) {
        if (!Object.values(mapping).includes(field)) { mapping[header] = field; break }
      }
    }
  })
  return mapping
}

const BENEF_FIELDS = [
  { key: 'first_name', label: 'Prénom', required: true },
  { key: 'last_name', label: 'Nom', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'department', label: 'Service' },
]

// ─── Import CSV Modal ──────────────────────────────
function ImportModal({ onClose, onImport, partnerId }) {
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = file => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parseCSV(e.target.result)
      setCsvData(parsed)
      setMapping(autoMap(parsed.headers))
      setStep(2)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }
  const mappedFields = Object.values(mapping).filter(Boolean)
  const hasRequired = mappedFields.includes('first_name') && mappedFields.includes('last_name') && mappedFields.includes('email')

  const handleImport = async () => {
    setStep(3)
    const total = csvData.rows.length
    setProgress({ current: 0, total, errors: [] })
    const imported = [], errors = []

    for (let i = 0; i < total; i++) {
      const row = csvData.rows[i]
      const benef = { partner_id: partnerId }
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field && row[csvCol]) benef[field] = row[csvCol]
      }
      if (!benef.first_name || !benef.email) {
        errors.push({ row: i + 2, reason: 'Prénom ou email manquant' })
        setProgress(prev => ({ ...prev, current: i + 1, errors }))
        continue
      }
      try {
        const resp = await fetch(`${XANO_BASE}/beneficiaries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(benef),
        })
        if (!resp.ok) throw new Error('Erreur Xano')
        imported.push(await resp.json())
      } catch (err) {
        errors.push({ row: i + 2, reason: err.message })
      }
      setProgress({ current: i + 1, total, errors })
    }
    setStep(4)
    onImport(imported)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-xl md:max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>

        <div className="flex items-center justify-between p-5 md:p-6 border-b sticky top-0 bg-white z-10" style={{ borderColor: '#f4f5f7' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1a2b4a' }}>
              {step === 1 && 'Importer des salariés'}{step === 2 && 'Mapper les colonnes'}{step === 3 && 'Import en cours...'}{step === 4 && 'Import terminé'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>
              {step === 1 && 'Fichier CSV avec prénom, nom, email'}{step === 2 && `${csvData.rows.length} lignes détectées`}{step === 3 && `${progress.current} / ${progress.total}`}{step === 4 && `${progress.total - progress.errors.length} importé(s)`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
        </div>

        <div className="p-5 md:p-6">
          {step === 1 && (
            <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current?.click()}
              className="rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all"
              style={{ backgroundColor: dragOver ? '#e8f8f7' : '#f4f5f7', border: `2px dashed ${dragOver ? '#2BBFB3' : '#d1d5db'}` }}>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              <span className="text-4xl block mb-4">👥</span>
              <p className="font-semibold" style={{ color: '#1a2b4a' }}>Glissez votre fichier CSV ici</p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Colonnes attendues : prénom, nom, email, service</p>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-2 mb-6">
                {csvData.headers.map(header => (
                  <div key={header} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>{header}</p>
                      <p className="text-xs truncate" style={{ color: '#8a93a2' }}>ex: {csvData.rows[0]?.[header] || '—'}</p>
                    </div>
                    <span className="text-xs" style={{ color: '#8a93a2' }}>→</span>
                    <select value={mapping[header] || ''} onChange={e => setMapping({ ...mapping, [header]: e.target.value })}
                      className="px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{ color: mapping[header] ? '#1a2b4a' : '#8a93a2', minWidth: '140px' }}>
                      <option value="">— Ignorer —</option>
                      {BENEF_FIELDS.map(f => (
                        <option key={f.key} value={f.key} disabled={Object.values(mapping).includes(f.key) && mapping[header] !== f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!hasRequired && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>Mappez au moins : prénom, nom et email</div>}
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleImport} disabled={!hasRequired} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: hasRequired ? '#2BBFB3' : '#d1d5db' }}>
                  Importer {csvData.rows.length} salarié{csvData.rows.length > 1 ? 's' : ''} →
                </button>
                <button onClick={() => setStep(1)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>← Changer de fichier</button>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-full rounded-full h-3 mb-4" style={{ backgroundColor: '#f4f5f7' }}>
                <div className="h-3 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%`, backgroundColor: '#2BBFB3' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{progress.current} / {progress.total}</p>
              <p className="text-sm" style={{ color: '#8a93a2' }}>Création des fiches salariés...</p>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <span className="text-4xl block mb-4">{progress.errors.length === 0 ? '✅' : '⚠️'}</span>
              <p className="text-lg font-bold mb-1" style={{ color: '#1a2b4a' }}>{progress.total - progress.errors.length} salarié(s) importé(s)</p>
              {progress.errors.length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-sm font-semibold mb-2" style={{ color: '#ef4444' }}>{progress.errors.length} erreur(s) :</p>
                  <div className="rounded-xl p-3 max-h-32 overflow-y-auto" style={{ backgroundColor: '#fee2e2' }}>
                    {progress.errors.map((err, i) => <p key={i} className="text-xs mb-1" style={{ color: '#ef4444' }}>Ligne {err.row} : {err.reason}</p>)}
                  </div>
                </div>
              )}
              <button onClick={onClose} className="mt-6 px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: '#2BBFB3' }}>Fermer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Beneficiary Modal ─────────────────────────
function AddBeneficiaryModal({ onClose, onAdd, partnerId }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', department: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.first_name || !form.email) { setError('Prénom et email requis'); return }
    setLoading(true)
    try {
      const resp = await fetch(`${XANO_BASE}/beneficiaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, partner_id: partnerId, code: '', status: 'pending' }),
      })
      if (!resp.ok) throw new Error('Erreur')
      const created = await resp.json()
      onAdd(created)
      onClose()
    } catch (err) {
      setError('Erreur lors de la création')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:max-w-md overflow-y-auto"
        style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>
        <div className="flex items-center justify-between p-5 md:p-6 border-b" style={{ borderColor: '#f4f5f7' }}>
          <h2 className="text-lg font-bold" style={{ color: '#1a2b4a' }}>Ajouter un salarié</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 md:p-6">
          {error && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{error}</div>}
          {BENEF_FIELDS.map(f => (
            <div key={f.key} className="mb-4">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1a2b4a' }}>{f.label}{f.required ? ' *' : ''}</label>
              <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.label} type={f.key === 'email' ? 'email' : 'text'}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button type="submit" disabled={loading} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: loading ? '#8a93a2' : '#2BBFB3' }}>
              {loading ? 'Création...' : 'Ajouter →'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Composant principal PartnerCodes ──────────────
export default function PartnerCodes({ user }) {
  const [codes, setCodes] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('beneficiaries') // beneficiaries, codes
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [sendingTo, setSendingTo] = useState(null) // beneficiary id being sent to
  const [sendingCode, setSendingCode] = useState('') // code selected to send
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [codesData, benefResp] = await Promise.all([
          client.request(readItems('access_codes', { filter: { partner_id: { _eq: user.id } } })),
          fetch(`${XANO_BASE}/beneficiaries?partner_id=${user.id}`).then(r => r.json()),
        ])
        setCodes(codesData)
        setBeneficiaries(Array.isArray(benefResp) ? benefResp : [])
      } catch (err) {
        console.error('Erreur chargement:', err)
      } finally { setLoading(false) }
    }
    fetchData()
  }, [user.id])

  // Stats
  const totalCodes = codes.length
  const usedCodes = codes.filter(c => (c.current_uses || 0) > 0).length
  const unusedCodes = totalCodes - usedCodes
  const sentCount = beneficiaries.filter(b => b.status === 'sent' || b.status === 'activated').length
  const usageRate = totalCodes > 0 ? Math.round((usedCodes / totalCodes) * 100) : 0

  // Codes disponibles (non utilisés et non assignés à un bénéficiaire)
  const assignedCodes = new Set(beneficiaries.filter(b => b.code).map(b => b.code))
  const availableCodes = codes.filter(c => (c.current_uses || 0) === 0 && !assignedCodes.has(c.code))

  // Filtrer bénéficiaires
  const filteredBeneficiaries = useMemo(() => {
    if (!search) return beneficiaries
    const s = search.toLowerCase()
    return beneficiaries.filter(b =>
      `${b.first_name} ${b.last_name} ${b.email} ${b.department || ''}`.toLowerCase().includes(s)
    )
  }, [beneficiaries, search])

  // Envoyer un code
  const handleSend = async (beneficiary) => {
    if (!sendingCode) return

    try {
      // 1. PATCH le bénéficiaire dans Xano
      await fetch(`${XANO_BASE}/beneficiaries/${beneficiary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: sendingCode,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }),
      })

      // 2. TODO: Appel Xano proxy → Brevo pour envoyer l'email
      // await fetch(`${XANO_BASE}/send-code-email`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     to_email: beneficiary.email,
      //     to_name: beneficiary.first_name,
      //     code: sendingCode,
      //     partner_name: user.partner_name || 'Votre entreprise',
      //     template_id: 1, // ID du template Brevo
      //   }),
      // })

      // 3. Mettre à jour le state local
      setBeneficiaries(prev => prev.map(b =>
        b.id === beneficiary.id ? { ...b, code: sendingCode, status: 'sent', sent_at: new Date().toISOString() } : b
      ))

      setSendingTo(null)
      setSendingCode('')
      setToast({ name: `${beneficiary.first_name} ${beneficiary.last_name}`, code: sendingCode })
      setTimeout(() => setToast(null), 5000)
    } catch (err) {
      console.error('Erreur envoi:', err)
    }
  }

  const handleAddBenef = created => {
    setBeneficiaries(prev => [...prev, created])
  }

  const handleImport = imported => {
    setBeneficiaries(prev => [...prev, ...imported])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: '#8a93a2' }}>Chargement...</p>
    </div>
  )

  return (
    <div>
      {showAddModal && <AddBeneficiaryModal onClose={() => setShowAddModal(false)} onAdd={handleAddBenef} partnerId={user.id} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onImport={handleImport} partnerId={user.id} />}

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Mes codes</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Envoyez des codes d'accès à vos collaborateurs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Disponibles', value: availableCodes.length, color: '#2BBFB3' },
          { label: 'Envoyés', value: sentCount, color: '#1a2b4a' },
          { label: 'Salariés', value: beneficiaries.length, color: '#d97706' },
          { label: 'Taux utilisation', value: `${usageRate}%`, color: usageRate > 80 ? '#ef4444' : '#8a93a2' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5"
            style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl md:text-2xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Barre de progression */}
      <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 mb-6"
        style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>Utilisation des codes</p>
          <span className="text-sm font-semibold" style={{ color: usageRate > 80 ? '#ef4444' : '#2BBFB3' }}>{usageRate}%</span>
        </div>
        <div className="w-full rounded-full h-2.5" style={{ backgroundColor: '#f4f5f7' }}>
          <div className="h-2.5 rounded-full transition-all" style={{ width: `${usageRate}%`, backgroundColor: usageRate > 80 ? '#ef4444' : '#2BBFB3' }} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded-2xl p-3 md:p-4 mb-4 flex items-center gap-3"
          style={{ backgroundColor: '#e8f8f7', border: '1px solid #2BBFB3' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#2BBFB3' }}>✓</div>
          <p className="text-sm" style={{ color: '#1a2b4a' }}>
            Code <strong style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{toast.code}</strong> envoyé à <strong>{toast.name}</strong>
          </p>
          <button onClick={() => setToast(null)} className="ml-auto text-sm" style={{ color: '#8a93a2' }}>×</button>
        </div>
      )}

      {/* Tabs + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex rounded-xl overflow-hidden" style={{ backgroundColor: '#f4f5f7' }}>
          {[
            { key: 'beneficiaries', label: `Salariés (${beneficiaries.length})` },
            { key: 'codes', label: `Codes (${totalCodes})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: tab === t.key ? '#2BBFB3' : 'transparent',
                color: tab === t.key ? 'white' : '#8a93a2',
                borderRadius: tab === t.key ? '10px' : '0',
              }}>{t.label}</button>
          ))}
        </div>
        {tab === 'beneficiaries' && (
          <div className="flex gap-2">
            <button onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-1 sm:flex-initial"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>📄 Importer CSV</button>
            <button onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex-1 sm:flex-initial"
              style={{ backgroundColor: '#2BBFB3' }}>+ Ajouter</button>
          </div>
        )}
      </div>

      {/* Recherche */}
      {tab === 'beneficiaries' && (
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un salarié..."
          className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
      )}

      {/* ─── TAB: Salariés ─── */}
      {tab === 'beneficiaries' && (
        <>
          {filteredBeneficiaries.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 md:p-12 text-center"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <span className="text-4xl block mb-3">👥</span>
              <p className="font-bold text-lg" style={{ color: '#1a2b4a' }}>
                {search ? 'Aucun résultat' : 'Aucun salarié enregistré'}
              </p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
                {search ? 'Essayez un autre terme' : 'Ajoutez des salariés manuellement ou importez un CSV'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredBeneficiaries.map(benef => {
                const isSending = sendingTo === benef.id
                const hasSent = benef.status === 'sent' || benef.status === 'activated'
                return (
                  <div key={benef.id}
                    className="bg-white rounded-2xl px-4 md:px-5 py-4 transition-all"
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isSending ? '1.5px solid #2BBFB3' : '1.5px solid transparent',
                      opacity: hasSent ? 0.75 : 1,
                    }}>
                    {/* Ligne principale */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: hasSent ? '#8a93a2' : '#2BBFB3' }}>
                          {benef.first_name?.[0]}{benef.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: '#1a2b4a' }}>
                            {benef.first_name} {benef.last_name}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#8a93a2' }}>
                            {benef.email}
                            {benef.department && <span> · {benef.department}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasSent ? (
                          <span className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                            Envoyé
                          </span>
                        ) : (
                          <button onClick={() => { setSendingTo(isSending ? null : benef.id); setSendingCode('') }}
                            className="px-3 py-1.5 rounded-xl text-white text-xs font-medium"
                            style={{ backgroundColor: '#2BBFB3' }}>
                            Envoyer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ligne code envoyé */}
                    {hasSent && benef.code && (
                      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid #f4f5f7' }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#2BBFB3' }} />
                        <p className="text-xs" style={{ color: '#8a93a2' }}>
                          Code <span style={{ fontFamily: 'monospace', color: '#1a2b4a', letterSpacing: '1px' }}>{benef.code}</span>
                          {benef.sent_at && <span> · {new Date(benef.sent_at).toLocaleDateString('fr-FR')}</span>}
                        </p>
                      </div>
                    )}

                    {/* Formulaire d'envoi inline (Design B) */}
                    {isSending && !hasSent && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f4f5f7' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                          Choisir un code à envoyer à {benef.first_name}
                        </p>
                        {availableCodes.length === 0 ? (
                          <p className="text-xs py-2" style={{ color: '#ef4444' }}>
                            Aucun code disponible — demandez-en de nouveaux
                          </p>
                        ) : (
                          <>
                            <select value={sendingCode} onChange={e => setSendingCode(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3"
                              style={{ backgroundColor: '#f4f5f7', color: sendingCode ? '#1a2b4a' : '#8a93a2', fontFamily: sendingCode ? 'monospace' : 'inherit', letterSpacing: sendingCode ? '2px' : '0' }}>
                              <option value="">Sélectionner un code...</option>
                              {availableCodes.map(c => (
                                <option key={c.id} value={c.code}>{c.code}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => handleSend(benef)} disabled={!sendingCode}
                                className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all"
                                style={{ backgroundColor: sendingCode ? '#2BBFB3' : '#d1d5db' }}>
                                Confirmer l'envoi →
                              </button>
                              <button onClick={() => { setSendingTo(null); setSendingCode('') }}
                                className="px-4 py-2 rounded-xl text-sm font-medium"
                                style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                                Annuler
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ─── TAB: Codes ─── */}
      {tab === 'codes' && (
        <>
          {codes.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <span className="text-4xl block mb-3">🔑</span>
              <p className="font-semibold" style={{ color: '#1a2b4a' }}>Aucun code disponible</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl md:rounded-3xl overflow-hidden"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="grid grid-cols-3 px-4 md:px-5 py-3 text-xs font-semibold"
                style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                <span>CODE</span>
                <span>STATUT</span>
                <span>ATTRIBUÉ À</span>
              </div>
              {codes.map((code, index) => {
                const isUsed = (code.current_uses || 0) > 0
                const assignedTo = beneficiaries.find(b => b.code === code.code)
                return (
                  <div key={code.id}
                    className="grid grid-cols-3 px-4 md:px-5 py-3 md:py-4 items-center"
                    style={{ borderTop: index > 0 ? '0.5px solid #f4f5f7' : 'none' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '14px', fontWeight: '600',
                      color: isUsed ? '#8a93a2' : '#2BBFB3', letterSpacing: '2px',
                      textDecoration: isUsed ? 'line-through' : 'none',
                    }}>{code.code}</span>
                    <span className="text-xs px-2 py-1 rounded-lg font-medium w-fit"
                      style={{
                        backgroundColor: isUsed ? '#fee2e2' : (assignedTo ? '#e8f0fe' : '#e8f8f7'),
                        color: isUsed ? '#ef4444' : (assignedTo ? '#1a2b4a' : '#2BBFB3'),
                      }}>
                      {isUsed ? 'Utilisé' : (assignedTo ? 'Envoyé' : 'Disponible')}
                    </span>
                    <span className="text-xs truncate" style={{ color: '#8a93a2' }}>
                      {assignedTo ? `${assignedTo.first_name} ${assignedTo.last_name}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}