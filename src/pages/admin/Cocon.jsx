import { useState, useEffect, useMemo, useCallback } from 'react'
import xanoApp from '../../lib/xanoApp'
import { SkeletonStats, SkeletonList, EmptyState, Toast, useToast } from '../../components/SharedUI'

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
        color: parentSubject?.backgroundColor || '',
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
        const colorsMatchOldTheme =
          formData.color === oldSubject.backgroundColor &&
          formData.colorTypo === oldSubject.titleColor

        if (colorsMatchOldTheme) {
          setFormData(prev => ({
            ...prev,
            sessionSubjectId: newSubjectId,
            color: newSubject.backgroundColor,
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
      color: colorChangePrompt.newSubject.backgroundColor,
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

    setSaving(true)
    try {
      if (drawerState.mode === 'create-subject') {
        await xanoApp.post('admin-subject-create', {
          ...formData,
          position: subjects.length + 1,
        })
        showToast('Thème créé', 'success')
      } else if (drawerState.mode === 'edit-subject') {
        await xanoApp.patch('admin-subject-update', formData)
        showToast('Thème modifié', 'success')
      } else if (drawerState.mode === 'create-session') {
        const sessionsInSubject = sessions.filter(s => s.sessionSubjectId === formData.sessionSubjectId)
        await xanoApp.post('admin-session-create', {
          ...formData,
          position: sessionsInSubject.length + 1,
        })
        showToast('Séance créée', 'success')
      } else if (drawerState.mode === 'edit-session') {
        await xanoApp.patch('admin-session-update', formData)
        showToast('Séance modifiée', 'success')
      }

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
        />
      )}
    </div>
  )
}

// ─── Drawer ────────────────────────────────────────
function Drawer({
  drawerState, formData, setFormData, subjects, saving, colorChangePrompt,
  onClose, onSave, onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt,
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
            <SubjectForm formData={formData} update={update} inputStyle={inputStyle} />
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
function SubjectForm({ formData, update, inputStyle }) {
  const colorFields = [
    { key: 'backgroundColor', label: 'Couleur fond' },
    { key: 'titleColor', label: 'Couleur titre' },
    { key: 'borderColor', label: 'Couleur bordure' },
  ]

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type *">
          <select
            value={formData.type || 'therapy'}
            onChange={e => update({ type: e.target.value, exerciseType: e.target.value === 'therapy' ? '' : formData.exerciseType })}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}>
            <option value="therapy">Therapy</option>
            <option value="exercice">Exercice</option>
          </select>
        </Field>
        <Field label="Type d'exercice">
          <select
            value={formData.exerciseType || ''}
            onChange={e => update({ exerciseType: e.target.value })}
            disabled={formData.type !== 'exercice'}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={{ ...inputStyle, opacity: formData.type !== 'exercice' ? 0.5 : 1 }}>
            <option value="">—</option>
            <option value="meditation">Méditation</option>
            <option value="breathing">Respiration</option>
            <option value="visualization">Visualisation</option>
            <option value="sleep">Sommeil</option>
          </select>
        </Field>
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
  onSubjectChange, onApplyNewThemeColors, onDismissColorPrompt, isCreate,
}) {
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
            <option value="exercice">Exercice</option>
          </select>
        </Field>
      </div>

      <Field label="Type d'exercice">
        <select
          value={formData.exerciseType || ''}
          onChange={e => update({ exerciseType: e.target.value })}
          disabled={formData.type !== 'exercice'}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={{ ...inputStyle, opacity: formData.type !== 'exercice' ? 0.5 : 1 }}>
          <option value="">—</option>
          <option value="meditation">Méditation</option>
          <option value="breathing">Respiration</option>
          <option value="visualization">Visualisation</option>
          <option value="sleep">Sommeil</option>
        </select>
      </Field>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Couleurs</p>
        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="Couleur fond" value={formData.color} onChange={v => update({ color: v })} inputStyle={inputStyle} />
          <ColorInput label="Couleur typo" value={formData.colorTypo} onChange={v => update({ colorTypo: v })} inputStyle={inputStyle} />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: '#8a93a2' }}>Chatbot IA</p>
        <div className="space-y-3">
          <Field label="Question d'accroche">
            <textarea
              value={formData.aiQuestion || ''}
              onChange={e => update({ aiQuestion: e.target.value })}
              rows={2}
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
      </div>

      <label className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer" style={{ backgroundColor: '#f4f5f7' }}>
        <input
          type="checkbox"
          checked={formData.avlForFree || false}
          onChange={e => update({ avlForFree: e.target.checked })}
        />
        <span className="text-sm flex-1" style={{ color: '#1a2b4a' }}>Disponible en gratuit</span>
      </label>

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
