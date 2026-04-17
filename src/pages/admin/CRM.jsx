import { useState, useEffect } from 'react'
import client from '../../lib/directus'
import { readItems, createItem } from '@directus/sdk'

const statusColors = {
  'prospect': { bg: '#f4f5f7', text: '#8a93a2' },
  'à contacter': { bg: '#fef3c7', text: '#d97706' },
  'à relancer': { bg: '#fee2e2', text: '#ef4444' },
  'en cours': { bg: '#e8f8f7', text: '#2BBFB3' },
  'client actif': { bg: '#e8f0fe', text: '#1a2b4a' },
  'inactif': { bg: '#f4f5f7', text: '#d1d5db' },
}

export default function CRM() {
  const [partners, setPartners] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [filterStatus, setFilterStatus] = useState('tous')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call',
    note: '',
    crm_status: '',
    next_followup_at: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partnersData, activitiesData] = await Promise.all([
          client.request(readItems('partners')),
          client.request(readItems('crm_activity')),
        ])
        setPartners(partnersData)
        setActivities(activitiesData)
      } catch (err) {
        console.error('Erreur:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAddActivity = async e => {
    e.preventDefault()
    try {
      const newActivity = await client.request(createItem('crm_activity', {
        ...activityForm,
        partner_id: selectedPartner.id,
        last_contact_at: new Date().toISOString(),
      }))
      setActivities([...activities, newActivity])
      setShowActivityForm(false)
      setActivityForm({ activity_type: 'call', note: '', crm_status: '', next_followup_at: '' })
    } catch (err) {
      console.error('Erreur ajout activité:', err)
    }
  }

  const partnerActivities = selectedPartner
    ? activities.filter(a => a.partner_id === selectedPartner.id)
    : []

  const filteredPartners = filterStatus === 'tous'
    ? partners
    : partners.filter(p => p.crm_status === filterStatus)

  const stats = {
    total: partners.length,
    aContacter: partners.filter(p => p.crm_status === 'à contacter').length,
    aRelancer: partners.filter(p => p.crm_status === 'à relancer').length,
    actifs: partners.filter(p => p.crm_status === 'client actif').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: '#8a93a2' }}>Chargement...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>CRM</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
          Suivi et gestion de la relation partenaires
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Total partenaires', value: stats.total, color: '#1a2b4a' },
          { label: 'À contacter', value: stats.aContacter, color: '#d97706' },
          { label: 'À relancer', value: stats.aRelancer, color: '#ef4444' },
          { label: 'Clients actifs', value: stats.actifs, color: '#2BBFB3' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6"
            style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-xs md:text-sm" style={{ color: '#8a93a2' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Liste partenaires — pleine largeur mobile, fixe desktop */}
        <div className={`${selectedPartner ? 'hidden lg:block' : ''} w-full lg:w-96 lg:flex-shrink-0`}>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['tous', 'à contacter', 'à relancer', 'en cours', 'client actif'].map(status => (
              <button key={status}
                onClick={() => setFilterStatus(status)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  backgroundColor: filterStatus === status ? '#2BBFB3' : '#f4f5f7',
                  color: filterStatus === status ? 'white' : '#8a93a2'
                }}>
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {filteredPartners.map(partner => (
              <div key={partner.id}
                onClick={() => setSelectedPartner(partner)}
                className="bg-white rounded-2xl px-4 py-4 cursor-pointer transition-all"
                style={{
                  boxShadow: selectedPartner?.id === partner.id
                    ? '0 0 0 2px #2BBFB3'
                    : '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: '#2BBFB3' }}>
                      {partner.name[0]}
                    </div>
                    <p className="font-semibold text-sm truncate" style={{ color: '#1a2b4a' }}>
                      {partner.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{
                      backgroundColor: statusColors[partner.crm_status]?.bg || '#f4f5f7',
                      color: statusColors[partner.crm_status]?.text || '#8a93a2'
                    }}>
                    {partner.crm_status || 'prospect'}
                  </span>
                  <span className="text-xs" style={{ color: '#8a93a2' }}>
                    {activities.filter(a => a.partner_id === partner.id).length} activité(s)
                  </span>
                </div>
              </div>
            ))}
            {filteredPartners.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: '#8a93a2' }}>
                Aucun partenaire dans cette catégorie
              </p>
            )}
          </div>
        </div>

        {/* Fiche partenaire */}
        <div className="flex-1">
          {selectedPartner ? (
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>

              {/* Bouton retour mobile */}
              <button
                onClick={() => setSelectedPartner(null)}
                className="lg:hidden flex items-center gap-2 mb-4 text-sm font-medium"
                style={{ color: '#8a93a2' }}>
                ← Retour à la liste
              </button>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg md:text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: '#2BBFB3' }}>
                    {selectedPartner.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-bold truncate" style={{ color: '#1a2b4a' }}>
                      {selectedPartner.name}
                    </h2>
                    <p className="text-sm truncate" style={{ color: '#8a93a2' }}>
                      {selectedPartner.email_contact} · {selectedPartner.phone}
                    </p>
                  </div>
                </div>
                <span className="text-sm px-3 py-1.5 rounded-xl font-medium w-fit"
                  style={{
                    backgroundColor: statusColors[selectedPartner.crm_status]?.bg || '#f4f5f7',
                    color: statusColors[selectedPartner.crm_status]?.text || '#8a93a2'
                  }}>
                  {selectedPartner.crm_status || 'prospect'}
                </span>
              </div>

              {selectedPartner.notes_internes && (
                <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: '#f4f5f7' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#8a93a2' }}>
                    NOTES INTERNES
                  </p>
                  <p className="text-sm" style={{ color: '#1a2b4a' }}>
                    {selectedPartner.notes_internes}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold" style={{ color: '#1a2b4a' }}>
                  Activités ({partnerActivities.length})
                </h3>
                <button
                  onClick={() => setShowActivityForm(!showActivityForm)}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: '#2BBFB3' }}>
                  + Ajouter
                </button>
              </div>

              {showActivityForm && (
                <form onSubmit={handleAddActivity}
                  className="rounded-2xl p-4 mb-4"
                  style={{ backgroundColor: '#f4f5f7' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a2b4a' }}>
                        Type
                      </label>
                      <select value={activityForm.activity_type}
                        onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white">
                        <option value="call">Appel</option>
                        <option value="email">Email</option>
                        <option value="meeting">Réunion</option>
                        <option value="demo">Démo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1a2b4a' }}>
                        Nouveau statut
                      </label>
                      <select value={activityForm.crm_status}
                        onChange={e => setActivityForm({ ...activityForm, crm_status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white">
                        <option value="">Inchangé</option>
                        <option value="à contacter">À contacter</option>
                        <option value="à relancer">À relancer</option>
                        <option value="en cours">En cours</option>
                        <option value="client actif">Client actif</option>
                        <option value="inactif">Inactif</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#1a2b4a' }}>
                      Note
                    </label>
                    <textarea value={activityForm.note}
                      onChange={e => setActivityForm({ ...activityForm, note: e.target.value })}
                      placeholder="Compte rendu de l'activité..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-white" />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#1a2b4a' }}>
                      Prochaine relance
                    </label>
                    <input type="date"
                      value={activityForm.next_followup_at}
                      onChange={e => setActivityForm({ ...activityForm, next_followup_at: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit"
                      className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                      style={{ backgroundColor: '#2BBFB3' }}>
                      Enregistrer
                    </button>
                    <button type="button"
                      onClick={() => setShowActivityForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium"
                      style={{ backgroundColor: 'white', color: '#8a93a2' }}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {partnerActivities.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#8a93a2' }}>
                  Aucune activité enregistrée
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {partnerActivities.map(activity => (
                    <div key={activity.id}
                      className="rounded-2xl p-3 md:p-4"
                      style={{ backgroundColor: '#f4f5f7' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                          {activity.activity_type}
                        </span>
                        <span className="text-xs" style={{ color: '#8a93a2' }}>
                          {new Date(activity.last_contact_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {activity.note && (
                        <p className="text-sm mt-2" style={{ color: '#1a2b4a' }}>
                          {activity.note}
                        </p>
                      )}
                      {activity.next_followup_at && (
                        <p className="text-xs mt-1" style={{ color: '#d97706' }}>
                          Relance : {new Date(activity.next_followup_at).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center hidden lg:block"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)', minHeight: '400px' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-16"
                style={{ backgroundColor: '#e8f8f7' }}>
                <span className="text-2xl">👆</span>
              </div>
              <p className="font-semibold" style={{ color: '#1a2b4a' }}>
                Sélectionnez un partenaire
              </p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
                pour voir sa fiche et ses activités
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}