import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { Toast, useToast, ConfirmModal, useConfirm, SearchInput, useDebounce, EmptyState, exportToCSV } from '../../components/SharedUI'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

// ─── Stepper ──────────────────────────────────────
function Stepper({ current }) {
  const steps = [
    { n: 1, label: 'Partenaire' },
    { n: 2, label: 'Sélection' },
    { n: 3, label: 'Envoi' },
    { n: 4, label: 'Rapport' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, idx) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: current >= s.n ? '#2BBFB3' : '#f4f5f7',
                color: current >= s.n ? 'white' : '#8a93a2',
              }}>
              {current > s.n ? '✓' : s.n}
            </div>
            <span className="text-xs font-medium hidden sm:inline"
              style={{ color: current >= s.n ? '#1a2b4a' : '#8a93a2' }}>
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className="w-6 sm:w-10 h-px" style={{ backgroundColor: current > s.n ? '#2BBFB3' : '#e8eaed' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────
export default function BulkCodeSend() {
  const [step, setStep] = useState(1)
  const [partners, setPartners] = useState([])
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [beneficiaries, setBeneficiaries] = useState([])
  const [codes, setCodes] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [progress, setProgress] = useState({ current: 0, total: 0, log: [] })
  const [report, setReport] = useState({ sent: 0, failed: 0, details: [] })
  const { toast, showToast, clearToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()

  const debouncedSearch = useDebounce(search)

  // Fetch partners
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const data = await xano.getAll('partners')
        setPartners(data.filter(p => p.crm_status === 'client actif'))
      } catch (err) { console.error(err) }
      finally { setLoadingData(false) }
    }
    fetchPartners()
  }, [])

  // Fetch beneficiaries + codes quand partenaire sélectionné
  useEffect(() => {
    if (!selectedPartnerId) return
    const fetchPartnerData = async () => {
      setLoadingData(true)
      try {
        const [benefs, codesData] = await Promise.all([
          xano.getAll('beneficiaries', { partner_id: selectedPartnerId }),
          xano.getAll('plan-activation-code', { partnerId: selectedPartnerId }),
        ])
        setBeneficiaries(benefs)
        setCodes(codesData)
      } catch (err) { console.error(err) }
      finally { setLoadingData(false) }
    }
    fetchPartnerData()
  }, [selectedPartnerId])

  // Salariés éligibles (sans code envoyé)
  const eligibleBeneficiaries = useMemo(() =>
    beneficiaries.filter(b => b.status !== 'sent' && b.status !== 'activated' && !b.code),
    [beneficiaries]
  )

  // Codes disponibles
  const availableCodes = useMemo(() => {
    const sentCodes = new Set(beneficiaries.filter(b => b.code).map(b => b.code))
    return codes.filter(c => !c.used && !sentCodes.has(c.code))
  }, [codes, beneficiaries])

  // Filtrage recherche
  const filteredEligible = useMemo(() => {
    if (!debouncedSearch) return eligibleBeneficiaries
    const q = debouncedSearch.toLowerCase()
    return eligibleBeneficiaries.filter(b =>
      [b.first_name, b.last_name, b.email, b.department]
        .filter(Boolean).some(f => f.toLowerCase().includes(q))
    )
  }, [eligibleBeneficiaries, debouncedSearch])

  const selectedPartner = partners.find(p => String(p.id) === String(selectedPartnerId))
  const maxSendable = Math.min(selectedIds.length, availableCodes.length)

  // Toggle sélection
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === filteredEligible.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEligible.map(b => b.id))
    }
  }

  // Lancer l'envoi
  const handleSend = async () => {
    const ok = await confirm(
      'Confirmer l\'envoi en masse',
      `Envoyer ${maxSendable} codes à ${maxSendable} salariés de ${selectedPartner?.name} ? Les emails seront envoyés immédiatement via Brevo.`,
      { confirmLabel: `Envoyer ${maxSendable} codes`, confirmColor: '#2BBFB3' }
    )
    if (!ok) return

    setStep(3)
    const total = maxSendable
    const log = []
    const details = []
    let sent = 0
    let failed = 0

    // Prendre les bénéficiaires sélectionnés (limité aux codes dispo)
    const toSend = selectedIds.slice(0, maxSendable)

    for (let i = 0; i < toSend.length; i++) {
      const benefId = toSend[i]
      const benef = beneficiaries.find(b => b.id === benefId)
      const code = availableCodes[i]

      if (!benef || !code) {
        failed++
        const entry = { name: benef?.first_name || '?', email: benef?.email || '?', status: 'error', message: 'Code ou salarié manquant' }
        log.push(entry)
        details.push(entry)
        setProgress({ current: i + 1, total, log: [...log] })
        continue
      }

      try {
        // 1. PATCH beneficiary avec le code
        await xano.update('beneficiaries', benef.id, {
          code: code.code,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

        // 2. POST envoi email
        await fetch(`${XANO_BASE}/send-code-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: benef.email,
            to_name: `${benef.first_name} ${benef.last_name}`,
            code: code.code,
            partner_name: selectedPartner?.name || '',
            template_id: 9,
          }),
        })

        sent++
        const entry = { name: `${benef.first_name} ${benef.last_name}`, email: benef.email, code: code.code, status: 'success', message: 'Envoyé' }
        log.push(entry)
        details.push(entry)
      } catch (err) {
        failed++
        const entry = { name: `${benef.first_name} ${benef.last_name}`, email: benef.email, status: 'error', message: err.message || 'Erreur inconnue' }
        log.push(entry)
        details.push(entry)
      }

      setProgress({ current: i + 1, total, log: [...log] })
    }

    setReport({ sent, failed, details })
    setStep(4)
  }

  // Reset pour nouvel envoi
  const handleReset = () => {
    setStep(1)
    setSelectedPartnerId('')
    setSelectedIds([])
    setBeneficiaries([])
    setCodes([])
    setSearch('')
    setProgress({ current: 0, total: 0, log: [] })
    setReport({ sent: 0, failed: 0, details: [] })
  }

  // Export rapport
  const handleExportReport = () => {
    exportToCSV(report.details, `rapport-envoi-${selectedPartner?.name || 'batch'}`, [
      { key: 'name', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'code', label: 'Code' },
      { key: 'status', label: 'Statut' },
      { key: 'message', label: 'Détail' },
    ])
  }

  return (
    <div>
      {ConfirmDialog}
      <Toast toast={toast} onClose={clearToast} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Envoi de codes en masse</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Envoyez des codes à plusieurs salariés en un clic</p>
      </div>

      <Stepper current={step} />

      {/* ─── Étape 1 : Choisir le partenaire ────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="font-bold text-base mb-4" style={{ color: '#1a2b4a' }}>Choisir le partenaire</h2>

          <select
            value={selectedPartnerId}
            onChange={e => setSelectedPartnerId(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
            <option value="">Sélectionner un partenaire...</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedPartnerId && !loadingData && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
                <p className="text-lg font-bold" style={{ color: eligibleBeneficiaries.length > 0 ? '#2BBFB3' : '#8a93a2' }}>
                  {eligibleBeneficiaries.length}
                </p>
                <p className="text-xs" style={{ color: '#8a93a2' }}>Salariés sans code</p>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
                <p className="text-lg font-bold" style={{ color: availableCodes.length > 0 ? '#2BBFB3' : '#ef4444' }}>
                  {availableCodes.length}
                </p>
                <p className="text-xs" style={{ color: '#8a93a2' }}>Codes disponibles</p>
              </div>
            </div>
          )}

          {selectedPartnerId && !loadingData && eligibleBeneficiaries.length === 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
              <p className="text-sm" style={{ color: '#92400e' }}>
                Aucun salarié éligible. Tous les salariés ont déjà un code assigné.
              </p>
            </div>
          )}

          {selectedPartnerId && !loadingData && availableCodes.length === 0 && eligibleBeneficiaries.length > 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>
                Aucun code disponible pour ce partenaire. Générez des codes d'abord.
              </p>
            </div>
          )}

          <button
            onClick={() => { setStep(2); setSelectedIds([]) }}
            disabled={!selectedPartnerId || loadingData || eligibleBeneficiaries.length === 0 || availableCodes.length === 0}
            className="w-full py-3 rounded-2xl text-white text-sm font-semibold"
            style={{
              backgroundColor: (!selectedPartnerId || eligibleBeneficiaries.length === 0 || availableCodes.length === 0) ? '#d1d5db' : '#2BBFB3',
            }}>
            Suivant →
          </button>
        </div>
      )}

      {/* ─── Étape 2 : Sélectionner les salariés ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base" style={{ color: '#1a2b4a' }}>
              Sélectionner les salariés — {selectedPartner?.name}
            </h2>
            <button onClick={() => setStep(1)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
              ← Retour
            </button>
          </div>

          {/* Compteur */}
          <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
            style={{
              backgroundColor: selectedIds.length > availableCodes.length ? '#fee2e2' : '#e8f8f7',
              border: `1px solid ${selectedIds.length > availableCodes.length ? '#fecaca' : '#a7f3d0'}`,
            }}>
            <p className="text-sm font-medium"
              style={{ color: selectedIds.length > availableCodes.length ? '#991b1b' : '#065f46' }}>
              {selectedIds.length} salarié{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''} / {availableCodes.length} codes disponibles
            </p>
            {selectedIds.length > availableCodes.length && (
              <p className="text-xs font-medium" style={{ color: '#991b1b' }}>
                Seuls {availableCodes.length} seront envoyés
              </p>
            )}
          </div>

          {/* Recherche + tout sélectionner */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Filtrer les salariés..." />
            </div>
            <button onClick={toggleAll}
              className="px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              {selectedIds.length === filteredEligible.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          {/* Liste avec checkboxes */}
          <div className="flex flex-col gap-1.5 mb-4" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {filteredEligible.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>Aucun salarié éligible trouvé</p>
            ) : (
              filteredEligible.map((b, idx) => {
                const isSelected = selectedIds.includes(b.id)
                const assignedCode = isSelected && idx < availableCodes.length ? availableCodes[selectedIds.indexOf(b.id)] : null
                return (
                  <div key={b.id}
                    onClick={() => toggleSelect(b.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected ? '#e8f8f7' : '#f4f5f7',
                      border: isSelected ? '1.5px solid #2BBFB3' : '1.5px solid transparent',
                    }}>
                    {/* Checkbox */}
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isSelected ? '#2BBFB3' : 'white',
                        border: isSelected ? 'none' : '1.5px solid #d1d5db',
                      }}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                      style={{ backgroundColor: '#2BBFB3' }}>
                      {(b.first_name?.[0] || '').toUpperCase()}{(b.last_name?.[0] || '').toUpperCase()}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1a2b4a' }}>
                        {b.first_name} {b.last_name}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#8a93a2' }}>
                        {b.email}{b.department ? ` · ${b.department}` : ''}
                      </p>
                    </div>

                    {/* Code assigné (preview) */}
                    {assignedCode && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: '#e8f0fe', color: '#1a2b4a', fontFamily: 'monospace' }}>
                        → {assignedCode.code}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={selectedIds.length === 0}
              className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold"
              style={{ backgroundColor: selectedIds.length === 0 ? '#d1d5db' : '#2BBFB3' }}>
              Envoyer {maxSendable} code{maxSendable > 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      )}

      {/* ─── Étape 3 : Envoi en cours ──────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="font-bold text-base mb-4" style={{ color: '#1a2b4a' }}>
            Envoi en cours — {selectedPartner?.name}
          </h2>

          {/* Barre de progression */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>
                {progress.current} / {progress.total}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#2BBFB3' }}>
                {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
              </p>
            </div>
            <div className="w-full rounded-full h-3" style={{ backgroundColor: '#f4f5f7' }}>
              <div className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  backgroundColor: '#2BBFB3',
                }} />
            </div>
          </div>

          {/* Log temps réel */}
          <div className="flex flex-col gap-1" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {progress.log.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#f4f5f7' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.status === 'success' ? '#2BBFB3' : '#ef4444' }} />
                <p className="text-xs flex-1 truncate" style={{ color: '#1a2b4a' }}>
                  {entry.name} ({entry.email})
                </p>
                <span className="text-[11px] font-medium flex-shrink-0"
                  style={{ color: entry.status === 'success' ? '#2BBFB3' : '#ef4444' }}>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Étape 4 : Rapport ─────────────────── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <div className="text-center mb-6">
            <span className="text-4xl block mb-3">
              {report.failed === 0 ? '✅' : report.sent === 0 ? '❌' : '⚠️'}
            </span>
            <h2 className="font-bold text-lg" style={{ color: '#1a2b4a' }}>
              Envoi terminé — {selectedPartner?.name}
            </h2>
          </div>

          {/* Stats résumé */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#e8f8f7' }}>
              <p className="text-2xl font-bold" style={{ color: '#2BBFB3' }}>{report.sent}</p>
              <p className="text-xs" style={{ color: '#065f46' }}>Envoyé{report.sent > 1 ? 's' : ''} avec succès</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: report.failed > 0 ? '#fee2e2' : '#f4f5f7' }}>
              <p className="text-2xl font-bold" style={{ color: report.failed > 0 ? '#ef4444' : '#8a93a2' }}>{report.failed}</p>
              <p className="text-xs" style={{ color: report.failed > 0 ? '#991b1b' : '#8a93a2' }}>Échec{report.failed > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Détail */}
          <div className="mb-6">
            <p className="text-sm font-semibold mb-3" style={{ color: '#1a2b4a' }}>Détail des envois</p>
            <div className="flex flex-col gap-1" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {report.details.map((d, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#f4f5f7' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: d.status === 'success' ? '#2BBFB3' : '#ef4444' }} />
                  <p className="text-xs flex-1 truncate" style={{ color: '#1a2b4a' }}>
                    {d.name}
                  </p>
                  <span className="text-[11px] truncate" style={{ color: '#8a93a2' }}>{d.email}</span>
                  {d.code && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: '#e8f0fe', color: '#1a2b4a', fontFamily: 'monospace' }}>
                      {d.code}
                    </span>
                  )}
                  <span className="text-[11px] font-medium flex-shrink-0"
                    style={{ color: d.status === 'success' ? '#2BBFB3' : '#ef4444' }}>
                    {d.status === 'success' ? '✓' : '✕'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleReset}
              className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#2BBFB3' }}>
              Nouvel envoi
            </button>
            <button onClick={handleExportReport}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              📥 Exporter le rapport
            </button>
          </div>
        </div>
      )}
    </div>
  )
}