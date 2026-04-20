import { useState, useEffect } from 'react'
import xano from '../../lib/xano'

const DIRECTUS_URL = 'https://directus-production-b0c2.up.railway.app'

function generateCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const letter = letters[Math.floor(Math.random() * letters.length)]
  const numbers = String(Math.floor(Math.random() * 90000) + 10000)
  return letter + numbers
}

export default function CodeGenerator() {
  const [partners, setPartners] = useState([])
  const [selectedPartner, setSelectedPartner] = useState('')
  const [quantity, setQuantity] = useState(10)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPartners, setLoadingPartners] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [stats, setStats] = useState({ total: 0, used: 0, unused: 0 })
  const [previewCode, setPreviewCode] = useState('A12345')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partnersData, codesData] = await Promise.all([
          xano.getAll('partners'),
          xano.getAll('plan-activation-codes'),
        ])
        setPartners(partnersData)
        const used = codesData.filter(c => c.used).length
        setStats({ total: codesData.length, used, unused: codesData.length - used })
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoadingPartners(false) }
    }
    fetchData()

    const interval = setInterval(() => setPreviewCode(generateCode()), 1500)
    return () => clearInterval(interval)
  }, [])

  const handleGenerate = async e => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!selectedPartner) { setError('Sélectionnez un partenaire'); return }
    if (!password) { setError('Confirmez votre mot de passe'); return }
    if (quantity < 1 || quantity > 500) { setError('Quantité entre 1 et 500'); return }

    setLoading(true)
    try {
      // 1. Vérifier mot de passe via Directus
      const authResp = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: JSON.parse(localStorage.getItem('heka_user')).email, password }),
      })
      if (!authResp.ok) { setError('Mot de passe incorrect'); setLoading(false); return }

      const partner = partners.find(p => p.id === parseInt(selectedPartner))
      const generatedCodes = []
      for (let i = 0; i < quantity; i++) generatedCodes.push(generateCode())

      // 2. Sauvegarder dans Xano (plan-activation-codes) — plus besoin de double écriture
      await Promise.all(generatedCodes.map(code =>
        xano.create('plan-activation-codes', {
          code,
          partnerId: parseInt(selectedPartner),
          used: false,
          usedBy: 0,
          target: '',
          planId: 0,
        })
      ))

      // 3. Mettre à jour les stats
      setStats(prev => ({ total: prev.total + quantity, used: prev.used, unused: prev.unused + quantity }))
      setSuccess(`${quantity} codes générés pour ${partner.name} !`)
      setPassword(''); setQuantity(10); setSelectedPartner('')
    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors de la génération. Réessayez.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Générateur de codes</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Créez et assignez des codes d'accès Héka</p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Total créés', value: stats.total, color: '#2BBFB3' },
          { label: 'Utilisés', value: stats.used, color: '#ef4444' },
          { label: 'Disponibles', value: stats.unused, color: '#1a2b4a' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl md:text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="font-bold text-lg mb-6" style={{ color: '#1a2b4a' }}>Nouveau lot de codes</h2>
          {error && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{error}</div>}
          {success && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>✓ {success}</div>}

          <form onSubmit={handleGenerate}>
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Partenaire destinataire</label>
              {loadingPartners ? <p className="text-sm" style={{ color: '#8a93a2' }}>Chargement...</p> : (
                <select value={selectedPartner} onChange={e => setSelectedPartner(e.target.value)} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
                  <option value="">Sélectionner...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Quantité</label>
              <div className="flex gap-2 flex-wrap">
                <input type="number" min="1" max="500" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="flex-1 min-w-0 px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
                <div className="flex gap-2">{[10, 25, 50, 100].map(n => <button key={n} type="button" onClick={() => setQuantity(n)} className="px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: quantity === n ? '#2BBFB3' : '#f4f5f7', color: quantity === n ? 'white' : '#8a93a2' }}>{n}</button>)}</div>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Mot de passe admin</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe..." className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ backgroundColor: loading ? '#8a93a2' : '#2BBFB3' }}>{loading ? '⟳ Génération...' : `Générer ${quantity} code${quantity > 1 ? 's' : ''} →`}</button>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#1a2b4a' }}>Aperçu du format</p>
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#f4f5f7' }}>
              <p className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#2BBFB3', fontFamily: 'monospace', letterSpacing: '4px' }}>{previewCode}</p>
              <p className="text-xs" style={{ color: '#8a93a2' }}>1 lettre + 5 chiffres</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#1a2b4a' }}>Flux de génération</p>
            <div className="flex flex-col gap-3">
              {[{ s: '1', l: 'Vérification du mot de passe' },{ s: '2', l: 'Génération des codes' },{ s: '3', l: 'Sauvegarde dans Xano' },{ s: '4', l: 'Disponibles dans l\'espace partenaire' }].map(i => (
                <div key={i.s} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: i.s === '4' ? '#1a2b4a' : '#2BBFB3' }}>{i.s}</div>
                  <p className="text-sm" style={{ color: '#1a2b4a' }}>{i.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#d97706' }}>⚠️ Action irréversible</p>
            <p className="text-xs" style={{ color: '#92400e' }}>Les codes sont immédiatement actifs.</p>
          </div>
        </div>
      </div>
    </div>
  )
}