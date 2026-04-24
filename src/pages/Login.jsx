import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

function PasswordInput({ value, onChange, placeholder = '••••••••', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 pr-12 rounded-2xl text-sm outline-none"
        style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ color: '#8a93a2' }}
        tabIndex={-1}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    const result = await signIn(email, password, role)
    setLoading(false)
    if (result.success) { navigate(role === 'admin' ? '/admin' : '/partner') }
    else { setError(result.error) }
  }

  const handleForgotPassword = async e => {
    e.preventDefault()
    if (!forgotEmail) { setForgotError('Veuillez saisir votre adresse email'); return }
    setForgotLoading(true); setForgotError('')
    try {
      const resp = await fetch(`${XANO_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      // On affiche toujours un succès pour ne pas révéler si l'email existe
      setForgotSuccess(true)
    } catch (err) {
      console.error(err)
      setForgotSuccess(true) // Même en cas d'erreur, on ne révèle rien
    }
    finally { setForgotLoading(false) }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6" style={{ background: 'linear-gradient(160deg, #e8f8f7 0%, #f4f5f7 60%)' }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/logo.png" alt="Héka" className="h-14 mx-auto mb-4 rounded-2xl" />
          <h1 className="text-xl font-bold" style={{ color: '#1a2b4a' }}>Espace de gestion</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Connectez-vous à votre espace</p>
        </div>

        <div className="flex rounded-2xl p-1 mb-6" style={{ backgroundColor: '#d8f3f1' }}>
          <button onClick={() => setRole('admin')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ backgroundColor: role === 'admin' ? '#2BBFB3' : 'transparent', color: role === 'admin' ? 'white' : '#8a93a2' }}>Admin</button>
          <button onClick={() => setRole('partner')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ backgroundColor: role === 'partner' ? '#2BBFB3' : 'transparent', color: role === 'partner' ? 'white' : '#8a93a2' }}>Partenaire</button>
        </div>

        <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.08)' }}>

          {/* ─── Formulaire mot de passe oublié ─── */}
          {showForgot ? (
            <div>
              <button onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotError('') }} className="text-sm font-medium mb-4 flex items-center gap-1" style={{ color: '#2BBFB3' }}>← Retour</button>

              {forgotSuccess ? (
                <div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8f8f7' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2BBFB3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-center mb-2" style={{ color: '#1a2b4a' }}>Email envoyé</h2>
                  <p className="text-sm text-center mb-6" style={{ color: '#8a93a2', lineHeight: '1.6' }}>
                    Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation dans quelques instants. Pensez à vérifier vos spams.
                  </p>
                  <button onClick={() => { setShowForgot(false); setForgotSuccess(false) }} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>Retour à la connexion</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <h2 className="text-lg font-bold mb-2" style={{ color: '#1a2b4a' }}>Mot de passe oublié</h2>
                  <p className="text-sm mb-6" style={{ color: '#8a93a2' }}>Saisissez l'email associé à votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.</p>

                  {forgotError && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{forgotError}</div>}

                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Email</label>
                    <input type="email" placeholder="votre@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
                  </div>

                  <button type="submit" disabled={forgotLoading} className="w-full py-4 rounded-2xl font-semibold text-white transition-all" style={{ backgroundColor: forgotLoading ? '#8a93a2' : '#2BBFB3' }}>
                    {forgotLoading ? 'Envoi en cours...' : 'Envoyer le lien →'}
                  </button>
                </form>
              )}
            </div>
          ) : (

            /* ─── Formulaire de connexion ─── */
            <form onSubmit={handleSubmit}>
              {error && <div className="rounded-2xl p-3 mb-4 text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{error}</div>}

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Email</label>
                <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
              </div>

              <div className="mb-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1a2b4a' }}>Mot de passe</label>
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              <div className="mb-6 text-right">
                <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email) }} className="text-xs font-medium" style={{ color: '#2BBFB3' }}>
                  Mot de passe oublié ?
                </button>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl font-semibold text-white transition-all" style={{ backgroundColor: loading ? '#8a93a2' : '#2BBFB3' }}>
                {loading ? 'Connexion...' : 'Se connecter →'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8a93a2' }}>Héka — Accompagnement du deuil</p>
      </div>
    </div>
  )
}