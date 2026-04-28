// Fonctions pures qui dérivent des métriques de l'espace Partenaire à partir
// des données déjà chargées. Aucune nouvelle donnée n'est inventée ici.

// ─── Codes & bénéficiaires ─────────────────────────
// Renvoie l'ensemble des codes assignés à un bénéficiaire (pour identifier
// les codes "envoyés" mais pas encore activés).
const buildAssignedCodeSet = (beneficiaries) =>
  new Set((beneficiaries || []).filter(b => b.code).map(b => b.code))

export const computeCodeStats = ({ codes = [], beneficiaries = [] } = {}) => {
  const assigned = buildAssignedCodeSet(beneficiaries)
  const used = codes.filter(c => c.used).length
  const sent = codes.filter(c => !c.used && assigned.has(c.code)).length
  const available = codes.length - used - sent
  const total = codes.length
  const activationRate = total > 0 ? Math.round((used / total) * 100) : 0
  return { used, sent, available, total, activationRate }
}

export const computeBeneficiariesWithoutCode = (beneficiaries = []) =>
  beneficiaries.filter(b => !b.code).length

// ─── Demandes ──────────────────────────────────────
export const computeOpenRequestsCount = (requests = []) =>
  requests.filter(r => r.request_status === 'pending' || r.request_status === 'in_progress').length

// ─── Funnel salariés (statut enrichi) ──────────────
// Reproduit la logique enrichedStatus historique de PartnerCodes :
//  - si le code du bénéficiaire a `used=true` côté codes → activated
//  - sinon, si status === 'sent' et email_opened_at présent → opened
//  - sinon le status d'origine (pending par défaut).
export const enrichBeneficiaries = ({ beneficiaries = [], codes = [] } = {}) => {
  return beneficiaries.map(b => {
    let status = b.status || 'pending'
    if (b.code && codes.find(c => c.code === b.code && c.used)) {
      status = 'activated'
    }
    if (status === 'sent' && b.email_opened_at) {
      status = 'opened'
    }
    return { ...b, enrichedStatus: status }
  })
}

export const countByEnrichedStatus = (enriched = []) => ({
  all: enriched.length,
  pending: enriched.filter(b => b.enrichedStatus === 'pending').length,
  sent: enriched.filter(b => b.enrichedStatus === 'sent').length,
  opened: enriched.filter(b => b.enrichedStatus === 'opened').length,
  activated: enriched.filter(b => b.enrichedStatus === 'activated').length,
})

// ─── Charts du dashboard ───────────────────────────
// Envois par semaine sur N semaines glissantes (calculés depuis `sent_at`).
export const computeSendChartData = (beneficiaries = [], weeks = 12) => {
  const now = new Date()
  const data = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000)
    const count = beneficiaries.filter(b =>
      b.sent_at && new Date(b.sent_at) >= weekStart && new Date(b.sent_at) < weekEnd
    ).length
    const label = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    data.push({ label, value: count })
  }
  return data
}

// Donut de répartition (couleurs et libellés conformes au lot 2).
export const computeDonutData = ({ codes = [], beneficiaries = [] } = {}) => {
  const stats = computeCodeStats({ codes, beneficiaries })
  return [
    { name: 'Disponibles', value: stats.available, color: '#2BBFB3' },
    { name: 'Envoyés', value: stats.sent, color: '#3b82f6' },
    { name: 'Activés', value: stats.used, color: '#1a2b4a' },
  ]
}

// ─── Équipe ────────────────────────────────────────
export const computeTeamStats = (members = []) => ({
  active: members.filter(m => m.status === 'active').length,
  pending: members.filter(m => m.status === 'pending').length,
  admins: members.filter(m => m.role === 'admin').length,
  members: members.filter(m => m.role === 'member').length,
})
