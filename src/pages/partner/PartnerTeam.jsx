import { useState, useEffect } from 'react'
import xano from '../../lib/xano'
import { useAuth } from '../../context/AuthContext'

const roleLabels = {
  admin: { label: 'Administrateur', bg: '#e8f0fe', text: '#1a2b4a' },
  member: { label: 'Membre', bg: '#f4f5f7', text: '#8a93a2' },
}

const statusLabels = {
  active: { label: 'Actif', bg: '#e8f8f7', text: '#2BBFB3' },
  pending: { label: 'Invitation envoyée', bg: '#fef3c7', text: '#d97706' },
}

export default function PartnerTeam({ partnerId }) {
  const { user, memberRole } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ user_email: '', role: 'member' })
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [partnerInfo, setPartnerInfo] = useState(null)
  const [benefCount, setBenefCount] = useState(0)
  const [codesCount, setCodesCount] = useState({ total: 0, used: 0 })

  const isAdmin = memberRole === 'admin'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersData, partnerData, benefData, codesData] = await Promise.all([
          xano.getAll('partner_members', { partner_id: partnerId }),
          xano.getOne('partners', partnerId),
          xano.getAll('beneficiaries', { partner_id: partnerId }),
          xano.getAll('plan-activation-code', { partnerId }),
        ])
        setMembers(membersData)
        setPartnerInfo(partnerData)
        setBenefCount(benefData.length)
        setCodesCount({ total: codesData.length, used: codesData.filter(c => c.used).length })
      } catch (err) { console.error('Erreur:', err) }
      finally { setLoading(false) }
    }
    if (partnerId) fetchData()
  }, [partnerId])

  const handleInvite = async e => {
    e.preventDefault()
    setInviteError(''); setInviteSuccess('')
    if (!inviteForm.user_email) { setInviteError('Email requis'); return }

    // Vérifier si déjà membre
    if (members.some(m => m.user_email === inviteForm.user_email)) {
      setInviteError('Cette personne est déjà membre de l\'espace'); return
    }

    try {
      const created = await xano.create('partner_members', {
        partner_id: partnerId,
        user_email: inviteForm.user_email,
        role: inviteForm.role,
        invited_by: user.email,
        status: 'pending',
      })
      setMembers([...members, created])
      setInviteSuccess(`Invitation envoyée à ${inviteForm.user_email}`)
      setInviteForm({ user_email: '', role: 'member' })
      setTimeout(() => setInviteSuccess(''), 4000)
    } catch (err) {
      console.error('Erreur invitation:', err)
      setInviteError('Erreur lors de l\'invitation')
    }
  }

  const handleRemove = async (memberId) => {
    if (!window.confirm('Retirer ce membre de l\'espace ?')) return
    try {
      await xano.remove('partner_members', memberId)
      setMembers(members.filter(m => m.id !== memberId))
    } catch (err) { console.error('Erreur:', err) }
  }

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await xano.update('partner_members', memberId, { role: newRole })
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (err) { console.error('Erreur:', err) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{ color: '#8a93a2' }}>Chargement...</p></div>

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Mon équipe</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
          Gérez les membres de votre espace {partnerInfo?.name || ''}
        </p>
      </div>

      {/* Carte espace entreprise */}
      <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 mb-6"
        style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#2BBFB3' }}>
            {partnerInfo?.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{partnerInfo?.name || 'Espace partenaire'}</h2>
            <p className="text-sm" style={{ color: '#8a93a2' }}>{partnerInfo?.partner_type || 'entreprise'}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="text-center px-4">
              <p className="text-xl font-bold" style={{ color: '#2BBFB3' }}>{members.length}</p>
              <p className="text-xs" style={{ color: '#8a93a2' }}>Membres</p>
            </div>
            <div className="text-center px-4" style={{ borderLeft: '1px solid #f4f5f7' }}>
              <p className="text-xl font-bold" style={{ color: '#1a2b4a' }}>{benefCount}</p>
              <p className="text-xs" style={{ color: '#8a93a2' }}>Salariés</p>
            </div>
            <div className="text-center px-4" style={{ borderLeft: '1px solid #f4f5f7' }}>
              <p className="text-xl font-bold" style={{ color: '#d97706' }}>{codesCount.total - codesCount.used}</p>
              <p className="text-xs" style={{ color: '#8a93a2' }}>Codes dispo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Membres actifs', value: activeMembers.length, color: '#2BBFB3' },
          { label: 'Invitations', value: pendingMembers.length, color: '#d97706' },
          { label: 'Administrateurs', value: members.filter(m => m.role === 'admin').length, color: '#1a2b4a' },
          { label: 'Membres', value: members.filter(m => m.role === 'member').length, color: '#8a93a2' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: '#8a93a2' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bouton inviter (admin uniquement) */}
      {isAdmin && (
        <div className="mb-6">
          {!showInvite ? (
            <button onClick={() => setShowInvite(true)}
              className="px-5 py-3 rounded-2xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#2BBFB3' }}>
              + Inviter un collaborateur
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <h3 className="font-bold mb-4" style={{ color: '#1a2b4a' }}>Inviter un collaborateur</h3>
              {inviteError && <div className="rounded-xl p-3 mb-3 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{inviteError}</div>}
              {inviteSuccess && <div className="rounded-xl p-3 mb-3 text-sm" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>✓ {inviteSuccess}</div>}
              <form onSubmit={handleInvite}>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <input type="email" value={inviteForm.user_email}
                    onChange={e => setInviteForm({ ...inviteForm, user_email: e.target.value })}
                    placeholder="email@entreprise.com"
                    className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
                  <select value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
                    <option value="member">Membre</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <p className="text-xs mb-4" style={{ color: '#8a93a2' }}>
                  Les administrateurs peuvent inviter et retirer des membres. Les membres peuvent envoyer des codes et faire des demandes.
                </p>
                <div className="flex gap-2">
                  <button type="submit" className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: '#2BBFB3' }}>Envoyer l'invitation</button>
                  <button type="button" onClick={() => { setShowInvite(false); setInviteError('') }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>Annuler</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Liste des membres */}
      <div className="mb-4">
        <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>
          Membres actifs ({activeMembers.length})
        </p>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {activeMembers.map(member => {
          const isCurrentUser = member.user_email === user.email
          const r = roleLabels[member.role] || roleLabels.member
          return (
            <div key={member.id} className="bg-white rounded-2xl px-4 md:px-5 py-4"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: isCurrentUser ? '1.5px solid #2BBFB3' : '1.5px solid transparent' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: member.role === 'admin' ? '#1a2b4a' : '#2BBFB3' }}>
                    {member.user_email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1a2b4a' }}>
                      {member.user_email}
                      {isCurrentUser && <span className="text-xs ml-2" style={{ color: '#8a93a2' }}>(vous)</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                        style={{ backgroundColor: r.bg, color: r.text }}>{r.label}</span>
                      {member.invited_by && (
                        <span className="text-xs" style={{ color: '#8a93a2' }}>
                          Invité par {member.invited_by === user.email ? 'vous' : member.invited_by}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && !isCurrentUser && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs outline-none"
                      style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
                      <option value="member">Membre</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => handleRemove(member.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                      style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}
                      title="Retirer">×</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {activeMembers.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>Aucun membre actif</p>
        )}
      </div>

      {/* Invitations en attente */}
      {pendingMembers.length > 0 && (
        <>
          <div className="mb-4">
            <p className="text-sm font-semibold" style={{ color: '#d97706' }}>
              Invitations en attente ({pendingMembers.length})
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {pendingMembers.map(member => (
              <div key={member.id} className="bg-white rounded-2xl px-4 md:px-5 py-4"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: 0.7 }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                      {member.user_email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1a2b4a' }}>{member.user_email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                          style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>En attente</span>
                        <span className="text-xs" style={{ color: '#8a93a2' }}>
                          {roleLabels[member.role]?.label || 'Membre'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleRemove(member.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Info permissions */}
      {!isAdmin && (
        <div className="rounded-2xl p-4 mt-6" style={{ backgroundColor: '#f4f5f7' }}>
          <p className="text-xs" style={{ color: '#8a93a2' }}>
            Seuls les administrateurs peuvent inviter ou retirer des membres. Contactez un administrateur de votre espace pour modifier l'équipe.
          </p>
        </div>
      )}
    </div>
  )
}