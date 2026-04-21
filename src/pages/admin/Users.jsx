import { useState, useEffect, useMemo } from 'react'
import { SearchInput, SkeletonStats, SkeletonList, Pagination, usePagination, useDebounce, exportToCSV } from '../../components/SharedUI'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const debouncedSearch = useDebounce(search)

  useEffect(() => { const c=()=>setIsMobile(window.innerWidth<768); c(); window.addEventListener('resize',c); return()=>window.removeEventListener('resize',c) }, [])

  useEffect(() => {
    const fetchUsers = async () => {
      try { const r = await fetch(`${XANO_BASE}/users`); const d = await r.json(); setUsers(Array.isArray(d) ? d : d.items || []) }
      catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!debouncedSearch) return users
    const s = debouncedSearch.toLowerCase()
    return users.filter(u => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(s))
  }, [users, debouncedSearch])

  const { paginated, page, totalPages, setPage, total } = usePagination(filteredUsers, 25)

  const stats = { total: users.length, hommes: users.filter(u => u.gender === 'Masculin').length, femmes: users.filter(u => u.gender === 'Féminin').length, nonPrecise: users.filter(u => u.gender === 'Pas précisé' || !u.gender).length }

  const selectUser = u => { setSelectedUser(u); if (isMobile) setShowDetail(true) }

  if (loading) return <div><SkeletonStats count={4} /><SkeletonList count={5} /></div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3">
        <div><h1 className="text-xl md:text-2xl font-bold" style={{color:'#1a2b4a'}}>Utilisateurs</h1><p className="text-sm mt-1" style={{color:'#8a93a2'}}>Données depuis Xano</p></div>
        <button onClick={()=>exportToCSV(users,'utilisateurs',[{key:'firstName',label:'Prénom'},{key:'lastName',label:'Nom'},{key:'email',label:'Email'},{key:'gender',label:'Genre'}])} className="px-4 py-3 rounded-2xl text-sm font-semibold" style={{backgroundColor:'#f4f5f7',color:'#1a2b4a'}}>📥 Exporter CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[{label:'Total',value:stats.total,color:'#2BBFB3'},{label:'Hommes',value:stats.hommes,color:'#1a2b4a'},{label:'Femmes',value:stats.femmes,color:'#d97706'},{label:'Non précisé',value:stats.nonPrecise,color:'#8a93a2'}].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-4 md:p-5" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><p className="text-xl md:text-2xl font-bold mb-1" style={{color:s.color}}>{s.value}</p><p className="text-xs md:text-sm" style={{color:'#8a93a2'}}>{s.label}</p></div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className={`flex-1 ${isMobile && showDetail ? 'hidden' : ''}`}>
          <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher un utilisateur..." /></div>
          <div className="flex flex-col gap-2">
            {paginated.map(u=>(
              <div key={u.id} onClick={()=>selectUser(u)} className="bg-white rounded-2xl px-4 md:px-5 py-3 md:py-4 flex items-center justify-between cursor-pointer" style={{boxShadow:selectedUser?.id===u.id?'0 0 0 2px #2BBFB3':'0 2px 8px rgba(0,0,0,0.04)'}}>
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{backgroundColor:'#2BBFB3'}}>{u.firstName?.[0]||u.email?.[0]||'?'}</div><div><p className="font-semibold text-sm" style={{color:'#1a2b4a'}}>{u.firstName} {u.lastName}</p><p className="text-xs" style={{color:'#8a93a2'}}>{u.email}</p></div></div>
                <span className="text-xs px-2 py-1 rounded-lg" style={{backgroundColor:'#e8f8f7',color:'#2BBFB3'}}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
            {paginated.length===0&&<p className="text-sm text-center py-8" style={{color:'#8a93a2'}}>Aucun utilisateur trouvé</p>}
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>

        <div className={`${isMobile ? 'w-full' : 'w-80'} flex-shrink-0 ${isMobile && !showDetail ? 'hidden' : ''}`}>
          {isMobile && showDetail && <button onClick={()=>setShowDetail(false)} className="mb-4 text-sm font-medium flex items-center gap-2" style={{color:'#2BBFB3'}}>← Retour</button>}
          {selectedUser ? (
            <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 sticky top-4" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}>
              <div className="text-center mb-6"><div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-3" style={{backgroundColor:'#2BBFB3'}}>{selectedUser.firstName?.[0]||'?'}</div><h2 className="font-bold" style={{color:'#1a2b4a'}}>{selectedUser.firstName} {selectedUser.lastName}</h2><p className="text-sm" style={{color:'#8a93a2'}}>{selectedUser.email}</p></div>
              <div className="flex flex-col gap-3">{[{label:'Inscrit le',value:new Date(selectedUser.created_at).toLocaleDateString('fr-FR')},{label:'Genre',value:selectedUser.gender||'Non précisé'},{label:'ID',value:`#${selectedUser.id}`}].map(i=><div key={i.label} className="rounded-2xl p-3" style={{backgroundColor:'#f4f5f7'}}><p className="text-xs font-semibold mb-0.5" style={{color:'#8a93a2'}}>{i.label.toUpperCase()}</p><p className="text-sm font-medium" style={{color:'#1a2b4a'}}>{i.value}</p></div>)}</div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center" style={{boxShadow:'0 4px 24px rgba(43,191,179,0.06)'}}><span className="text-3xl">👤</span><p className="font-semibold mt-3" style={{color:'#1a2b4a'}}>Sélectionnez un utilisateur</p><p className="text-sm mt-1" style={{color:'#8a93a2'}}>pour voir son profil</p></div>
          )}
        </div>
      </div>
    </div>
  )
}