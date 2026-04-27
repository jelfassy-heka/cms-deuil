import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import xanoApp from '../../lib/xanoApp'
import { SkeletonStats, SkeletonList, EmptyState, Toast, useToast, useConfirm } from '../../components/SharedUI'

const APP_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'
const AUTH_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg']
const MAX_AUDIO_BYTES = 100 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime']
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

const EXCLUDED_PAYLOAD_KEYS = new Set(['color', 'aiQuestion'])

export default function Cocon() {
  const [subjects, setSubjects] = useState([])
  const [sessions, setSessions] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [drawerState, setDrawerState] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [colorChangePrompt, setColorChangePrompt] = useState(null)
  const [cutToDelete, setCutToDelete] = useState(null)
  const [deletingCut, setDeletingCut] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const { toast, clearToast, showToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()

  const fetchAll = useCallback(async () => {
    const [subj, sess, vid] = await Promise.all([
      xanoApp.getAll('admin-subjects'),
      xanoApp.getAll('admin-sessions'),
      xanoApp.getAll('admin-videos'),
    ])
    setSubjects(subj)
    setSessions(sess)
    setVideos(vid)
    return { subj, sess, vid }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { subj } = await fetchAll()
        if (subj.length > 0 && selectedSubjectId === null) {
          const sortedSubj = [...subj].sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id)
          setSelectedSubjectId(sortedSubj[0].id)
        }
      } catch (err) {
        showToast('Erreur chargement: ' + err.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id)
  }, [subjects])

  const selectedSessions = useMemo(() => {
    return sessions
      .filter(s => s.sessionSubjectId === selectedSubjectId)
      .sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id)
  }, [sessions, selectedSubjectId])

  const stats = useMemo(() => ({
    subjects: subjects.length,
    sessions: sessions.length,
    videos: videos.length,
  }), [subjects, sessions, videos])

  const getSessionMeta = (sessionId) => {
    const cuts = videos.filter(v => v.sessionId === sessionId)
    const totalMin = cuts.reduce((sum, c) => sum + (parseFloat(c.durationMin) || 0), 0)
    return { cutsCount: cuts.length, totalMin: Math.round(totalMin) }
  }

  const statusBadge = (status) => {
    const config = {
      published: { bg: '#1D9E75', label: 'Published' },
      review: { bg: '#BA7517', label: 'Review' },
      draft: { bg: '#888780', label: 'Draft' },
    }
    return config[status] || config.draft
  }

  // ─── Drawer lifecycle ────────────────────────────
  const lastInitializedDrawerRef = useRef(null)
  const initialFormDataRef = useRef({})
  useEffect(() => {
    setColorChangePrompt(null)
    if (!drawerState) {
      lastInitializedDrawerRef.current = null
      initialFormDataRef.current = {}
      setFormData({})
      return
    }
    if (lastInitializedDrawerRef.current === drawerState) return
    lastInitializedDrawerRef.current = drawerState
    const setInitial = (value) => {
      initialFormDataRef.current = value
      setFormData(value)
    }
    if (drawerState._restoredFormData) {
      setInitial(drawerState._restoredFormData)
      return
    }
    if (drawerState.mode === 'create-subject') {
      setInitial({ status: 'draft', type: 'therapy' })
    } else if (drawerState.mode === 'edit-subject') {
      setInitial({ ...drawerState.data })
    } else if (drawerState.mode === 'create-session') {
      const parentSubject = subjects.find(s => s.id === drawerState.subjectId)
      setInitial({
        sessionSubjectId: drawerState.subjectId,
        type: parentSubject?.type || 'therapy',
        exerciseType: parentSubject?.exerciseType || '',
        colorTypo: parentSubject?.titleColor || '',
        status: 'draft',
        avlForFree: false,
      })
    } else if (drawerState.mode === 'edit-session') {
      setInitial({ ...drawerState.data })
    } else if (drawerState.mode === 'create-cut') {
      const existingCuts = videos.filter(v => v.sessionId === drawerState.parentSession.id)
      const newPosition = existingCuts.length > 0
        ? Math.max(...existingCuts.map(c => c.position)) + 1
        : 1
      setInitial({
        sessionId: drawerState.parentSession.id,
        position: newPosition,
      })
    } else if (drawerState.mode === 'edit-cut') {
      setInitial({ ...drawerState.data })
    }
  }, [drawerState, subjects, videos])

  const isCutMode = drawerState?.mode === 'create-cut' || drawerState?.mode === 'edit-cut'

  const closeCutDrawer = useCallback(async () => {
    if (!drawerState) return
    const { parentSessionMode, parentSession, parentSessionFormData } = drawerState
    await fetchAll()
    setDrawerState({
      mode: parentSessionMode,
      data: parentSession,
      _restoredFormData: parentSessionFormData,
    })
  }, [drawerState, fetchAll])

  const handleCloseDrawer = useCallback(async () => {
    if (isFormDirty(formData, initialFormDataRef.current)) {
      const ok = await confirm(
        'Modifications non sauvegardées',
        'Vos modifications seront perdues. Continuer ?',
        { confirmLabel: 'Quitter', confirmColor: '#DC2626' }
      )
      if (!ok) return
    }
    if (isCutMode) {
      closeCutDrawer()
    } else {
      setDrawerState(null)
    }
  }, [isCutMode, closeCutDrawer, formData, confirm])

  // Escape closes drawer (returns to session if in cut mode)
  useEffect(() => {
    if (!drawerState) return
    const onKey = (e) => { if (e.key === 'Escape') handleCloseDrawer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerState, handleCloseDrawer])

  const openCutDrawer = (mode, cut = null) => {
    if (!drawerState) return
    setDrawerState({
      mode: mode === 'create' ? 'create-cut' : 'edit-cut',
      data: cut,
      parentSession: drawerState.data,
      parentSessionFormData: { ...formData },
      parentSessionMode: drawerState.mode,
    })
  }

  const handleMoveCut = async (cut, direction) => {
    const sortedCuts = videos
      .filter(v => v.sessionId === cut.sessionId)
      .sort((a, b) => a.position - b.position)
    const idx = sortedCuts.findIndex(c => c.id === cut.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedCuts.length) return
    const swapCut = sortedCuts[swapIdx]
    try {
      await xanoApp.patch('admin-cut-update', { id: cut.id, position: swapCut.position })
      await xanoApp.patch('admin-cut-update', { id: swapCut.id, position: cut.position })
      await fetchAll()
    } catch (err) {
      showToast('Erreur lors du réordonnancement: ' + err.message, 'error')
    }
  }

  const handleDeleteCut = async (cut) => {
    setDeletingCut(true)
    try {
      await xanoApp.post('admin-cut-delete', { id: cut.id })
      const cutsToDecrement = videos
        .filter(v => v.sessionId === cut.sessionId && v.position > cut.position)
        .sort((a, b) => a.position - b.position)
      for (const c of cutsToDecrement) {
        await xanoApp.patch('admin-cut-update', { id: c.id, position: c.position - 1 })
      }
      await fetchAll()
      showToast('Cut supprimé', 'success')
      setCutToDelete(null)
    } catch (err) {
      showToast('Erreur lors de la suppression: ' + err.message, 'error')
      setCutToDelete(null)
    } finally {
      setDeletingCut(false)
    }
  }

  const handleDeleteSession = async (password) => {
    const authToken = localStorage.getItem('heka_auth_token')
    const verifyResp = await fetch(`${AUTH_BASE}/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ password }),
    })
    if (!verifyResp.ok) {
      const err = new Error('Mot de passe incorrect')
      err.code = 'INVALID_PASSWORD'
      throw err
    }

    const res = await fetch(`${APP_BASE}/admin-session-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionToDelete.id }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Suppression échouée : ${res.status}${text ? ' — ' + text : ''}`)
    }

    showToast('Séance supprimée', 'success')
    const deletedId = sessionToDelete.id
    setSessionToDelete(null)
    if (drawerState?.mode === 'edit-session' && drawerState.data.id === deletedId) {
      setDrawerState(null)
    }
    await fetchAll()
  }

  const handleSubjectChange = (newSubjectId) => {
    const oldSubjectId = formData.sessionSubjectId

    if (drawerState?.mode === 'edit-session' && newSubjectId !== oldSubjectId) {
      const oldSubject = subjects.find(s => s.id === oldSubjectId)
      const newSubject = subjects.find(s => s.id === newSubjectId)

      if (oldSubject && newSubject) {
        const colorsMatchOldTheme = formData.colorTypo === oldSubject.titleColor

        if (colorsMatchOldTheme) {
          setFormData(prev => ({
            ...prev,
            sessionSubjectId: newSubjectId,
            colorTypo: newSubject.titleColor,
          }))
          setColorChangePrompt(null)
          return
        } else {
          setColorChangePrompt({ oldSubject, newSubject })
        }
      }
    }
    setFormData(prev => ({ ...prev, sessionSubjectId: newSubjectId }))
  }

  const applyNewThemeColors = () => {
    setFormData(prev => ({
      ...prev,
      colorTypo: colorChangePrompt.newSubject.titleColor,
    }))
    setColorChangePrompt(null)
  }

  const handleSave = async () => {
    if (drawerState.mode === 'create-cut' || drawerState.mode === 'edit-cut') {
      if (drawerState.mode === 'create-cut' && !(formData.video instanceof File)) {
        showToast('Une vidéo est obligatoire pour créer un cut', 'error')
        return
      }
      const fd = new FormData()
      if (drawerState.mode === 'create-cut') {
        fd.append('video', formData.video)
        fd.append('sessionId', String(formData.sessionId))
        fd.append('position', String(formData.position))
      } else {
        fd.append('id', String(formData.id))
        if (formData.video instanceof File) fd.append('video', formData.video)
      }
      if (formData.durationMin != null && formData.durationMin !== '') {
        fd.append('durationMin', String(formData.durationMin))
      }
      if (formData.aiQuestion) fd.append('aiQuestion', formData.aiQuestion)
      if (formData.videoScript) fd.append('videoScript', formData.videoScript)
      if (formData.aiContext) fd.append('aiContext', formData.aiContext)

      const endpoint = drawerState.mode === 'create-cut' ? 'admin-cut-create' : 'admin-cut-update'
      const method = drawerState.mode === 'create-cut' ? 'POST' : 'PATCH'

      setSaving(true)
      try {
        const res = await fetch(`${APP_BASE}/${endpoint}`, { method, body: fd })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`${res.status} ${res.statusText}${text ? ' — ' + text : ''}`)
        }
        await closeCutDrawer()
      } catch (err) {
        const msg = drawerState.mode === 'create-cut'
          ? 'Erreur lors de la création du cut: '
          : 'Erreur lors de la modification du cut: '
        showToast(msg + err.message, 'error')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!formData.title?.trim()) {
      showToast('Le titre est obligatoire', 'error')
      return
    }
    const isSession = drawerState.mode === 'create-session' || drawerState.mode === 'edit-session'
    if (isSession && !formData.sessionSubjectId) {
      showToast('Le thème parent est obligatoire', 'error')
      return
    }

    if (drawerState.mode === 'edit-session') {
      const original = drawerState.data
      const typeChanged = formData.type !== original.type
      const exerciseTypeChanged = formData.exerciseType !== original.exerciseType

      if (typeChanged || exerciseTypeChanged) {
        if (original.type === 'therapy' && formData.type === 'exercise') {
          const cutsCount = videos.filter(v => v.sessionId === original.id).length
          if (cutsCount > 0) {
            showToast(`Cette séance a ${cutsCount} cut(s) vidéo. Supprimez-les manuellement dans Xano avant de changer le type.`, 'error')
            return
          }
        }

        if (original.type === 'exercise' && formData.type === 'therapy' && original.exerciseSoundtrack) {
          showToast('Cette séance a un audio. Supprimez-le manuellement dans Xano avant de changer le type.', 'error')
          return
        }

        if (
          original.type === 'exercise' &&
          original.exerciseType !== 'thinking' &&
          formData.exerciseType === 'thinking' &&
          original.exerciseSoundtrack
        ) {
          showToast('Cette séance a un audio. Supprimez-le manuellement dans Xano avant de passer en thinking.', 'error')
          return
        }
      }
    }

    let endpoint, method, payload, successMsg
    if (drawerState.mode === 'create-subject') {
      endpoint = 'admin-subject-create'
      method = 'POST'
      payload = { ...formData, position: subjects.length + 1 }
      successMsg = 'Thème créé'
    } else if (drawerState.mode === 'edit-subject') {
      endpoint = 'admin-subject-update'
      method = 'POST'
      payload = formData
      successMsg = 'Thème modifié'
    } else if (drawerState.mode === 'create-session') {
      const sessionsInSubject = sessions.filter(s => s.sessionSubjectId === formData.sessionSubjectId)
      endpoint = 'admin-session-create'
      method = 'POST'
      payload = { ...formData, position: sessionsInSubject.length + 1 }
      successMsg = 'Séance créée'
    } else {
      endpoint = 'admin-session-update'
      method = 'PATCH'
      payload = formData
      successMsg = 'Séance modifiée'
    }

    const body = buildFormData(payload)

    setSaving(true)
    try {
      const res = await fetch(`${APP_BASE}/${endpoint}`, { method, body })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`${res.status} ${res.statusText}${text ? ' — ' + text : ''}`)
      }
      showToast(successMsg, 'success')
      setDrawerState(null)
      await fetchAll()
    } catch (err) {
      showToast('Erreur: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <SkeletonStats count={3} />
        <SkeletonList count={6} />
      </div>
    )
  }

  const selectedSubject = sortedSubjects.find(s => s.id === selectedSubjectId)

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Cocon — Gestion du contenu</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>
            {stats.subjects} thème{stats.subjects > 1 ? 's' : ''} · {stats.sessions} séance{stats.sessions > 1 ? 's' : ''} · {stats.videos} cut{stats.videos > 1 ? 's' : ''} vidéo
          </p>
        </div>
        <button
          onClick={() => setDrawerState({ mode: 'create-subject' })}
          className="px-4 py-3 rounded-2xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#2BBFB3' }}>
          + Nouveau thème
        </button>
      </div>

      {/* Layout 2 colonnes */}
      <div className="flex flex-col md:flex-row gap-4">

        {/* Colonne thèmes */}
        <div className="md:w-60 flex-shrink-0">
          <div className="bg-white rounded-2xl p-3" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xs uppercase tracking-wider font-semibold mb-2 px-1" style={{ color: '#8a93a2' }}>Thèmes</p>

            {sortedSubjects.length === 0 ? (
              <EmptyState
                icon="📚"
                title="Aucun thème"
                message="Créez votre premier thème pour commencer."
                actionLabel="+ Créer le premier thème"
                onAction={() => setDrawerState({ mode: 'create-subject' })}
              />
            ) : (
              sortedSubjects.map((subject, idx) => {
                const sessionsCount = sessions.filter(s => s.sessionSubjectId === subject.id).length
                const isSelected = selectedSubjectId === subject.id
                return (
                  <div
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className="group relative cursor-pointer rounded-xl p-3 mb-2 transition-colors"
                    style={{
                      backgroundColor: isSelected ? (subject.backgroundColor || '#e8f8f7') : 'transparent',
                      border: isSelected ? 'none' : '1px solid #f4f5f7',
                    }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDrawerState({ mode: 'edit-subject', data: subject }) }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: '#1a2b4a', fontSize: '12px' }}
                      title="Modifier le thème">
                      ✏️
                    </button>
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded-full font-semibold mb-1"
                      style={{
                        backgroundColor: isSelected ? 'rgba(0,0,0,0.15)' : '#f4f5f7',
                        color: isSelected ? (subject.titleColor || '#1a2b4a') : '#8a93a2',
                      }}>
                      Thème {idx + 1}
                    </span>
                    <p className="text-sm font-semibold leading-tight" style={{ color: isSelected ? (subject.titleColor || '#1a2b4a') : '#1a2b4a' }}>
                      {subject.title}
                    </p>
                    <p className="text-xs mt-1" style={{ color: isSelected ? (subject.titleColor || '#8a93a2') : '#8a93a2', opacity: isSelected ? 0.8 : 1 }}>
                      {sessionsCount} séance{sessionsCount > 1 ? 's' : ''}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Colonne séances */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#8a93a2' }}>
                Séances · {selectedSubject?.title || ''}
              </p>
              <button
                onClick={() => selectedSubjectId && setDrawerState({ mode: 'create-session', subjectId: selectedSubjectId })}
                disabled={!selectedSubjectId}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ backgroundColor: '#2BBFB3', opacity: !selectedSubjectId ? 0.5 : 1, cursor: !selectedSubjectId ? 'not-allowed' : 'pointer' }}>
                + Nouvelle séance
              </button>
            </div>

            {selectedSessions.length === 0 ? (
              <EmptyState
                icon="🎬"
                title="Aucune séance"
                message="Ce thème ne contient aucune séance. Créez la première."
                actionLabel="+ Créer la première séance"
                onAction={() => selectedSubjectId && setDrawerState({ mode: 'create-session', subjectId: selectedSubjectId })}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedSessions.map((session, idx) => {
                  const meta = getSessionMeta(session.id)
                  const badge = statusBadge(session.status)
                  return (
                    <div
                      key={session.id}
                      onClick={() => setDrawerState({ mode: 'edit-session', data: session })}
                      className="relative group rounded-xl p-3 cursor-pointer transition-all hover:shadow-md"
                      style={{ border: '1px solid #f4f5f7', backgroundColor: '#fafbfc' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(session) }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md"
                        style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#DC2626', fontSize: '12px' }}
                        title="Supprimer la séance">
                        🗑️
                      </button>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
                          Séance {idx + 1}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: badge.bg }}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-tight mb-2" style={{ color: '#1a2b4a' }}>
                        {session.title}
                      </p>
                      <p className="text-xs" style={{ color: '#8a93a2' }}>
                        {meta.cutsCount} cut{meta.cutsCount > 1 ? 's' : ''} · {meta.totalMin} min · {session.type || '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Drawer */}
      {drawerState && (
        <Drawer
          drawerState={drawerState}
          formData={formData}
          setFormData={setFormData}
          subjects={sortedSubjects}
          videos={videos}
          saving={saving}
          colorChangePrompt={colorChangePrompt}
          onClose={handleCloseDrawer}
          onSave={handleSave}
          onSubjectChange={handleSubjectChange}
          onApplyNewThemeColors={applyNewThemeColors}
          onDismissColorPrompt={() => setColorChangePrompt(null)}
          showToast={showToast}
          onOpenCutDrawer={openCutDrawer}
          onMoveCut={handleMoveCut}
          onRequestDeleteCut={setCutToDelete}
          onRequestDeleteSession={setSessionToDelete}
        />
      )}

      {/* Delete cut confirmation modal */}
      {cutToDelete && (
        <DeleteCutModal
          cut={cutToDelete}
          loading={deletingCut}
          onCancel={() => !deletingCut && setCutToDelete(null)}
          onConfirm={() => handleDeleteCut(cutToDelete)}
        />
      )}

      {/* Delete session confirmation modal */}
      {sessionToDelete && (
        <DeleteSessionModal
          session={sessionToDelete}
          cutsCount={videos.filter(v => v.sessionId === sessionToDelete.id).length}
          onCancel={() => setSessionToDelete(null)}
          onConfirm={handleDeleteSession}
        />
      )}

      {ConfirmDialog}
    </div>
  )
}

// ─── Drawer ────────────────────────────────────────
function Drawer({
  drawerState, formData, setFormData, subjects, videos, saving, colorChangePrompt,
  onClose, onSave, onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt, showToast,
  onOpenCutDrawer, onMoveCut, onRequestDeleteCut, onRequestDeleteSession,
}) {
  const isSubject = drawerState.mode === 'create-subject' || drawerState.mode === 'edit-subject'
  const isCut = drawerState.mode === 'create-cut' || drawerState.mode === 'edit-cut'
  const isCreate = drawerState.mode.startsWith('create-')

  let breadcrumb, drawerTitle
  if (drawerState.mode === 'create-subject') {
    breadcrumb = 'Thèmes'
    drawerTitle = 'Nouveau thème'
  } else if (drawerState.mode === 'edit-subject') {
    breadcrumb = `Thèmes · ${drawerState.data.title || ''}`
    drawerTitle = 'Modifier le thème'
  } else if (drawerState.mode === 'create-session') {
    const parent = subjects.find(s => s.id === drawerState.subjectId)
    breadcrumb = `${parent?.title || ''}`
    drawerTitle = 'Nouvelle séance'
  } else if (drawerState.mode === 'edit-session') {
    const parent = subjects.find(s => s.id === drawerState.data.sessionSubjectId)
    breadcrumb = `${parent?.title || ''}`
    drawerTitle = 'Modifier la séance'
  } else {
    // Cut modes
    const parentSession = drawerState.parentSession
    breadcrumb = `${parentSession?.title || ''}`
    drawerTitle = drawerState.mode === 'create-cut'
      ? 'Nouveau cut'
      : `Cut #${formData.position || ''}`
  }

  const update = (patch) => setFormData({ ...formData, ...patch })

  const inputStyle = { backgroundColor: '#f4f5f7', border: '1px solid #eef0f2', color: '#1a2b4a' }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200 ease-out"
        style={{ backgroundColor: 'rgba(26, 43, 74, 0.4)', opacity: mounted ? 1 : 0 }}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full md:w-[460px] bg-white z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '0.5px solid #eef0f2' }}>
          <div>
            <p className="text-xs" style={{ color: '#8a93a2' }}>{breadcrumb}</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#1a2b4a' }}>{drawerTitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {drawerState.mode === 'edit-session' && (
              <button
                onClick={() => onRequestDeleteSession(drawerState.data)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: '#DC2626' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                title="Supprimer la séance">
                🗑️
              </button>
            )}
            <button onClick={onClose} className="text-xl px-2" style={{ color: '#8a93a2' }} title="Fermer">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isCut ? (
            <CutForm
              formData={formData}
              update={update}
              inputStyle={inputStyle}
              showToast={showToast}
              isCreate={drawerState.mode === 'create-cut'}
            />
          ) : isSubject ? (
            <SubjectForm formData={formData} update={update} inputStyle={inputStyle} showToast={showToast} />
          ) : (
            <SessionForm
              formData={formData}
              update={update}
              subjects={subjects}
              videos={videos}
              inputStyle={inputStyle}
              colorChangePrompt={colorChangePrompt}
              onSubjectChange={onSubjectChange}
              onApplyNewThemeColors={onApplyNewThemeColors}
              onDismissColorPrompt={onDismissColorPrompt}
              isCreate={isCreate}
              showToast={showToast}
              onOpenCutDrawer={onOpenCutDrawer}
              onMoveCut={onMoveCut}
              onRequestDeleteCut={onRequestDeleteCut}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '0.5px solid #eef0f2' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-[2] px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#2BBFB3', opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner color="white" />
                Enregistrement...
              </span>
            ) : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── SubjectForm ──────────────────────────────────
function SubjectForm({ formData, update, inputStyle, showToast }) {
  const colorFields = [
    { key: 'backgroundColor', label: 'Couleur fond' },
    { key: 'titleColor', label: 'Couleur titre' },
    { key: 'borderColor', label: 'Couleur bordure' },
  ]

  const isTherapy = formData.type === 'therapy'
  const isExercise = formData.type === 'exercise'
  const isMeditation = isExercise && formData.exerciseType === 'meditation'

  const showTheme = isTherapy || isMeditation
  const showExerciseType = isExercise

  return (
    <div className="space-y-4">
      <Field label="Titre *">
        <input
          type="text"
          value={formData.title || ''}
          onChange={e => update({ title: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={formData.description || ''}
          onChange={e => update({ description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
          style={inputStyle}
        />
      </Field>

      {showTheme && (
        <Field label="Module">
          <input
            type="text"
            value={formData.theme || ''}
            placeholder="Ex: Thème 1, Phase 2..."
            onChange={e => update({ theme: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </Field>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Image</p>
        <ImageUpload
          label="Thumbnail (21:9)"
          aspectRatio="21 / 9"
          maxWidth="100%"
          value={formData.thumbnail}
          onChange={(file) => update({ thumbnail: file })}
          showToast={showToast}
        />
      </div>

      <div className={showExerciseType ? 'grid grid-cols-2 gap-3' : ''}>
        <Field label="Type *">
          <select
            value={formData.type || 'therapy'}
            onChange={e => update({ type: e.target.value, exerciseType: e.target.value === 'therapy' ? '' : formData.exerciseType })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}>
            <option value="therapy">Therapy</option>
            <option value="exercise">Exercice</option>
          </select>
        </Field>
        {showExerciseType && (
          <Field label="Type d'exercice">
            <select
              value={formData.exerciseType || ''}
              onChange={e => update({ exerciseType: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={inputStyle}>
              <option value="">—</option>
              <option value="meditation">Méditation</option>
              <option value="breathing">Respiration</option>
              <option value="visualization">Visualisation</option>
              <option value="sleep">Sommeil</option>
            </select>
          </Field>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Couleurs</p>
        <div className="grid grid-cols-2 gap-3">
          {colorFields.map(c => (
            <ColorInput
              key={c.key}
              label={c.label}
              value={formData[c.key]}
              onChange={v => update({ [c.key]: v })}
              inputStyle={inputStyle}
            />
          ))}
        </div>
      </div>

      <Field label="Statut *">
        <select
          value={formData.status || 'draft'}
          onChange={e => update({ status: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={inputStyle}>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
        </select>
      </Field>
    </div>
  )
}

// ─── SessionForm ──────────────────────────────────
function SessionForm({
  formData, update, subjects, videos, inputStyle, colorChangePrompt,
  onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt, isCreate, showToast,
  onOpenCutDrawer, onMoveCut, onRequestDeleteCut,
}) {
  const isTherapy = formData.type === 'therapy'
  const isExercise = formData.type === 'exercise'
  const isThinking = isExercise && formData.exerciseType === 'thinking'
  const isExerciseAudio = isExercise && !isThinking

  const showExerciseType = isExercise
  const showAiContext = isTherapy || isThinking
  const showPlayerImage = isExerciseAudio
  const showAudio = isExerciseAudio

  const sessionCuts = formData.id
    ? videos.filter(v => v.sessionId === formData.id).sort((a, b) => a.position - b.position)
    : []
  const canAddCut = !!formData.id && sessionCuts.length < 4

  return (
    <div className="space-y-4">
      <Field label="Titre *">
        <input
          type="text"
          value={formData.title || ''}
          onChange={e => update({ title: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={formData.description || ''}
          onChange={e => update({ description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
          style={inputStyle}
        />
      </Field>

      <Field label="Thème parent *">
        <select
          value={formData.sessionSubjectId || ''}
          onChange={e => onSubjectChange(parseInt(e.target.value))}
          disabled={isCreate}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={{ ...inputStyle, opacity: isCreate ? 0.7 : 1 }}>
          <option value="">— Sélectionner —</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </Field>

      {colorChangePrompt && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#9A3412' }}>⚠️ Vous avez changé de thème</p>
          <p className="text-xs mb-3" style={{ color: '#C2410C' }}>
            Voulez-vous appliquer les couleurs du nouveau thème ({colorChangePrompt.newSubject.title}) à cette séance ?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onApplyNewThemeColors}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: '#9A3412' }}>
              Oui, appliquer
            </button>
            <button
              onClick={onDismissColorPrompt}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: 'white', color: '#9A3412', border: '1px solid #FED7AA' }}>
              Non, garder
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Auteur">
          <input
            type="text"
            value={formData.author || ''}
            onChange={e => update({ author: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="Type *">
          <select
            value={formData.type || 'therapy'}
            onChange={e => update({ type: e.target.value, exerciseType: e.target.value === 'therapy' ? '' : formData.exerciseType })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}>
            <option value="therapy">Therapy</option>
            <option value="exercise">Exercice</option>
          </select>
        </Field>
      </div>

      {showExerciseType && (
        <Field label="Type d'exercice">
          <select
            value={formData.exerciseType || ''}
            onChange={e => update({ exerciseType: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}>
            <option value="">—</option>
            <option value="meditation">Méditation</option>
            <option value="breathing">Respiration</option>
            <option value="visualization">Visualisation</option>
            <option value="sleep">Sommeil</option>
            <option value="thinking">Thinking</option>
          </select>
        </Field>
      )}

      <Field label="Statut *">
        <select
          value={formData.status || 'draft'}
          onChange={e => update({ status: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={inputStyle}>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
        </select>
      </Field>

      <label className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer" style={{ backgroundColor: '#f4f5f7' }}>
        <input
          type="checkbox"
          checked={formData.avlForFree || false}
          onChange={e => update({ avlForFree: e.target.checked })}
        />
        <span className="text-sm flex-1" style={{ color: '#1a2b4a' }}>Disponible en gratuit</span>
      </label>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Couleurs</p>
        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="Couleur typo" value={formData.colorTypo} onChange={v => update({ colorTypo: v })} inputStyle={inputStyle} />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Images</p>
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: showPlayerImage ? 1 : 'none', maxWidth: '220px' }}>
              <ImageUpload
                label="Cover (1:2)"
                aspectRatio="1 / 2"
                maxWidth="100%"
                value={formData.cover}
                onChange={(file) => update({ cover: file })}
                showToast={showToast}
              />
            </div>
            {showPlayerImage && (
              <div style={{ flex: 1, maxWidth: '200px' }}>
                <ImageUpload
                  label="Lecteur (9:19.5)"
                  aspectRatio="9 / 19.5"
                  maxWidth="100%"
                  value={formData.playerImage}
                  onChange={(file) => update({ playerImage: file })}
                  showToast={showToast}
                />
              </div>
            )}
          </div>
          <div>
            <ImageUpload
              label="Thumbnail (21:9)"
              aspectRatio="21 / 9"
              maxWidth="100%"
              value={formData.thumbNail}
              onChange={(file) => update({ thumbNail: file })}
              showToast={showToast}
            />
          </div>
        </div>
      </div>

      {showAudio && (
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Audio</p>
          <AudioUpload
            label="Audio de la séance"
            value={formData.exerciseSoundtrack}
            onChange={(file) => update({ exerciseSoundtrack: file })}
            showToast={showToast}
          />
        </div>
      )}

      {isTherapy && (
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>
            Cuts vidéo ({sessionCuts.length}/4)
          </p>
          <div className="space-y-2">
            {sessionCuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-3 rounded-xl" style={{ backgroundColor: '#fafbfc', border: '1px dashed #eef0f2' }}>
                <span className="text-2xl mb-1" style={{ opacity: 0.5 }}>🎬</span>
                <p className="text-xs text-center" style={{ color: '#8a93a2' }}>
                  Aucun cut vidéo. Cliquez sur « + Ajouter un cut » pour en créer un.
                </p>
              </div>
            ) : (
              sessionCuts.map((cut, idx) => (
                <CutListItem
                  key={cut.id}
                  cut={cut}
                  position={idx + 1}
                  isFirst={idx === 0}
                  isLast={idx === sessionCuts.length - 1}
                  onMoveUp={() => onMoveCut(cut, 'up')}
                  onMoveDown={() => onMoveCut(cut, 'down')}
                  onEdit={() => onOpenCutDrawer('edit', cut)}
                  onDelete={() => onRequestDeleteCut(cut)}
                />
              ))
            )}
          </div>
          {!formData.id && (
            <p className="text-xs mt-2" style={{ color: '#8a93a2' }}>
              Sauvegardez d'abord la séance pour pouvoir ajouter des cuts.
            </p>
          )}
          <button
            type="button"
            onClick={() => onOpenCutDrawer('create')}
            disabled={!canAddCut}
            className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: canAddCut ? '#2BBFB3' : '#f4f5f7',
              color: canAddCut ? 'white' : '#8a93a2',
              cursor: canAddCut ? 'pointer' : 'not-allowed',
            }}>
            + Ajouter un cut
          </button>
        </div>
      )}

      {showAiContext && (
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Chatbot IA</p>
          <Field label="Contexte IA">
            <textarea
              value={formData.aiContext || ''}
              onChange={e => update({ aiContext: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
              style={inputStyle}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</label>
      {children}
    </div>
  )
}

function ColorInput({ label, value, onChange, inputStyle }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</label>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: value || '#ffffff', border: '1px solid #eef0f2' }}
        />
        <input
          type="text"
          value={value || ''}
          placeholder="#000000"
          onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-mono"
          style={inputStyle}
        />
      </div>
    </div>
  )
}

// ─── ImageUpload ──────────────────────────────────
function ImageUpload({ label, value, onChange, showToast, aspectRatio = '1 / 1', maxWidth = '120px' }) {
  const inputRef = useRef(null)
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [value])

  const previewUrl = objectUrl || (value && typeof value === 'object' && value.url) || null

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast('Format invalide (JPEG, PNG ou WebP attendu)', 'error')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Taille max 5 Mo', 'error')
      return
    }
    onChange(file)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</label>
      <button
        type="button"
        onClick={openPicker}
        className="w-full rounded-xl flex items-center justify-center overflow-hidden transition-colors"
        style={{
          backgroundColor: '#f4f5f7',
          border: previewUrl ? '1px solid #eef0f2' : '2px dashed #d4d8df',
          maxWidth: maxWidth,
          aspectRatio: aspectRatio,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef0f2' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f4f5f7' }}
        title={previewUrl ? 'Cliquer pour remplacer' : 'Ajouter une image'}>
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl leading-none" style={{ color: '#8a93a2' }}>+</span>
            <span className="text-[10px] text-center px-1" style={{ color: '#8a93a2' }}>Ajouter une image</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        hidden
      />
    </div>
  )
}

// ─── AudioUpload ──────────────────────────────────
function AudioUpload({ label, value, onChange, showToast }) {
  const inputRef = useRef(null)
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [value])

  const audioUrl = objectUrl || (value && typeof value === 'object' && value.url) || null
  const isNewFile = value instanceof File

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      showToast('Format invalide, audio mp3/m4a/wav/ogg uniquement', 'error')
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      showToast('Taille max 100 Mo', 'error')
      return
    }
    onChange(file)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</label>
      {audioUrl ? (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {isNewFile && (
              <span className="text-xs" style={{ color: '#BA7517' }}>
                Nouveau fichier — sauvegardez pour confirmer
              </span>
            )}
            <button
              type="button"
              onClick={openPicker}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
              Remplacer l'audio
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="w-full px-4 py-6 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
          style={{
            backgroundColor: '#f4f5f7',
            border: '2px dashed #d4d8df',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef0f2' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f4f5f7' }}
          title="Ajouter un audio">
          <span className="text-2xl leading-none" style={{ color: '#8a93a2' }}>♪</span>
          <span className="text-xs" style={{ color: '#8a93a2' }}>Ajouter un audio</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg"
        onChange={handleFile}
        hidden
      />
    </div>
  )
}

// ─── VideoUpload ──────────────────────────────────
function VideoUpload({ label, value, onChange, showToast }) {
  const inputRef = useRef(null)
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [value])

  const videoUrl = objectUrl || (value && typeof value === 'object' && value.url) || null
  const isNewFile = value instanceof File

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      showToast('Format invalide, vidéo mp4/mov uniquement', 'error')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      showToast('Taille max 200 Mo', 'error')
      return
    }
    onChange(file)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</label>
      {videoUrl ? (
        <div className="space-y-2">
          <video controls src={videoUrl} className="w-full max-h-[300px] rounded-lg" style={{ backgroundColor: '#000' }} />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {isNewFile && (
              <span className="text-xs" style={{ color: '#BA7517' }}>
                Nouveau fichier — sauvegardez pour confirmer
              </span>
            )}
            <button
              type="button"
              onClick={openPicker}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', border: '1px solid #eef0f2' }}>
              Remplacer la vidéo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="w-full px-4 py-6 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
          style={{
            backgroundColor: '#f4f5f7',
            border: '2px dashed #d4d8df',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef0f2' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f4f5f7' }}
          title="Ajouter une vidéo">
          <span className="text-2xl leading-none" style={{ color: '#8a93a2' }}>▶</span>
          <span className="text-xs" style={{ color: '#8a93a2' }}>Ajouter une vidéo</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        onChange={handleFile}
        hidden
      />
    </div>
  )
}

// ─── CutListItem ──────────────────────────────────
function CutListItem({ cut, position, isFirst, isLast, onMoveUp, onMoveDown, onEdit, onDelete }) {
  const fileName = cut.video?.name || 'Sans nom'
  const duration = cut.durationMin ? `${cut.durationMin} min` : '—'

  const btnStyle = (disabled) => ({
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    backgroundColor: 'white',
    border: '1px solid #eef0f2',
    color: disabled ? '#d4d8df' : '#1a2b4a',
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: '#f4f5f7' }}>
      <span className="text-xs font-bold flex-shrink-0" style={{ color: '#1a2b4a', minWidth: '24px' }}>
        #{position}
      </span>
      <span
        className="text-sm flex-1 truncate"
        style={{ color: '#1a2b4a' }}
        title={fileName}>
        {fileName}
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: '#8a93a2' }}>{duration}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button type="button" onClick={onMoveUp} disabled={isFirst} style={btnStyle(isFirst)} title="Monter">↑</button>
        <button type="button" onClick={onMoveDown} disabled={isLast} style={btnStyle(isLast)} title="Descendre">↓</button>
        <button type="button" onClick={onEdit} style={btnStyle(false)} title="Modifier">✏️</button>
        <button type="button" onClick={onDelete} style={btnStyle(false)} title="Supprimer">🗑️</button>
      </div>
    </div>
  )
}

// ─── CutForm ──────────────────────────────────────
function CutForm({ formData, update, inputStyle, showToast }) {
  return (
    <div className="space-y-4">
      <VideoUpload
        label="Vidéo *"
        value={formData.video}
        onChange={(file) => update({ video: file })}
        showToast={showToast}
      />

      <Field label="Durée (minutes)">
        <input
          type="number"
          step="0.5"
          min="0"
          value={formData.durationMin ?? ''}
          onChange={e => update({ durationMin: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        />
      </Field>

      <Field label="Question d'accroche IA">
        <textarea
          value={formData.aiQuestion || ''}
          onChange={e => update({ aiQuestion: e.target.value })}
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
          style={inputStyle}
        />
      </Field>

      <Field label="Script vidéo">
        <textarea
          value={formData.videoScript || ''}
          onChange={e => update({ videoScript: e.target.value })}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
          style={inputStyle}
        />
      </Field>

      <Field label="Contexte IA">
        <textarea
          value={formData.aiContext || ''}
          onChange={e => update({ aiContext: e.target.value })}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
          style={inputStyle}
        />
      </Field>
    </div>
  )
}

// ─── DeleteCutModal ───────────────────────────────
function DeleteCutModal({ onCancel, onConfirm, loading }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div
        onClick={loading ? undefined : onCancel}
        className="fixed inset-0 z-[60] transition-opacity duration-150"
        style={{ backgroundColor: 'rgba(26, 43, 74, 0.5)', opacity: mounted ? 1 : 0 }}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] bg-white rounded-2xl p-5 w-[90%] max-w-md transition-opacity duration-150"
        style={{ transform: 'translate(-50%, -50%)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', opacity: mounted ? 1 : 0 }}>
        <p className="text-base font-semibold mb-2" style={{ color: '#1a2b4a' }}>Supprimer ce cut ?</p>
        <p className="text-sm mb-5" style={{ color: '#8a93a2' }}>
          Cette action est irréversible. Le fichier vidéo associé sera également supprimé.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#DC2626', opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? (<><Spinner color="white" /> Suppression...</>) : 'Supprimer'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── DeleteSessionModal ───────────────────────────
function DeleteSessionModal({ session, cutsCount, onCancel, onConfirm }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleConfirm = async () => {
    if (!password) {
      setError('Saisissez votre mot de passe')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onConfirm(password)
    } catch (err) {
      if (err?.code === 'INVALID_PASSWORD') {
        setError('Mot de passe incorrect')
      } else {
        setError(err?.message || 'Erreur lors de la suppression')
      }
      setLoading(false)
    }
  }

  return (
    <>
      <div
        onClick={loading ? undefined : onCancel}
        className="fixed inset-0 z-[60] transition-opacity duration-150"
        style={{ backgroundColor: 'rgba(26, 43, 74, 0.5)', opacity: mounted ? 1 : 0 }}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] bg-white rounded-2xl p-5 w-[90%] max-w-md transition-opacity duration-150"
        style={{ transform: 'translate(-50%, -50%)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', opacity: mounted ? 1 : 0 }}>
        <p className="text-base font-semibold mb-2" style={{ color: '#DC2626' }}>
          Supprimer cette séance ?
        </p>
        <p className="text-sm mb-4" style={{ color: '#8a93a2' }}>
          La séance « <span style={{ color: '#1a2b4a', fontWeight: 600 }}>{session?.title}</span> »
          {cutsCount > 0 ? `, ses ${cutsCount} cut${cutsCount > 1 ? 's' : ''} vidéo` : ''}
          {' '}et tous les fichiers associés seront définitivement supprimés.
          <br />
          <span style={{ color: '#DC2626', fontWeight: 500 }}>Cette action est irréversible.</span>
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: '#8a93a2' }}>
          Mot de passe admin
        </label>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) handleConfirm() }}
          placeholder="Votre mot de passe..."
          autoFocus
          disabled={loading}
          className="w-full px-3 py-2.5 rounded-xl text-sm mb-1"
          style={{ backgroundColor: '#f4f5f7', border: error ? '1px solid #DC2626' : '1px solid #eef0f2', color: '#1a2b4a' }}
        />
        {error ? (
          <p className="text-xs mb-3" style={{ color: '#DC2626' }}>{error}</p>
        ) : (
          <div className="mb-4" />
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !password}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#DC2626', opacity: (loading || !password) ? 0.6 : 1, cursor: (loading || !password) ? 'not-allowed' : 'pointer' }}>
            {loading ? (<><Spinner color="white" /> Suppression...</>) : 'Supprimer'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Spinner ──────────────────────────────────────
function Spinner({ size = 14, color = 'currentColor' }) {
  return (
    <span
      className="inline-block animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
      }}
    />
  )
}

// ─── Dirty form detection ─────────────────────────
function isFormDirty(current, initial) {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(initial || {})])
  for (const k of keys) {
    const c = current?.[k]
    const i = initial?.[k]
    if (c instanceof File) return true
    if (typeof c === 'object' && typeof i === 'object' && c !== null && i !== null) {
      if (c === i) continue
      return true
    }
    const cNorm = (c === null || c === undefined) ? '' : c
    const iNorm = (i === null || i === undefined) ? '' : i
    if (cNorm !== iNorm) return true
  }
  return false
}

// ─── FormData builder ─────────────────────────────
function buildFormData(payload) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (EXCLUDED_PAYLOAD_KEYS.has(key)) continue
    if (value === undefined || value === null) continue
    if (value instanceof File) {
      fd.append(key, value)
    } else if (typeof value === 'object') {
      // Existing image object {url, ...} — never re-send. Skip.
      continue
    } else if (typeof value === 'string') {
      if (value === '') continue
      fd.append(key, value)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      fd.append(key, String(value))
    }
  }
  return fd
}
