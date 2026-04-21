import { useState, useEffect } from 'react'
import xano from '../../lib/xano'

const DIRECTUS_URL = 'https://directus-production-b0c2.up.railway.app'

const roleLabels = {
  admin: { label: 'Admin', bg: '#e8f0fe', text: '#1a2b4a' },
  member: { label: 'Membre', bg: '#f4f5f7', text: '#8a93a2' },
}

export default function AdminAccounts() {
  const [partners, setPartners] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    partner_id: '',
    role: 'admin',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partnersData, membersData] = await Promise.all([
          xano.getAll('partners'),
          xano.getAll('partner_members'),
        ])
        setPartners(partnersData)
        setMembers(membersData)
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const getPartnerName = id => {
    const p = partners.find(x => x.id === parseInt(id))
    return p ? p.name : 'Inconnu'
  }

  const handleCreate = async e => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!form.email || !form.password || !form.partner_id) {
      setError('Tous les champs sont requis')
      return
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setCreating(true)
    try {
      // 1. Créer l'utilisateur dans Directus
      const adminToken = localStorage.getItem('directus_token')
      const directusResp = await fetch(`${DIRECTUS_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          role: '3b118fe2-e2af-49c3-8b72-51bd004256ad', // ID du rôle partner dans Directus
        }),
      })

      if (!directusResp.ok) {
        const err = await directusResp.json()
        if (err.errors?.[0]?.message?.includes('unique')) {
          setError('Cet email existe déjà dans Directus')
        } else {
          setError(err.errors?.[0]?.message || 'Erreur Directus')
        }
        setCreating(false)
        return
      }

      // 2. Créer le partner_member dans Xano
      const newMember = await xano.create('partner_members', {
        partner_id: parseInt(form.partner_id),
        user_email: form.email,
        role: form.role,
        invited_by: JSON.parse(localStorage.getItem('heka_user')).email,
        status: 'active',
      })

      setMembers([...members, newMember])
      setSuccess(`Compte créé pour ${form.email} — rattaché à ${getPartnerName(form.partner_id)}`)
      setForm({ email: '', password: '', partner_id: '', role: 'admin' })
      setShowCreateForm(false)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      console.error('Erreur création:', err)
      setError('Erreur lors de la création du compte')
    } finally { setCreating(false) }
  }

  const handleRemove = async memberId => {
    if (!window.confirm('Retirer cet accès ?')) return
    try {
      await xano.remove('partner_members', memberId)
      setMembers(members.filter(m => m.id !== memberId))
    } catch (err) { console.error('Erreur:', err) }
  }

  const filteredMembers = search
    ? members.filter(m => `${m.user_email} ${getPartnerName(m.partner_id)}`.toLowerCase().includes(search.toLowerCase()))
    : members

  // Grouper par partenaire
  const membersByPartner = {}
  filteredMembers.forEach(m => {
    const name = getPartnerName(m.partner_id)
    if (!membersByPartner[name]) membersByPartner[name] = []
    membersByPartner[name].push(m)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{color:'#8a93a2'}}>Chargement...</p></div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Gestion des accès</h1>
          <p className="text-sm mt-1" style={{color:'#8a93a2'}}>
            {members.length} compte{members.length > 1 ? 's' : ''} partenaire{members.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-5 py-3 rounded-2xl text-white text-sm font-semibold w-full sm:w-auto"
          style={{backgroundColor:'#2BBFB3'}}>
          + Créer un accès partenaire
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: 'Total comptes', value: members.length, color: '#1a2b4a' },
          { label: 'Administrateurs', value: members.filter(m => m.role === 'admin').length, color: '#2BBFB3' },
          { label: 'Membres', value: members.filter(m => m.role === 'member').length, color: '#8a93a2' },
          { label: 'Partenaires liés', value: new Set(members.map(m => m.partner_id)).size, color: '#d97706' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 md:p-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
            <p className="text-xl md:text-2xl font-bold mb-1" style={{color:s.color}}>{s.value}</p>
            <p className="text-xs md:text-sm" style={{color:'#8a93a2'}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Messages */}
      {success && (
        <div className="rounded-2xl p-3 mb-4 flex items-center gap-3" style={{backgroundColor:'#e8f8f7', border:'1px solid #2BBFB3'}}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{backgroundColor:'#2BBFB3'}}>✓</div>
          <p className="text-sm" style={{color:'#1a2b4a'}}>{success}</p>
        </div>
      )}

      {/* Formulaire création */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.08)'}}>
          <h2 className="font-bold text-lg mb-6" style={{color:'#1a2b4a'}}>Nouveau compte partenaire</h2>

          {error && <div className="rounded-2xl p-3 mb-4 text-sm" style={{backgroundColor:'#fee2e2',color:'#ef4444'}}>{error}</div>}

          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="email@entreprise.com"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Mot de passe *</label>
                <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="Minimum 6 caractères"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Partenaire *</label>
                <select value={form.partner_id} onChange={e => setForm({...form, partner_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}}>
                  <option value="">Sélectionner un partenaire...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Rôle</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}}>
                  <option value="admin">Administrateur — peut inviter d'autres membres</option>
                  <option value="member">Membre — envoi de codes et demandes</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl p-3 mb-6" style={{backgroundColor:'#f4f5f7'}}>
              <p className="text-xs" style={{color:'#8a93a2'}}>
                Un compte sera créé dans Directus avec ces identifiants, et l'utilisateur sera rattaché à l'espace partenaire sélectionné. Il pourra se connecter immédiatement via le portail partenaire.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={creating}
                className="px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                style={{backgroundColor: creating ? '#8a93a2' : '#2BBFB3'}}>
                {creating ? 'Création...' : 'Créer le compte →'}
              </button>
              <button type="button" onClick={() => {setShowCreateForm(false); setError('')}}
                className="px-6 py-3 rounded-2xl text-sm font-semibold"
                style={{backgroundColor:'#f4f5f7', color:'#8a93a2'}}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recherche */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par email ou partenaire..."
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4"
        style={{backgroundColor:'#f4f5f7', color:'#1a2b4a'}} />

      {/* Liste groupée par partenaire */}
      {Object.keys(membersByPartner).length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
          <span className="text-4xl">🔐</span>
          <p className="font-bold text-lg mt-4" style={{color:'#1a2b4a'}}>
            {search ? 'Aucun résultat' : 'Aucun accès partenaire'}
          </p>
          <p className="text-sm mt-1" style={{color:'#8a93a2'}}>
            Créez un premier accès pour permettre à un partenaire de se connecter
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(membersByPartner).map(([partnerName, partnerMembers]) => (
            <div key={partnerName}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor:'#2BBFB3'}}>
                  {partnerName[0]}
                </div>
                <p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>{partnerName}</p>
                <span className="text-xs px-2 py-0.5 rounded-md" style={{backgroundColor:'#f4f5f7', color:'#8a93a2'}}>
                  {partnerMembers.length} membre{partnerMembers.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {partnerMembers.map(member => {
                  const r = roleLabels[member.role] || roleLabels.member
                  return (
                    <div key={member.id} className="bg-white rounded-2xl px-4 md:px-5 py-3 md:py-4 flex items-center justify-between"
                      style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                          style={{backgroundColor: member.role === 'admin' ? '#1a2b4a' : '#8a93a2'}}>
                          {member.user_email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{color:'#1a2b4a'}}>{member.user_email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{backgroundColor:r.bg, color:r.text}}>
                              {r.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-lg"
                              style={{backgroundColor: member.status === 'active' ? '#e8f8f7' : '#fef3c7', color: member.status === 'active' ? '#2BBFB3' : '#d97706'}}>
                              {member.status === 'active' ? 'Actif' : 'En attente'}
                            </span>
                            {member.invited_by && (
                              <span className="text-xs hidden sm:inline" style={{color:'#8a93a2'}}>
                                par {member.invited_by}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleRemove(member.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                        style={{backgroundColor:'#fee2e2', color:'#ef4444'}}
                        title="Retirer l'accès">×</button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}