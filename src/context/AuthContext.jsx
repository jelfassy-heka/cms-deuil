import { createContext, useContext, useState, useEffect } from 'react'
import xano from '../lib/xano'

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

      // 3. Vérification du rôle — lookup partner_members
      let partnerMembers = []
      try {
        const allMembers = await xano.getAll('partner_members')
        partnerMembers = allMembers.filter(m => m.user_email === email)
      } catch (err) {
        console.error('Erreur lookup partner_members:', err)
      }

      const isPartnerMember = partnerMembers.length > 0

      if (selectedRole === 'partner' && !isPartnerMember) {
        return {
          success: false,
          error: 'Ce compte n\'est pas associé à un espace partenaire. Si vous êtes administrateur, connectez-vous en sélectionnant "Admin".',
        }
      }

      if (selectedRole === 'admin' && isPartnerMember) {
        return {
          success: false,
          error: 'Ce compte est associé à un espace partenaire. Connectez-vous en sélectionnant "Partenaire".',
        }
      }

      // 4. Connexion validée
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

      if (selectedRole === 'partner' && isPartnerMember) {
        const member = partnerMembers[0]
        setPartnerId(member.partner_id)
        setMemberRole(member.role)
        localStorage.setItem('heka_partner_id', member.partner_id)
        localStorage.setItem('heka_member_role', member.role)
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