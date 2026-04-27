import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import xanoApp from '../../lib/xanoApp'
import { SkeletonStats, SkeletonList, EmptyState, Toast, useToast } from '../../components/SharedUI'

const APP_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg']
const MAX_AUDIO_BYTES = 100 * 1024 * 1024

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
  const { toast, clearToast, showToast } = useToast()

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
  useEffect(() => {
    setColorChangePrompt(null)
    if (!drawerState) {
      setFormData({})
      return
    }
    if (drawerState.mode === 'create-subject') {
      setFormData({ status: 'draft', type: 'therapy' })
    } else if (drawerState.mode === 'edit-subject') {
      setFormData({ ...drawerState.data })
    } else if (drawerState.mode === 'create-session') {
      const parentSubject = subjects.find(s => s.id === drawerState.subjectId)
      setFormData({
        sessionSubjectId: drawerState.subjectId,
        type: parentSubject?.type || 'therapy',
        exerciseType: parentSubject?.exerciseType || '',
        colorTypo: parentSubject?.titleColor || '',
        status: 'draft',
        avlForFree: false,
      })
    } else if (drawerState.mode === 'edit-session') {
      setFormData({ ...drawerState.data })
    }
  }, [drawerState, subjects])

  // Escape closes drawer
  useEffect(() => {
    if (!drawerState) return
    const onKey = (e) => { if (e.key === 'Escape') setDrawerState(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerState])

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
              <EmptyState icon="📚" title="Aucun thème" message="Aucun thème créé pour l'instant" />
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
              <EmptyState icon="🎬" title="Aucune séance" message="Aucune séance dans ce thème pour l'instant" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedSessions.map((session, idx) => {
                  const meta = getSessionMeta(session.id)
                  const badge = statusBadge(session.status)
                  return (
                    <div
                      key={session.id}
                      onClick={() => setDrawerState({ mode: 'edit-session', data: session })}
                      className="rounded-xl p-3 cursor-pointer transition-all hover:shadow-md"
                      style={{ border: '1px solid #f4f5f7', backgroundColor: '#fafbfc' }}>
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
          saving={saving}
          colorChangePrompt={colorChangePrompt}
          onClose={() => setDrawerState(null)}
          onSave={handleSave}
          onSubjectChange={handleSubjectChange}
          onApplyNewThemeColors={applyNewThemeColors}
          onDismissColorPrompt={() => setColorChangePrompt(null)}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ─── Drawer ────────────────────────────────────────
function Drawer({
  drawerState, formData, setFormData, subjects, saving, colorChangePrompt,
  onClose, onSave, onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt, showToast,
}) {
  const isSubject = drawerState.mode === 'create-subject' || drawerState.mode === 'edit-subject'
  const isCreate = drawerState.mode.startsWith('create-')

  let breadcrumb, drawerTitle
  if (drawerState.mode === 'create-subject') {
    breadcrumb = 'Cocon · Thèmes'
    drawerTitle = 'Nouveau thème'
  } else if (drawerState.mode === 'edit-subject') {
    breadcrumb = `Cocon · Thèmes · ${drawerState.data.title || ''}`
    drawerTitle = 'Modifier le thème'
  } else if (drawerState.mode === 'create-session') {
    const parent = subjects.find(s => s.id === drawerState.subjectId)
    breadcrumb = `Cocon · ${parent?.title || ''} · Séances`
    drawerTitle = 'Nouvelle séance'
  } else {
    const parent = subjects.find(s => s.id === drawerState.data.sessionSubjectId)
    breadcrumb = `Cocon · ${parent?.title || ''} · Séances`
    drawerTitle = 'Modifier la séance'
  }

  const update = (patch) => setFormData({ ...formData, ...patch })

  const inputStyle = { backgroundColor: '#f4f5f7', border: '1px solid #eef0f2', color: '#1a2b4a' }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(26, 43, 74, 0.4)' }}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white z-50 flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f4f5f7' }}>
          <div>
            <p className="text-xs" style={{ color: '#8a93a2' }}>{breadcrumb}</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#1a2b4a' }}>{drawerTitle}</p>
          </div>
          <button onClick={onClose} className="text-xl px-2" style={{ color: '#8a93a2' }}>✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isSubject ? (
            <SubjectForm formData={formData} update={update} inputStyle={inputStyle} showToast={showToast} />
          ) : (
            <SessionForm
              formData={formData}
              update={update}
              subjects={subjects}
              inputStyle={inputStyle}
              colorChangePrompt={colorChangePrompt}
              onSubjectChange={onSubjectChange}
              onApplyNewThemeColors={onApplyNewThemeColors}
              onDismissColorPrompt={onDismissColorPrompt}
              isCreate={isCreate}
              showToast={showToast}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: '#f4f5f7' }}>
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
            {saving ? 'Enregistrement...' : 'Enregistrer'}
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
          label="Thumbnail"
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
  formData, update, subjects, inputStyle, colorChangePrompt,
  onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt, isCreate, showToast,
}) {
  const isTherapy = formData.type === 'therapy'
  const isExercise = formData.type === 'exercise'
  const isThinking = isExercise && formData.exerciseType === 'thinking'
  const isExerciseAudio = isExercise && !isThinking

  const showExerciseType = isExercise
  const showAiContext = isTherapy || isThinking
  const showPlayerImage = isExerciseAudio
  const showAudio = isExerciseAudio
  const showCutsInfo = isTherapy

  return (
    <div className="space-y-4">
      {showCutsInfo && (
        <div style={{
          backgroundColor: '#f4f5f7',
          color: '#8a93a2',
          fontSize: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
        }}>
          Les cuts vidéo de cette séance se gèreront dans la prochaine livraison (L3c).
        </div>
      )}

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
        <div className="grid grid-cols-3 gap-3">
          <ImageUpload
            label="Cover"
            value={formData.cover}
            onChange={(file) => update({ cover: file })}
            showToast={showToast}
          />
          <ImageUpload
            label="Thumbnail"
            value={formData.thumbNail}
            onChange={(file) => update({ thumbNail: file })}
            showToast={showToast}
          />
          {showPlayerImage && (
            <ImageUpload
              label="Player Image"
              value={formData.playerImage}
              onChange={(file) => update({ playerImage: file })}
              showToast={showToast}
            />
          )}
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
function ImageUpload({ label, value, onChange, showToast }) {
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
        className="w-full aspect-square rounded-xl flex items-center justify-center overflow-hidden transition-colors"
        style={{
          backgroundColor: '#f4f5f7',
          border: previewUrl ? '1px solid #eef0f2' : '2px dashed #d4d8df',
          maxWidth: '120px',
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
