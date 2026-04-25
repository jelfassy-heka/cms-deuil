// scripts/migrate-positions.js
// Script de migration : peuple le champ `position` sur les lignes existantes

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8'

async function request(method, path, body = null) {
  const url = `${XANO_BASE}${path}`
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  
  const res = await fetch(url, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function migrateSubjects() {
  console.log('\n📚 Migration des thèmes...')
  const subjects = await request('GET', '/admin-subjects')
  const sorted = (Array.isArray(subjects) ? subjects : subjects.items || [])
    .sort((a, b) => a.id - b.id)
  
  console.log(`   ${sorted.length} thèmes trouvés`)
  
  for (let i = 0; i < sorted.length; i++) {
    const subject = sorted[i]
    const newPosition = i + 1
    
    if (subject.position === newPosition) {
      console.log(`   ↳ #${subject.id} "${subject.title}" → déjà à la bonne position (${newPosition})`)
      continue
    }
    
    await request('PATCH', `/therapy_session_subjects/${subject.id}`, {
      position: newPosition,
      status: subject.status || 'published',
    })
    console.log(`   ✅ #${subject.id} "${subject.title}" → position ${newPosition}`)
  }
}

async function migrateSessions() {
  console.log('\n🎬 Migration des séances...')
  const sessions = await request('GET', '/admin-sessions')
  const allSessions = Array.isArray(sessions) ? sessions : sessions.items || []
  
  const grouped = {}
  for (const session of allSessions) {
    const subjectId = session.sessionSubjectId
    if (!grouped[subjectId]) grouped[subjectId] = []
    grouped[subjectId].push(session)
  }
  
  console.log(`   ${allSessions.length} séances trouvées dans ${Object.keys(grouped).length} thèmes`)
  
  for (const [subjectId, sessions] of Object.entries(grouped)) {
    const sorted = sessions.sort((a, b) => a.id - b.id)
    console.log(`\n   Thème #${subjectId} : ${sorted.length} séances`)
    
    for (let i = 0; i < sorted.length; i++) {
      const session = sorted[i]
      const newPosition = i + 1
      
      if (session.position === newPosition) {
        console.log(`   ↳ #${session.id} "${session.title}" → déjà à la bonne position (${newPosition})`)
        continue
      }
      
      await request('PATCH', `/therapy_sessions/${session.id}`, {
        position: newPosition,
        status: session.status || 'published',
      })
      console.log(`   ✅ #${session.id} "${session.title}" → position ${newPosition}`)
    }
  }
}

async function migrateVideos() {
  console.log('\n🎥 Migration des cuts vidéo...')
  const videos = await request('GET', '/admin-videos')
  const allVideos = Array.isArray(videos) ? videos : videos.items || []
  
  const grouped = {}
  for (const video of allVideos) {
    const sessionId = video.sessionId
    if (!grouped[sessionId]) grouped[sessionId] = []
    grouped[sessionId].push(video)
  }
  
  console.log(`   ${allVideos.length} cuts trouvés dans ${Object.keys(grouped).length} séances`)
  
  for (const [sessionId, videos] of Object.entries(grouped)) {
    const sorted = videos.sort((a, b) => a.id - b.id)
    console.log(`\n   Séance #${sessionId} : ${sorted.length} cuts`)
    
    for (let i = 0; i < sorted.length; i++) {
      const video = sorted[i]
      const newPosition = i + 1
      
      if (video.position === newPosition) {
        console.log(`   ↳ #${video.id} → déjà à la bonne position (${newPosition})`)
        continue
      }
      
      await request('PATCH', `/session_videos/${video.id}`, {
        position: newPosition,
      })
      console.log(`   ✅ #${video.id} → position ${newPosition}`)
    }
  }
}

async function main() {
  console.log('🚀 Migration des positions Cocon')
  console.log('================================')
  
  try {
    await migrateSubjects()
    await migrateSessions()
    await migrateVideos()
    
    console.log('\n✨ Migration terminée avec succès !')
  } catch (err) {
    console.error('\n❌ Erreur lors de la migration :', err.message)
    process.exit(1)
  }
}

main()