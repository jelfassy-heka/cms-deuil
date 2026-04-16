import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restaurer la session au chargement
useEffect(() => {
  const savedUser = localStorage.getItem('heka_user')
  const savedRole = localStorage.getItem('heka_role')
  const savedToken = localStorage.getItem('directus_token')
  if (savedUser && savedToken) {
    setUser(JSON.parse(savedUser))
    setRole(savedRole)
  }
  setLoading(false)

  // Refresh token toutes les 10 minutes
  const interval = setInterval(async () => {
    const token = localStorage.getItem('directus_token')
    if (token) await refreshSession()
  }, 10 * 60 * 1000)

  return () => clearInterval(interval)
}, [])
  const signIn = async (email, password, selectedRole) => {
    try {
      const response = await fetch('https://directus-production-b0c2.up.railway.app/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Erreur')
      
      const token = data.data.access_token
      const refreshToken = data.data.refresh_token
      const userData = { email, token }
      
      localStorage.setItem('directus_token', token)
      localStorage.setItem('directus_refresh_token', refreshToken)
      localStorage.setItem('heka_user', JSON.stringify(userData))
      localStorage.setItem('heka_role', selectedRole)
      
      setUser(userData)
      setRole(selectedRole)
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
      
      const response = await fetch('https://directus-production-b0c2.up.railway.app/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
      })
      const data = await response.json()
      if (!response.ok) return false
      
      const newToken = data.data.access_token
      const newRefreshToken = data.data.refresh_token
      
      localStorage.setItem('directus_token', newToken)
      localStorage.setItem('directus_refresh_token', newRefreshToken)
      
      setUser(prev => ({ ...prev, token: newToken }))
      return true
    } catch (err) {
      console.error('Erreur refresh:', err)
      return false
    }
  }

  const signOut = () => {
    localStorage.removeItem('directus_token')
    localStorage.removeItem('directus_refresh_token')
    localStorage.removeItem('heka_user')
    localStorage.removeItem('heka_role')
    setUser(null)
    setRole(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, role, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)