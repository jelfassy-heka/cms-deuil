import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const XANO_AUTH_URL = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [partnerId, setPartnerId] = useState(null)
  const [memberRole, setMemberRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('heka_user')
    const savedRole = localStorage.getItem('heka_role')
    const savedToken = localStorage.getItem('heka_auth_token')
    const savedPartnerId = localStorage.getItem('heka_partner_id')
    const savedMemberRole = localStorage.getItem('heka_member_role')
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
      setRole(savedRole)
      if (savedPartnerId) setPartnerId(parseInt(savedPartnerId))
      if (savedMemberRole) setMemberRole(savedMemberRole)
    }
    setLoading(false)
  }, [])

  const signIn = async (email, password, selectedRole) => {
    try {
      // 1. Authentification via Xano
      const response = await fetch(`${XANO_AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Email ou mot de passe incorrect')

      const authToken = data.authToken

      // 2. Récupérer les infos utilisateur
      const meResponse = await fetch(`${XANO_AUTH_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      const meData = await meResponse.json()
      if (!meResponse.ok) throw new Error('Erreur récupération profil')

      // 3. Vérification du rôle via user_type dans cms_users
      const userType = meData.user_type || 'partner'

      if (selectedRole === 'admin' && userType !== 'admin') {
        return {
          success: false,
          error: 'Ce compte n\'est pas un compte administrateur. Connectez-vous en sélectionnant "Partenaire".',
        }
      }

      if (selectedRole === 'partner' && userType === 'admin') {
        return {
          success: false,
          error: 'Ce compte est un compte administrateur. Connectez-vous en sélectionnant "Admin".',
        }
      }

      // 4. Si partenaire, résoudre le membership via /me/partner_membership (Xano 6.2A)
      // Endpoint sécurisé bearer cms_users — ne renvoie que les memberships du token,
      // remplace l'ancien getAll('partner_members') + filtre client (lot 7).
      let selectedMember = null
      if (selectedRole === 'partner') {
        try {
          const membershipResp = await fetch(`${XANO_AUTH_URL}/me/partner_membership`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
          })
          if (membershipResp.ok) {
            const body = await membershipResp.json()
            const memberships = Array.isArray(body) ? body : []
            // Premier membership actif si le champ status existe, sinon premier tel quel.
            selectedMember = memberships.find(m => m.status === 'active') || memberships[0] || null
          }
        } catch (err) {
          console.error('Erreur lookup partner_membership:', err)
        }

        if (!selectedMember) {
          return {
            success: false,
            error: 'Ce compte n\'est associé à aucun espace partenaire. Contactez votre administrateur.',
          }
        }
      }

      // 5. Connexion validée
      const userData = {
        email: meData.email || email,
        name: meData.name || '',
        user_type: meData.user_type || selectedRole,
        is_first_login: meData.is_first_login || false,
      }

      localStorage.setItem('heka_auth_token', authToken)
      localStorage.setItem('heka_user', JSON.stringify(userData))
      localStorage.setItem('heka_role', selectedRole)

      setUser(userData)
      setRole(selectedRole)

      if (selectedRole === 'partner' && selectedMember) {
        setPartnerId(selectedMember.partner_id)
        setMemberRole(selectedMember.role)
        localStorage.setItem('heka_partner_id', selectedMember.partner_id)
        localStorage.setItem('heka_member_role', selectedMember.role)
      }

      return { success: true, is_first_login: userData.is_first_login }
    } catch (err) {
      console.error('Erreur login:', err)
      return { success: false, error: err.message || 'Email ou mot de passe incorrect' }
    }
  }

  const signOut = () => {
    localStorage.removeItem('heka_auth_token')
    localStorage.removeItem('heka_user')
    localStorage.removeItem('heka_role')
    localStorage.removeItem('heka_partner_id')
    localStorage.removeItem('heka_member_role')
    // Nettoyer les anciens tokens Directus si présents
    localStorage.removeItem('directus_token')
    localStorage.removeItem('directus_refresh_token')
    setUser(null); setRole(null); setPartnerId(null); setMemberRole(null)
  }

  const getAuthToken = () => localStorage.getItem('heka_auth_token')

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, role, partnerId, memberRole, signIn, signOut, getAuthToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
