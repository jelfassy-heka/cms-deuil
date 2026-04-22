import { useState, useEffect, useMemo } from 'react'
import xano from '../../lib/xano'
import { Toast, useToast, useConfirm, SearchInput, SkeletonStats, SkeletonList, useDebounce } from '../../components/SharedUI'

const XANO_AUTH_URL = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'
const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
const roleLabels = { admin:{label:'Admin',bg:'#e8f0fe',text:'#1a2b4a'}, member:{label:'Membre',bg:'#f4f5f7',text:'#8a93a2'} }

const sendEmail = async (to_email, to_name, template_id, params) => {
  try {
    await fetch(`${XANO_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email, to_name, template_id, params: JSON.stringify(params) }),
    })
  } catch (err) { console.error('Erreur envoi email:', err) }
}

export default function AdminAccounts() {
  const [partners, setPartners] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email:'',password:'',partner_id:'',role:'admin',name:'' })
  const { toast, showToast, clearToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    Promise.all([xano.getAll('partners'), xano.getAll('partner_members')]).then(([p,m])=>{setPartners(p);setMembers(m)}).catch(console.error).finally(()=>setLoading(false))
  }, [])

  const getPartnerName = id => partners.find(x=>x.id===parseInt(id))?.name||'Inconnu'

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.email||!form.password||!form.partner_id) { showToast('Tous les champs sont requis','warning'); return }
    if (form.password.length<6) { showToast('Mot de passe : 6 caractères minimum','warning'); return }
    setCreating(true)
    try {
      // 1. Créer l'utilisateur via Xano auth
      const signupResp = await fetch(`${XANO_AUTH_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email, password: form.password,
          name: form.name || form.email.split('@')[0],
          user_type: 'partner', is_first_login: true,
        }),
      })
      if (!signupResp.ok) {
        const err = await signupResp.json()
        const msg = err.message || ''
        showToast(msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('exist') ? 'Cet email existe déjà' : 'Erreur lors de la création du compte', 'error')
        setCreating(false); return
      }

      // 2. Créer l'entrée partner_members
      const partnerName = getPartnerName(form.partner_id)
      const newMember = await xano.create('partner_members', {
        partner_id: parseInt(form.partner_id), user_email: form.email,
        role: form.role, invited_by: JSON.parse(localStorage.getItem('heka_user')).email, status: 'active',
      })

      // 3. Envoyer l'email T#10 — Bienvenue partenaire
      await sendEmail(form.email, form.name || form.email, 10, {
        PARTNER_NAME: partnerName,
        EMAIL: form.email,
        TEMP_PASSWORD: form.password,
        LOGIN_URL: 'https://cms-deuil.vercel.app',
      })

      setMembers([...members, newMember])
      showToast(`Compte créé pour ${form.email} — email envoyé`)
      setForm({ email:'', password:'', partner_id:'', role:'admin', name:'' }); setShowCreateForm(false)
    } catch(err) { console.error(err); showToast('Erreur','error') }
    finally { setCreating(false) }
  }

  const handleRemove = async memberId => {
    const ok = await confirm('Retirer cet accès','L\'utilisateur ne pourra plus se connecter à l\'espace partenaire.',{confirmLabel:'Retirer'})
    if (!ok) return
    try { await xano.remove('partner_members',memberId); setMembers(members.filter(m=>m.id!==memberId)); showToast('Accès retiré') } catch(err) { console.error(err) }
  }

  const filteredMembers = useMemo(() => {
    if (!debouncedSearch) return members
    const s = debouncedSearch.toLowerCase()
    return members.filter(m=>`${m.user_email} ${getPartnerName(m.partner_id)}`.toLowerCase().includes(s))
  }, [members, debouncedSearch, partners])

  const membersByPartner = {}
  filteredMembers.forEach(m => { const name=getPartnerName(m.partner_id); (membersByPartner[name]=membersByPartner[name]||[]).push(m) })

  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={3} /></div>

  return (
    <div>
      {ConfirmDialog}
      <Toast toast={toast} onClose={clearToast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3"><div><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Gestion des accès</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>{members.length} compte{members.length>1?'s':''}</p></div><button onClick={()=>setShowCreateForm(!showCreateForm)} className="px-5 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:'#2BBFB3'}}>+ Créer un accès</button></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[{label:'Total',value:members.length,color:'#1a2b4a'},{label:'Admins',value:members.filter(m=>m.role==='admin').length,color:'#2BBFB3'},{label:'Membres',value:members.filter(m=>m.role==='member').length,color:'#8a93a2'},{label:'Partenaires liés',value:new Set(members.map(m=>m.partner_id)).size,color:'#d97706'}].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-4" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><p className="text-xl font-bold mb-1" style={{color:s.color}}>{s.value}</p><p className="text-xs" style={{color:'#8a93a2'}}>{s.label}</p></div>
        ))}
      </div>

      {showCreateForm&&(
        <div className="bg-white rounded-2xl p-5 md:p-8 mb-6" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.08)'}}>
          <h2 className="font-bold text-lg mb-6" style={{color:'#1a2b4a'}}>Nouveau compte partenaire</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Nom *</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Prénom Nom" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div>
              <div><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Email *</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@entreprise.com" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /></div>
              <div><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Mot de passe temporaire *</label><input type="text" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min. 6 caractères" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}} /><p className="text-xs mt-1" style={{color:'#8a93a2'}}>Le partenaire devra le changer à la première connexion</p></div>
              <div><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Partenaire *</label><select value={form.partner_id} onChange={e=>setForm({...form,partner_id:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="">Sélectionner...</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-2" style={{color:'#1a2b4a'}}>Rôle</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{backgroundColor:'#f4f5f7'}}><option value="admin">Administrateur</option><option value="member">Membre</option></select></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3"><button type="submit" disabled={creating} className="px-6 py-3 rounded-2xl text-white text-sm font-semibold" style={{backgroundColor:creating?'#8a93a2':'#2BBFB3'}}>{creating?'Création...':'Créer le compte →'}</button><button type="button" onClick={()=>setShowCreateForm(false)} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>Annuler</button></div>
          </form>
        </div>
      )}

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher par email ou partenaire..." /></div>

      {Object.keys(membersByPartner).length===0?(
        <div className="bg-white rounded-3xl p-12 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-4xl">🔐</span><p className="font-bold text-lg mt-4" style={{color:'#1a2b4a'}}>{search?'Aucun résultat':'Aucun accès'}</p></div>
      ):(
        <div className="flex flex-col gap-6">{Object.entries(membersByPartner).map(([name,mems])=>(
          <div key={name}>
            <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor:'#2BBFB3'}}>{name[0]}</div><p className="text-sm font-semibold" style={{color:'#1a2b4a'}}>{name}</p><span className="text-xs px-2 py-0.5 rounded-md" style={{backgroundColor:'#f4f5f7',color:'#8a93a2'}}>{mems.length}</span></div>
            <div className="flex flex-col gap-2">{mems.map(m=>{const r=roleLabels[m.role]||roleLabels.member;return(
              <div key={m.id} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                <div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs" style={{backgroundColor:m.role==='admin'?'#1a2b4a':'#8a93a2'}}>{m.user_email?.[0]?.toUpperCase()}</div><div className="min-w-0"><p className="text-sm font-semibold truncate" style={{color:'#1a2b4a'}}>{m.user_email}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{backgroundColor:r.bg,color:r.text}}>{r.label}</span><span className="text-xs px-2 py-0.5 rounded-lg" style={{backgroundColor:m.status==='active'?'#e8f8f7':'#fef3c7',color:m.status==='active'?'#2BBFB3':'#d97706'}}>{m.status==='active'?'Actif':'En attente'}</span></div></div></div>
                <button onClick={()=>handleRemove(m.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style={{backgroundColor:'#fee2e2',color:'#ef4444'}}>×</button>
              </div>
            )})}</div>
          </div>
        ))}</div>
      )}
    </div>
  )
}