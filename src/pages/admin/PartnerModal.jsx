import { useState, useEffect } from 'react'
import xano from '../../lib/xano'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

export default function PartnerModal({ partner, onClose, onUpdate }) {
  const [activities, setActivities] = useState([])
  const [members, setMembers] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [codes, setCodes] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...partner })
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityForm, setActivityForm] = useState({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
  const [activeTab, setActiveTab] = useState('overview') // overview, team, beneficiaries, codes, activities

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [acts, mems, benefs, codesData] = await Promise.all([
          xano.getAll('crm_activity', { partner_id: partner.id }),
          xano.getAll('partner_members', { partner_id: partner.id }),
          xano.getAll('beneficiaries', { partner_id: partner.id }),
          xano.getAll('plan-activation-code', { partnerId: partner.id }),
        ])
        setActivities(acts); setMembers(mems); setBeneficiaries(benefs); setCodes(codesData)
      } catch (err) { console.error(err) }
    }
    fetchAll()
  }, [partner.id])

  const handleSave = async () => {
    try {
      const updated = await xano.update('partners', partner.id, {
        name: form.name, partner_type: form.partner_type, email_contact: form.email_contact,
        phone: form.phone, crm_status: form.crm_status, notes_internes: form.notes_internes,
        contact_firstname: form.contact_firstname, contact_lastname: form.contact_lastname, contact_role: form.contact_role,
      })
      onUpdate(updated); setEditing(false)
    } catch (err) { console.error(err) }
  }

  const handleAddActivity = async e => {
    e.preventDefault()
    try {
      const created = await xano.create('crm_activity', { ...activityForm, partner_id: partner.id, last_contact_at: new Date().toISOString() })
      setActivities([created, ...activities]); setShowActivityForm(false)
      setActivityForm({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
    } catch (err) { console.error(err) }
  }

  const usedCodes = codes.filter(c => c.used).length
  const sentBenefs = beneficiaries.filter(b => b.status === 'sent' || b.status === 'activated').length

  const tabs = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'team', label: `Équipe (${members.length})` },
    { key: 'beneficiaries', label: `Salariés (${beneficiaries.length})` },
    { key: 'codes', label: `Codes (${codes.length})` },
    { key: 'activities', label: `Activités (${activities.length})` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full h-full md:h-auto md:rounded-3xl md:w-full md:max-w-4xl md:max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b" style={{ borderColor: '#f4f5f7' }}>
          <div className="flex items-start justify-between p-4 md:p-6 pb-4">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0"
                style={{ backgroundColor: '#2BBFB3' }}>
                {partner.name?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="text-lg font-bold px-3 py-1 rounded-xl outline-none w-full"
                    style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
                ) : (
                  <h2 className="text-lg md:text-xl font-bold truncate" style={{ color: '#1a2b4a' }}>{partner.name}</h2>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>{partner.partner_type || 'entreprise'}</span>
                  <span className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ backgroundColor: statusColors[partner.crm_status]?.bg || '#f4f5f7', color: statusColors[partner.crm_status]?.text || '#8a93a2' }}>
                    {partner.crm_status || 'prospect'}
                  </span>
                  <span className="text-xs hidden sm:inline" style={{ color: '#8a93a2' }}>
                    Créé le {new Date(partner.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {editing ? (
                <>
                  <button onClick={handleSave} className="px-3 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#2BBFB3' }}>Sauvegarder</button>
                  <button onClick={() => { setEditing(false); setForm({ ...partner }) }} className="px-3 py-2 rounded-xl text-sm font-medium hidden sm:block" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>Annuler</button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>✏️</button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>×</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 md:px-6 overflow-x-auto pb-0">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="px-3 py-2 text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  color: activeTab === t.key ? '#2BBFB3' : '#8a93a2',
                  borderBottom: activeTab === t.key ? '2px solid #2BBFB3' : '2px solid transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6">

          {/* ─── TAB: Vue d'ensemble ─── */}
          {activeTab === 'overview' && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Membres équipe', value: members.length, color: '#1a2b4a', icon: '👥' },
                  { label: 'Salariés inscrits', value: beneficiaries.length, color: '#2BBFB3', icon: '🧑‍💼' },
                  { label: 'Codes envoyés', value: sentBenefs, color: '#d97706', icon: '📨' },
                  { label: 'Codes disponibles', value: codes.length - usedCodes, color: '#2BBFB3', icon: '🔑' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{s.icon}</span>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                    <p className="text-xs" style={{ color: '#8a93a2' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Contact principal — carte cliquable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: '#f4f5f7' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>CONTACT PRINCIPAL</p>
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      {[{ key: 'contact_firstname', p: 'Prénom' }, { key: 'contact_lastname', p: 'Nom' }, { key: 'contact_role', p: 'Poste' }, { key: 'email_contact', p: 'Email' }, { key: 'phone', p: 'Téléphone' }].map(f => (
                        <input key={f.key} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.p} className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{ color: '#1a2b4a' }} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: '#1a2b4a' }}>
                        {(partner.contact_firstname?.[0] || '') + (partner.contact_lastname?.[0] || '')}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: '#1a2b4a' }}>
                          {partner.contact_firstname || '—'} {partner.contact_lastname || ''}
                        </p>
                        <p className="text-xs" style={{ color: '#8a93a2' }}>{partner.contact_role || 'Poste non renseigné'}</p>
                        <p className="text-xs mt-1" style={{ color: '#2BBFB3' }}>{partner.email_contact || '—'}</p>
                        <p className="text-xs" style={{ color: '#8a93a2' }}>{partner.phone || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Statut & type */}
                <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: '#f4f5f7' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>STATUT & TYPE</p>
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <select value={form.partner_type || 'entreprise'} onChange={e => setForm({ ...form, partner_type: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none bg-white">
                        <option value="entreprise">Entreprise</option><option value="mutuelle">Mutuelle</option><option value="prospect">Prospect</option>
                      </select>
                      <select value={form.crm_status || 'prospect'} onChange={e => setForm({ ...form, crm_status: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none bg-white">
                        <option value="prospect">Prospect</option><option value="à contacter">À contacter</option><option value="à relancer">À relancer</option><option value="en cours">En cours</option><option value="client actif">Client actif</option><option value="inactif">Inactif</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {[{ l: 'Type', v: partner.partner_type || 'entreprise' }, { l: 'Statut CRM', v: partner.crm_status || 'prospect' }, { l: 'Créé le', v: new Date(partner.created_at).toLocaleDateString('fr-FR') }].map(i => (
                        <div key={i.l}><p className="text-xs" style={{ color: '#8a93a2' }}>{i.l}</p><p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>{i.v}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>NOTES INTERNES</p>
                {editing ? (
                  <textarea value={form.notes_internes || ''} onChange={e => setForm({ ...form, notes_internes: e.target.value })} rows={3} className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
                ) : (
                  <div className="rounded-2xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
                    <p className="text-sm" style={{ color: partner.notes_internes ? '#1a2b4a' : '#8a93a2' }}>{partner.notes_internes || 'Aucune note'}</p>
                  </div>
                )}
              </div>

              {/* Membres de l'équipe — aperçu */}
              {members.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold" style={{ color: '#8a93a2' }}>ÉQUIPE PARTENAIRE ({members.length})</p>
                    <button onClick={() => setActiveTab('team')} className="text-xs font-medium" style={{ color: '#2BBFB3' }}>Voir tout →</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {members.slice(0, 5).map(m => (
                      <div key={m.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#f4f5f7' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: m.role === 'admin' ? '#1a2b4a' : '#2BBFB3' }}>
                          {m.user_email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium truncate" style={{ color: '#1a2b4a', maxWidth: '140px' }}>{m.user_email}</p>
                          <p className="text-xs" style={{ color: '#8a93a2' }}>{m.role === 'admin' ? 'Admin' : 'Membre'}</p>
                        </div>
                      </div>
                    ))}
                    {members.length > 5 && (
                      <div className="flex items-center px-3 py-2 rounded-xl" style={{ backgroundColor: '#f4f5f7' }}>
                        <p className="text-xs" style={{ color: '#8a93a2' }}>+{members.length - 5} autre(s)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dernières activités — aperçu */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold" style={{ color: '#8a93a2' }}>DERNIÈRES ACTIVITÉS</p>
                  <button onClick={() => setActiveTab('activities')} className="text-xs font-medium" style={{ color: '#2BBFB3' }}>Voir tout →</button>
                </div>
                {activities.slice(0, 3).map(a => (
                  <div key={a.id} className="rounded-xl p-3 mb-2" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>{a.activity_type}</span>
                      <span className="text-xs" style={{ color: '#8a93a2' }}>{new Date(a.last_contact_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {a.note && <p className="text-sm mt-1 truncate" style={{ color: '#1a2b4a' }}>{a.note}</p>}
                  </div>
                ))}
                {activities.length === 0 && <p className="text-sm py-3" style={{ color: '#8a93a2' }}>Aucune activité</p>}
              </div>
            </>
          )}

          {/* ─── TAB: Équipe ─── */}
          {activeTab === 'team' && (
            <div className="flex flex-col gap-2">
              {members.length === 0 ? <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>Aucun membre enregistré</p> : (
                members.map(m => (
                  <div key={m.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: m.role === 'admin' ? '#1a2b4a' : '#2BBFB3' }}>
                      {m.user_email?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{m.user_email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                          style={{ backgroundColor: m.role === 'admin' ? '#e8f0fe' : '#f4f5f7', color: m.role === 'admin' ? '#1a2b4a' : '#8a93a2' }}>
                          {m.role === 'admin' ? 'Admin' : 'Membre'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ backgroundColor: m.status === 'active' ? '#e8f8f7' : '#fef3c7', color: m.status === 'active' ? '#2BBFB3' : '#d97706' }}>
                          {m.status === 'active' ? 'Actif' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── TAB: Salariés ─── */}
          {activeTab === 'beneficiaries' && (
            <div className="flex flex-col gap-2">
              {beneficiaries.length === 0 ? <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>Aucun salarié enregistré</p> : (
                beneficiaries.map(b => (
                  <div key={b.id} className="rounded-2xl p-4 flex items-center justify-between" style={{ backgroundColor: '#f4f5f7' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: b.status === 'sent' || b.status === 'activated' ? '#8a93a2' : '#2BBFB3' }}>
                        {(b.first_name?.[0] || '') + (b.last_name?.[0] || '')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1a2b4a' }}>{b.first_name} {b.last_name}</p>
                        <p className="text-xs truncate" style={{ color: '#8a93a2' }}>{b.email}{b.department && ` · ${b.department}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {b.code && <span className="text-xs font-medium" style={{ fontFamily: 'monospace', color: '#1a2b4a' }}>{b.code}</span>}
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{
                          backgroundColor: b.status === 'sent' ? '#e8f8f7' : b.status === 'activated' ? '#e8f0fe' : '#fef3c7',
                          color: b.status === 'sent' ? '#2BBFB3' : b.status === 'activated' ? '#1a2b4a' : '#d97706'
                        }}>
                        {b.status === 'sent' ? 'Envoyé' : b.status === 'activated' ? 'Activé' : 'En attente'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── TAB: Codes ─── */}
          {activeTab === 'codes' && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ l: 'Total', v: codes.length, c: '#1a2b4a' }, { l: 'Utilisés', v: usedCodes, c: '#ef4444' }, { l: 'Disponibles', v: codes.length - usedCodes, c: '#2BBFB3' }].map(s => (
                  <div key={s.l} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#f4f5f7' }}>
                    <p className="text-lg font-bold" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-xs" style={{ color: '#8a93a2' }}>{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #f4f5f7' }}>
                <div className="grid grid-cols-3 px-4 py-2 text-xs font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}><span>CODE</span><span>STATUT</span><span>ATTRIBUÉ À</span></div>
                {codes.slice(0, 20).map((c, i) => {
                  const assignedTo = beneficiaries.find(b => b.code === c.code)
                  return (
                    <div key={c.id} className="grid grid-cols-3 px-4 py-2.5 items-center" style={{ borderTop: i > 0 ? '0.5px solid #f4f5f7' : 'none' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: c.used ? '#8a93a2' : '#2BBFB3', letterSpacing: '1.5px', textDecoration: c.used ? 'line-through' : 'none' }}>{c.code}</span>
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium w-fit" style={{ backgroundColor: c.used ? '#fee2e2' : (assignedTo ? '#e8f0fe' : '#e8f8f7'), color: c.used ? '#ef4444' : (assignedTo ? '#1a2b4a' : '#2BBFB3') }}>{c.used ? 'Utilisé' : (assignedTo ? 'Envoyé' : 'Dispo')}</span>
                      <span className="text-xs truncate" style={{ color: '#8a93a2' }}>{assignedTo ? `${assignedTo.first_name} ${assignedTo.last_name}` : '—'}</span>
                    </div>
                  )
                })}
                {codes.length > 20 && <p className="text-xs text-center py-3" style={{ color: '#8a93a2' }}>+ {codes.length - 20} codes supplémentaires</p>}
              </div>
            </>
          )}

          {/* ─── TAB: Activités ─── */}
          {activeTab === 'activities' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>Historique complet</p>
                <button onClick={() => setShowActivityForm(!showActivityForm)} className="px-3 py-1.5 rounded-xl text-white text-xs font-medium" style={{ backgroundColor: '#2BBFB3' }}>+ Ajouter</button>
              </div>
              {showActivityForm && (
                <form onSubmit={handleAddActivity} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: '#f4f5f7' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <select value={activityForm.activity_type} onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none bg-white">
                      <option value="call">Appel</option><option value="email">Email</option><option value="meeting">Réunion</option><option value="demo">Démo</option>
                    </select>
                    <input type="date" value={activityForm.next_followup_at} onChange={e => setActivityForm({ ...activityForm, next_followup_at: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none bg-white" />
                  </div>
                  <textarea value={activityForm.note} onChange={e => setActivityForm({ ...activityForm, note: e.target.value })} placeholder="Note..." rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-white mb-3" />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#2BBFB3' }}>Enregistrer</button>
                    <button type="button" onClick={() => setShowActivityForm(false)} className="px-4 py-2 rounded-xl text-sm bg-white" style={{ color: '#8a93a2' }}>Annuler</button>
                  </div>
                </form>
              )}
              <div className="flex flex-col gap-2">
                {activities.length === 0 ? <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>Aucune activité</p> : (
                  activities.map(a => (
                    <div key={a.id} className="rounded-2xl p-3" style={{ backgroundColor: '#f4f5f7' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>{a.activity_type}</span>
                        <span className="text-xs" style={{ color: '#8a93a2' }}>{new Date(a.last_contact_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {a.note && <p className="text-sm mt-1" style={{ color: '#1a2b4a' }}>{a.note}</p>}
                      {a.next_followup_at && <p className="text-xs mt-1" style={{ color: '#d97706' }}>Relance : {new Date(a.next_followup_at).toLocaleDateString('fr-FR')}</p>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}