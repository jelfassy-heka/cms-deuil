import { useState, useEffect } from 'react'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${XANO_BASE}/users`)
        const data = await response.json()
        setUsers(Array.isArray(data) ? data : data.items || [])
      } catch (err) {
        console.error('Erreur chargement users:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: users.length,
    hommes: users.filter(u => u.gender === 'Masculin').length,
    femmes: users.filter(u => u.gender === 'Féminin').length,
    nonPrecise: users.filter(u => u.gender === 'Pas précisé' || !u.gender).length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: '#8a93a2' }}>Chargement...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Utilisateurs</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
          Données en temps réel depuis Xano
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Total utilisateurs', value: stats.total, color: '#2BBFB3' },
          { label: 'Hommes', value: stats.hommes, color: '#1a2b4a' },
          { label: 'Femmes', value: stats.femmes, color: '#d97706' },
          { label: 'Non précisé', value: stats.nonPrecise, color: '#8a93a2' },
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

        {/* Liste */}
        <div className={`flex-1 ${selectedUser ? 'hidden lg:block' : ''}`}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredUsers.map(user => (
              <div key={user.id}
                onClick={() => setSelectedUser(user)}
                className="bg-white rounded-2xl px-4 md:px-5 py-3 md:py-4 flex items-center justify-between cursor-pointer"
                style={{
                  boxShadow: selectedUser?.id === user.id
                    ? '0 0 0 2px #2BBFB3'
                    : '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: '#2BBFB3' }}>
                    {user.firstName?.[0] || user.email?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1a2b4a' }}>
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#8a93a2' }}>{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs px-2 py-1 rounded-lg hidden sm:inline-block"
                    style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
                    {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: '#8a93a2' }}>
                Aucun utilisateur trouvé
              </p>
            )}
          </div>
        </div>

        {/* Fiche utilisateur */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          {selectedUser ? (
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 lg:sticky lg:top-4"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>

              {/* Bouton retour mobile */}
              <button
                onClick={() => setSelectedUser(null)}
                className="lg:hidden flex items-center gap-2 mb-4 text-sm font-medium"
                style={{ color: '#8a93a2' }}>
                ← Retour à la liste
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3"
                  style={{ backgroundColor: '#2BBFB3' }}>
                  {selectedUser.firstName?.[0] || '?'}
                </div>
                <h2 className="font-bold" style={{ color: '#1a2b4a' }}>
                  {selectedUser.firstName} {selectedUser.lastName}
                </h2>
                <p className="text-sm break-all" style={{ color: '#8a93a2' }}>{selectedUser.email}</p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { label: 'Inscrit le', value: new Date(selectedUser.created_at).toLocaleDateString('fr-FR') },
                  { label: 'Genre', value: selectedUser.gender || 'Non précisé' },
                  { label: 'ID', value: `#${selectedUser.id}` },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl p-3"
                    style={{ backgroundColor: '#f4f5f7' }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#8a93a2' }}>
                      {item.label.toUpperCase()}
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#1a2b4a' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center hidden lg:block"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <span className="text-3xl">👤</span>
              <p className="font-semibold mt-3" style={{ color: '#1a2b4a' }}>
                Sélectionnez un utilisateur
              </p>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
                pour voir son profil
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}