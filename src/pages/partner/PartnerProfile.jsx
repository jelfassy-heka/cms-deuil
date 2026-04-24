import { useState, useEffect } from 'react'
import xano from '../../lib/xano'
import { useAuth } from '../../context/AuthContext'
import { Toast, useToast } from '../../components/SharedUI'

const XANO_AUTH_URL = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

function PasswordInput({ value, onChange, placeholder = '••••••••' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-3 pr-12 rounded-2xl text-sm outline-none" style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#8a93a2' }} tabIndex={-1}>
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

const sendEmail = async (to_email, to_name, template_id, params) => {
  try {
    await fetch(`${XANO_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email, to_name, template_id, params: JSON.stringify(params) }),
    })
  } catch (err) { console.error('Erreur envoi email:', err) }
}

export default function PartnerProfile({ partnerId }) {
  const { user, memberRole, getAuthToken } = useAuth()
  const [partnerInfo, setPartnerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast, showToast, clearToast } = useToast()

  const isAdmin = memberRole === 'admin'

  const [form, setForm] = useState({
    name: '', email_contact: '', phone: '', partner_type: '',
    contact_firstname: '', contact_lastname: '', contact_role: '',
  })

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    const fetchPartner = async () => {
      try {
        const data = await xano.getOne('partners', partnerId)
        setPartnerInfo(data)
        setForm({
          name: data.name || '', email_contact: data.email_contact || '',
          phone: data.phone || '', partner_type: data.partner_type || 'entreprise',
          contact_firstname: data.contact_firstname || '',
          contact_lastname: data.contact_lastname || '',
          contact_role: data.contact_role || '',
        })
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    if (partnerId) fetchPartner()
  }, [partnerId])

  const handleSaveInfo = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email_contact) { showToast('Le nom et l\'email sont requis', 'warning'); return }
    setSaving(true)
    try {
      const updated = await xano.update('partners', partnerId, form)
      setPartnerInfo(updated)
      showToast('Informations mises à jour')
    } catch (err) { console.error(err); showToast('Erreur lors de la mise à jour', 'error') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { showToast('Tous les champs sont requis', 'warning'); return }
    if (pwForm.newPw.length < 8) { showToast('Le mot de passe doit contenir au moins 8 caractères', 'warning'); return }
    if (pwForm.newPw !== pwForm.confirm) { showToast('Les mots de passe ne correspondent pas', 'warning'); return }

    setPwSaving(true)
    try {
      const authToken = getAuthToken()
      const response = await fetch(`${XANO_AUTH_URL}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ old_password: pwForm.current, new_password: pwForm.newPw }),
      })

      if (!response.ok) {
        const err = await response.json()
        showToast(err.message || 'Mot de passe actuel incorrect', 'error')
        setPwSaving(false); return
      }

      // Envoyer l'email T#12 — Confirmation changement MDP
      const now = new Date()
      await sendEmail(user.email, user.name || user.email, 12, {
        EMAIL: user.email,
        DATE_HEURE: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      })

      setPwForm({ current: '', newPw: '', confirm: '' })
      showToast('Mot de passe modifié avec succès')
    } catch (err) { console.error(err); showToast('Erreur lors du changement de mot de passe', 'error') }
    finally { setPwSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{ color: '#8a93a2' }}>Chargement...</p></div>

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
          Gérez les informations de votre espace
          {!isAdmin && ' — seuls les administrateurs peuvent modifier les informations du partenaire'}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-6 flex items-center gap-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ backgroundColor: '#2BBFB3' }}>{partnerInfo?.name?.[0] || '?'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate" style={{ color: '#1a2b4a' }}>{partnerInfo?.name}</p>
          <p className="text-sm" style={{ color: '#8a93a2' }}>{partnerInfo?.partner_type || 'entreprise'} · {user.email} · {isAdmin ? 'Administrateur' : 'Membre'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="font-bold text-base mb-4" style={{ color: '#1a2b4a' }}>Informations de l'entreprise</h2>
          <form onSubmit={handleSaveInfo}>
            {[{key:'name',label:'Nom de l\'entreprise',required:true},{key:'email_contact',label:'Email de contact',type:'email',required:true},{key:'phone',label:'Téléphone',type:'tel'}].map(f=>(
              <div key={f.key} className="mb-4">
                <label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>{f.label}{f.required?' *':''}</label>
                <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} disabled={!isAdmin} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:isAdmin?'#f4f5f7':'#fafafa',color:'#1a2b4a',opacity:isAdmin?1:0.6}} />
              </div>
            ))}
            <div className="mb-4"><label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>Type</label><select value={form.partner_type} onChange={e=>setForm({...form,partner_type:e.target.value})} disabled={!isAdmin} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:isAdmin?'#f4f5f7':'#fafafa',color:'#1a2b4a'}}><option value="entreprise">Entreprise</option><option value="mutuelle">Mutuelle</option><option value="association">Association</option><option value="collectivité">Collectivité</option></select></div>
            <p className="text-xs font-semibold mb-3 mt-6" style={{color:'#8a93a2'}}>CONTACT PRINCIPAL</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="block text-xs font-semibold mb-1" style={{color:'#1a2b4a'}}>Prénom</label><input value={form.contact_firstname} onChange={e=>setForm({...form,contact_firstname:e.target.value})} disabled={!isAdmin} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}} /></div>
              <div><label className="block text-xs font-semibold mb-1" style={{color:'#1a2b4a'}}>Nom</label><input value={form.contact_lastname} onChange={e=>setForm({...form,contact_lastname:e.target.value})} disabled={!isAdmin} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}} /></div>
            </div>
            <div className="mb-4"><label className="block text-xs font-semibold mb-1" style={{color:'#1a2b4a'}}>Fonction</label><input value={form.contact_role} onChange={e=>setForm({...form,contact_role:e.target.value})} disabled={!isAdmin} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}} /></div>
            {isAdmin&&<button type="submit" disabled={saving} className="w-full py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:saving?'#8a93a2':'#2BBFB3'}}>{saving?'Enregistrement...':'Enregistrer les modifications'}</button>}
          </form>
        </div>

        <div>
          <div className="bg-white rounded-2xl p-5 md:p-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
            <h2 className="font-bold text-base mb-4" style={{color:'#1a2b4a'}}>Changer le mot de passe</h2>
            <form onSubmit={handleChangePassword}>
              <div className="mb-4"><label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>Mot de passe actuel</label><PasswordInput value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} /></div>
              <div className="mb-4"><label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>Nouveau mot de passe</label><PasswordInput value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} /><p className="text-xs mt-1" style={{color:'#8a93a2'}}>8 caractères minimum</p></div>
              <div className="mb-6"><label className="block text-sm font-semibold mb-1.5" style={{color:'#1a2b4a'}}>Confirmer</label><PasswordInput value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} />{pwForm.confirm&&pwForm.newPw!==pwForm.confirm&&<p className="text-xs mt-1" style={{color:'#ef4444'}}>Les mots de passe ne correspondent pas</p>}</div>
              <button type="submit" disabled={pwSaving} className="w-full py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:pwSaving?'#8a93a2':'#1a2b4a'}}>{pwSaving?'Modification...':'Modifier le mot de passe'}</button>
            </form>
          </div>
          <div className="rounded-2xl p-4 mt-4" style={{backgroundColor:'#f4f5f7'}}>
            <p className="text-xs font-semibold mb-2" style={{color:'#8a93a2'}}>INFORMATIONS DU COMPTE</p>
            <p className="text-sm" style={{color:'#1a2b4a'}}>Email : {user.email}</p>
            <p className="text-sm" style={{color:'#1a2b4a'}}>Rôle : {isAdmin ? 'Administrateur' : 'Membre'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}