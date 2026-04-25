import { useState, useEffect, useMemo } from 'react'
import xanoApp from '../../lib/xanoApp'
import { SkeletonStats, SkeletonList, EmptyState, Toast, useToast } from '../../components/SharedUI'

export default function Cocon() {
  const [subjects, setSubjects] = useState([])
  const [sessions, setSessions] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const { toast, clearToast, showToast } = useToast()

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [subj, sess, vid] = await Promise.all([
          xanoApp.getAll('admin-subjects'),
          xanoApp.getAll('admin-sessions'),
          xanoApp.getAll('admin-videos'),
        ])
        setSubjects(subj)
        setSessions(sess)
        setVideos(vid)
        if (subj.length > 0) {
          const sortedSubj = [...subj].sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id)
          setSelectedSubjectId(sortedSubj[0].id)
        }
      } catch (err) {
        showToast('Erreur chargement: ' + err.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
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
          disabled
          className="px-4 py-3 rounded-2xl text-sm font-semibold opacity-50 cursor-not-allowed"
          style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
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
                    className="cursor-pointer rounded-xl p-3 mb-2 transition-colors"
                    style={{
                      backgroundColor: isSelected ? (subject.backgroundColor || '#e8f8f7') : 'transparent',
                      border: isSelected ? 'none' : '1px solid #f4f5f7',
                    }}>
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
                disabled
                className="px-3 py-2 rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed"
                style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
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
    </div>
  )
}
