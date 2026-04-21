import { createContext, useContext, useState, useEffect } from 'react'
import xano from '../lib/xano'

const AuthContext = createContext(null)
const DIRECTUS_URL = 'https://directus-production-b0c2.up.railway.app'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [partnerId, setPartnerId] = useState(null)
  const [memberRole, setMemberRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('heka_user')
    const savedRole = localStorage.getItem('heka_role')
    const savedToken = localStorage.getItem('directus_token')
    const savedPartnerId = localStorage.getItem('heka_partner_id')
    const savedMemberRole = localStorage.getItem('heka_member_role')
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
      setRole(savedRole)
      if (savedPartnerId) setPartnerId(parseInt(savedPartnerId))
      if (savedMemberRole) setMemberRole(savedMemberRole)
    }
    setLoading(false)

    const interval = setInterval(async () => {
      const token = localStorage.getItem('directus_token')
      if (token) await refreshSession()
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const signIn = async (email, password, selectedRole) => {
    try {
      const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Erreur')

      const token = data.data.access_token
      const refreshToken = data.data.refresh_token

      // ─── Vérification du rôle ───────────────────
      // Chercher si cet email existe dans partner_members
      let partnerMembers = []
      try {
        partnerMembers = await xano.getAll('partner_members', { user_email: email })
      } catch (err) {
        console.error('Erreur lookup partner_members:', err)
      }

      const isPartnerMember = partnerMembers.length > 0

      // Si l'utilisateur sélectionne "Partenaire" mais n'a pas de compte partenaire
      if (selectedRole === 'partner' && !isPartnerMember) {
        return {
          success: false,
          error: 'Ce compte n\'est pas associé à un espace partenaire. Si vous êtes administrateur, connectez-vous en sélectionnant "Admin".',
        }
      }

      // Si l'utilisateur sélectionne "Admin" mais a un compte partenaire (et non admin)
      if (selectedRole === 'admin' && isPartnerMember) {
        return {
          success: false,
          error: 'Ce compte est associé à un espace partenaire. Connectez-vous en sélectionnant "Partenaire".',
        }
      }

      // ─── Connexion validée ──────────────────────
      const userData = { email, token }

      localStorage.setItem('directus_token', token)
      localStorage.setItem('directus_refresh_token', refreshToken)
      localStorage.setItem('heka_user', JSON.stringify(userData))
      localStorage.setItem('heka_role', selectedRole)

      setUser(userData)
      setRole(selectedRole)

      // Si partenaire, stocker les infos partenaire
      if (selectedRole === 'partner' && isPartnerMember) {
        const member = partnerMembers[0]
        setPartnerId(member.partner_id)
        setMemberRole(member.role)
        localStorage.setItem('heka_partner_id', member.partner_id)
        localStorage.setItem('heka_member_role', member.role)
      }

      return { success: true }
    } catch (err) {
      console.error('Erreur login:', err)
      return { success: false, error: 'Email ou mot de passe incorrect' }
    }
  }

  const refreshSession = async () => {
    try {
      const refreshToken = localStorage.getItem('directus_refresh_token')
      if (!refreshToken) return false
      const response = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
      })
      const data = await response.json()
      if (!response.ok) return false
      localStorage.setItem('directus_token', data.data.access_token)
      localStorage.setItem('directus_refresh_token', data.data.refresh_token)
      setUser(prev => ({ ...prev, token: data.data.access_token }))
      return true
    } catch (err) { console.error('Erreur refresh:', err); return false }
  }

  const signOut = () => {
    localStorage.removeItem('directus_token')
    localStorage.removeItem('directus_refresh_token')
    localStorage.removeItem('heka_user')
    localStorage.removeItem('heka_role')
    localStorage.removeItem('heka_partner_id')
    localStorage.removeItem('heka_member_role')
    setUser(null); setRole(null); setPartnerId(null); setMemberRole(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, role, partnerId, memberRole, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)