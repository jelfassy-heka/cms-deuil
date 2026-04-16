import { useState, useEffect } from 'react'
import client from '../../lib/directus'
import { createItem, readItems, updateItem } from '@directus/sdk'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

function PartnerModal({ partner, onClose, onUpdate }) {
  const [activities, setActivities] = useState([])
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...partner })
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call',
    note: '',
    crm_status: '',
    next_followup_at: '',
  })

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await client.request(readItems('crm_activity', {
          filter: { partner_id: { _eq: partner.id } },
          sort: ['-date_created'],
        }))
        setActivities(data)
      } catch (err) {
        console.error('Erreur activités:', err)
      }
    }
    fetchActivities()
  }, [partner.id])

  const handleSave = async () => {
    try {
      const updated = await client.request(updateItem('partners', partner.id, {
        name: form.name,
        partner_type: form.partner_type,
        email_contact: form.email_contact,
        phone: form.phone,
        crm_status: form.crm_status,
        notes_internes: form.notes_internes,
        contact_firstname: form.contact_firstname,
        contact_lastname: form.contact_lastname,
        contact_role: form.contact_role,
      }))
      onUpdate(updated)
      setEditing(false)
    } catch (err) {
      console.error('Erreur mise à jour:', err)
    }
  }

  const handleAddActivity = async e => {
    e.preventDefault()
    try {
      const newActivity = await client.request(createItem('crm_activity', {
        ...activityForm,
        partner_id: partner.id,
        last_contact_at: new Date().toISOString(),
      }))
      setActivities([newActivity, ...activities])
      setShowActivityForm(false)
      setActivityForm({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
    } catch (err) {
      console.error('Erreur activité:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-screen overflow-y-auto"
        style={{ boxShadow: '0 20px 60px rgba(43,191,179,0.15)' }}>

        {/* Header */}
        <div className="flex items-start justify-between p-8 pb-6 border-b"
          style={{ borderColor: '#f4f5f7' }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: '#2BBFB3' }}>
              {partner.name?.[0]}
            </div>
            <div>
              {editing ? (
                <input value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="text-xl font-bold px-3 py-1 rounded-xl outline-none"
                  style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
              ) : (
<h2 className="text-xl font-bold" style={{ color: '#1a2b4a' }}>
  {[partner.contact_firstname, partner.contact_lastname].filter(Boolean).join(' ') || partner.name}
  {partner.contact_firstname && (
    <span className="text-base font-normal ml-2" style={{ color: '#8a93a2' }}>
      — {partner.name}
    </span>
  )}
</h2>              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-1 rounded-lg"
                  style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                  {partner.partner_type || 'entreprise'}
                </span>
                <span className="text-xs px-2 py-1 rounded-lg font-medium"
                  style={{
                    backgroundColor: statusColors[partner.crm_status]?.bg || '#f4f5f7',
                    color: statusColors[partner.crm_status]?.text || '#8a93a2'
                  }}>
                  {partner.crm_status || 'prospect'}
                </span>
                <span className="text-xs" style={{ color: '#8a93a2' }}>
                  Créé le {new Date(partner.date_created).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={handleSave}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: '#2BBFB3' }}>
                  Sauvegarder
                </button>
                <button onClick={() => { setEditing(false); setForm({ ...partner }) }}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                  Annuler
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
                ✏️ Modifier
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
              ×
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-6 mb-8">

            {/* Contact */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#f4f5f7' }}>
              <p className="text-xs font-semibold mb-4" style={{ color: '#8a93a2' }}>
                CONTACT PRINCIPAL
              </p>
              {editing ? (
                <div className="flex flex-col gap-3">
                  {[
                    { key: 'contact_firstname', placeholder: 'Prénom' },
                    { key: 'contact_lastname', placeholder: 'Nom' },
                    { key: 'contact_role', placeholder: 'Poste (ex: DRH)' },
                    { key: 'email_contact', placeholder: 'Email' },
                    { key: 'phone', placeholder: 'Téléphone' },
                  ].map(field => (
                    <input key={field.key}
                      value={form[field.key] || ''}
                      onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white"
                      style={{ color: '#1a2b4a' }} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="font-semibold" style={{ color: '#1a2b4a' }}>
                    {partner.contact_firstname || '—'} {partner.contact_lastname || ''}
                  </p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>
                    {partner.contact_role || 'Poste non renseigné'}
                  </p>
                  <p className="text-sm" style={{ color: '#2BBFB3' }}>
                    {partner.email_contact || 'Email non renseigné'}
                  </p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>
                    {partner.phone || 'Téléphone non renseigné'}
                  </p>
                </div>
              )}
            </div>

            {/* Statut CRM */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#f4f5f7' }}>
              <p className="text-xs font-semibold mb-4" style={{ color: '#8a93a2' }}>
                STATUT & TYPE
              </p>
              {editing ? (
                <div className="flex flex-col gap-3">
                  <select value={form.partner_type || 'entreprise'}
                    onChange={e => setForm({ ...form, partner_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white">
                    <option value="entreprise">Entreprise</option>
                    <option value="mutuelle">Mutuelle</option>
                    <option value="prospect">Prospect</option>
                  </select>
                  <select value={form.crm_status || 'prospect'}
                    onChange={e => setForm({ ...form, crm_status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white">
                    <option value="prospect">Prospect</option>
                    <option value="à contacter">À contacter</option>
                    <option value="à relancer">À relancer</option>
                    <option value="en cours">En cours</option>
                    <option value="client actif">Client actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Type', value: partner.partner_type || 'entreprise' },
                    { label: 'Statut CRM', value: partner.crm_status || 'prospect' },
                    { label: 'Créé le', value: new Date(partner.date_created).toLocaleDateString('fr-FR') },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs" style={{ color: '#8a93a2' }}>{item.label}</p>
                      <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes internes */}
          <div className="mb-8">
            <p className="text-xs font-semibold mb-3" style={{ color: '#8a93a2' }}>
              NOTES INTERNES
            </p>
            {editing ? (
              <textarea value={form.notes_internes || ''}
                onChange={e => setForm({ ...form, notes_internes: e.target.value })}
                placeholder="Notes internes..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
            ) : (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
                <p className="text-sm" style={{ color: partner.notes_internes ? '#1a2b4a' : '#8a93a2' }}>
                  {partner.notes_internes || 'Aucune note'}
                </p>
              </div>
            )}
          </div>

          {/* Activités CRM */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold" style={{ color: '#8a93a2' }}>
                ACTIVITÉS CRM ({activities.length})
              </p>
              <button onClick={() => setShowActivityForm(!showActivityForm)}
                className="px-3 py-1.5 rounded-xl text-white text-xs font-medium"
                style={{ backgroundColor: '#2BBFB3' }}>
                + Ajouter
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleAddActivity}
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: '#f4f5f7' }}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select value={activityForm.activity_type}
                    onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                    className="px-3 py-2 rounded-xl text-sm outline-none bg-white">
                    <option value="call">Appel</option>
                    <option value="email">Email</option>
                    <option value="meeting">Réunion</option>
                    <option value="demo">Démo</option>
                  </select>
                  <input type="date"
                    value={activityForm.next_followup_at}
                    onChange={e => setActivityForm({ ...activityForm, next_followup_at: e.target.value })}
                    className="px-3 py-2 rounded-xl text-sm outline-none bg-white" />
                </div>
                <textarea value={activityForm.note}
                  onChange={e => setActivityForm({ ...activityForm, note: e.target.value })}
                  placeholder="Note..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-white mb-3" />
                <div className="flex gap-2">
                  <button type="submit"
                    className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ backgroundColor: '#2BBFB3' }}>
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setShowActivityForm(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-white"
                    style={{ color: '#8a93a2' }}>
                    Annuler
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-2">
              {activities.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: '#8a93a2' }}>
                  Aucune activité enregistrée
                </p>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} className="rounded-2xl p-4 flex items-start gap-3"
                    style={{ backgroundColor: '#f4f5f7' }}>
                    <span className="text-xs px-2 py-1 rounded-lg font-medium mt-0.5"
                      style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                      {activity.activity_type}
                    </span>
                    <div className="flex-1">
                      {activity.note && (
                        <p className="text-sm mb-1" style={{ color: '#1a2b4a' }}>{activity.note}</p>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: '#8a93a2' }}>
                          {new Date(activity.last_contact_at).toLocaleDateString('fr-FR')}
                        </span>
                        {activity.next_followup_at && (
                          <span className="text-xs" style={{ color: '#d97706' }}>
                            Relance : {new Date(activity.next_followup_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Partners() {
  const [showForm, setShowForm] = useState(false)
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email_contact: '',
    phone: '',
    partner_type: 'entreprise',
    crm_status: 'prospect',
    notes_internes: '',
    contact_firstname: '',
    contact_lastname: '',
    contact_role: '',
  })

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const data = await client.request(readItems('partners'))
        setPartners(data)
      } catch (err) {
        console.error('Erreur chargement partenaires:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPartners()
  }, [])

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    try {
      const newPartner = await client.request(createItem('partners', form))
      setPartners([...partners, newPartner])
      setForm({
        name: '', email_contact: '', phone: '',
        partner_type: 'entreprise', crm_status: 'prospect',
        notes_internes: '', contact_firstname: '',
        contact_lastname: '', contact_role: '',
      })
      setShowForm(false)
    } catch (err) {
      console.error('Erreur création:', err)
      alert('Erreur lors de la création.')
    }
  }

  const handleUpdate = (updated) => {
    setPartners(partners.map(p => p.id === updated.id ? updated : p))
    setSelectedPartner(updated)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: '#8a93a2' }}>Chargement...</p>
    </div>
  )

  return (
    <div>
      {/* Modale */}
      {selectedPartner && (
        <PartnerModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a2b4a' }}>Partenaires</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
            {partners.length} partenaire{partners.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-5 py-3 rounded-2xl text-white text-sm font-semibold"
          style={{ backgroundColor: '#2BBFB3' }}>
          + Ajouter un partenaire
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-3xl p-8 mb-6"
          style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.08)' }}>
          <h2 className="font-bold text-lg mb-6" style={{ color: '#1a2b4a' }}>
            Nouveau partenaire
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { name: 'name', placeholder: "Nom de l'organisation *", required: true },
                { name: 'contact_firstname', placeholder: 'Prénom contact' },
                { name: 'contact_lastname', placeholder: 'Nom contact' },
                { name: 'contact_role', placeholder: 'Poste (ex: DRH)' },
                { name: 'email_contact', placeholder: 'Email contact', type: 'email' },
                { name: 'phone', placeholder: 'Téléphone' },
              ].map(field => (
                <div key={field.name}>
                  <input name={field.name} value={form[field.name]}
                    onChange={handleChange} required={field.required}
                    placeholder={field.placeholder} type={field.type || 'text'}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ backgroundColor: '#f4f5f7' }} />
                </div>
              ))}
              <div>
                <select name="partner_type" value={form.partner_type} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                  style={{ backgroundColor: '#f4f5f7' }}>
                  <option value="entreprise">Entreprise</option>
                  <option value="mutuelle">Mutuelle</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>
              <div>
                <select name="crm_status" value={form.crm_status} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                  style={{ backgroundColor: '#f4f5f7' }}>
                  <option value="prospect">Prospect</option>
                  <option value="à contacter">À contacter</option>
                  <option value="à relancer">À relancer</option>
                  <option value="en cours">En cours</option>
                  <option value="client actif">Client actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
            </div>
            <div className="mb-6">
              <textarea name="notes_internes" value={form.notes_internes}
                onChange={handleChange} placeholder="Notes internes..." rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                style={{ backgroundColor: '#f4f5f7' }} />
            </div>
            <div className="flex gap-3">
              <button type="submit"
                className="px-6 py-3 rounded-2xl text-white text-sm font-semibold"
                style={{ backgroundColor: '#2BBFB3' }}>
                Enregistrer
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {partners.length === 0 && !showForm ? (
        <div className="bg-white rounded-3xl p-12 text-center"
          style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <span className="text-4xl">🏢</span>
          <p className="font-bold text-lg mt-4" style={{ color: '#1a2b4a' }}>Aucun partenaire</p>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
            Cliquez sur "Ajouter un partenaire" pour commencer
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {partners.map(partner => (
            <div key={partner.id}
              onClick={() => setSelectedPartner(partner)}
              className="bg-white rounded-3xl px-6 py-5 flex items-center justify-between cursor-pointer transition-all hover:shadow-md"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg"
                  style={{ backgroundColor: '#2BBFB3' }}>
                  {partner.name?.[0]}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: '#1a2b4a' }}>{partner.name}</p>
                  <p className="text-sm" style={{ color: '#8a93a2' }}>
                    {partner.contact_firstname} {partner.contact_lastname}
                    {partner.contact_role ? ` · ${partner.contact_role}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>
                    {partner.email_contact}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: (statusColors[partner.crm_status]?.bg) || '#f4f5f7',
                    color: (statusColors[partner.crm_status]?.text) || '#8a93a2'
                  }}>
                  {partner.crm_status || 'prospect'}
                </span>
                <span className="text-xs px-3 py-1 rounded-full"
                  style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                  {partner.partner_type || 'entreprise'}
                </span>
                <span className="text-xs" style={{ color: '#8a93a2' }}>→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}