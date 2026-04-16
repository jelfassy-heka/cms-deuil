import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email, password, role)
    setLoading(false)
    if (result.success) {
      if (role === 'admin') navigate('/admin')
      else navigate('/partner')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6"
      style={{ background: 'linear-gradient(160deg, #e8f8f7 0%, #f4f5f7 60%)' }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/logo.png" alt="Héka" className="h-14 mx-auto mb-4 rounded-2xl" />
          <h1 className="text-xl font-bold" style={{ color: '#1a2b4a' }}>
            Espace de gestion
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
            Connectez-vous à votre espace
          </p>
        </div>

        <div className="flex rounded-2xl p-1 mb-6" style={{ backgroundColor: '#d8f3f1' }}>
          <button onClick={() => setRole('admin')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: role === 'admin' ? '#2BBFB3' : 'transparent',
              color: role === 'admin' ? 'white' : '#8a93a2'
            }}>
            Admin
          </button>
          <button onClick={() => setRole('partner')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: role === 'partner' ? '#2BBFB3' : 'transparent',
              color: role === 'partner' ? 'white' : '#8a93a2'
            }}>
            Partenaire
          </button>
        </div>

        <div className="bg-white rounded-3xl p-8"
          style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.08)' }}>
          <form onSubmit={handleSubmit}>

            {error && (
              <div className="rounded-2xl p-3 mb-4 text-sm"
                style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Email
              </label>
              <input type="email" placeholder="votre@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>
                Mot de passe
              </label>
              <input type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl font-semibold text-white transition-all"
              style={{ backgroundColor: loading ? '#8a93a2' : '#2BBFB3' }}>
              {loading ? 'Connexion...' : 'Se connecter →'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8a93a2' }}>
          Héka — Accompagnement du deuil
        </p>
      </div>
    </div>
  )
}