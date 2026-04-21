import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import xano from '../../lib/xano'
import { SkeletonList } from '../../components/SharedUI'

const PERIOD_OPTIONS = [
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '12m', label: '12 mois', days: 365 },
]

const COLORS = {
  teal: '#2BBFB3',
  navy: '#1a2b4a',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#d1d5db',
  blue: '#3b82f6',
}

// ─── Helpers ──────────────────────────────────────
function groupByPeriod(items, dateField, days) {
  const now = new Date()
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000)
  const filtered = items.filter(i => i[dateField] && new Date(i[dateField]) >= cutoff)

  if (days <= 7) {
    // Grouper par jour
    const groups = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      groups[key] = 0
    }
    filtered.forEach(item => {
      const d = new Date(item[dateField])
      const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      if (groups[key] !== undefined) groups[key]++
    })
    return Object.entries(groups).map(([label, value]) => ({ label, value }))
  } else if (days <= 90) {
    // Grouper par semaine
    const weeks = Math.ceil(days / 7)
    const groups = []
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000)
      const end = new Date(now - i * 7 * 24 * 60 * 60 * 1000)
      const count = filtered.filter(item => {
        const d = new Date(item[dateField])
        return d >= start && d < end
      }).length
      const label = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      groups.push({ label, value: count })
    }
    return groups
  } else {
    // Grouper par mois
    const groups = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const count = filtered.filter(item => {
        const id = new Date(item[dateField])
        return id >= d && id < nextMonth
      }).length
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      groups.push({ label, value: count })
    }
    return groups
  }
}

// ─── Tooltip custom ───────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl px-3 py-2"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #f4f5f7' }}>
      <p className="text-xs font-medium mb-1" style={{ color: '#1a2b4a' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name || 'Valeur'} : <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────
export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState({
    users: [], codes: [], partners: [], beneficiaries: [], contracts: [],
  })

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [users, codes, partners, beneficiaries, contracts] = await Promise.all([
          xano.getAll('users'),
          xano.getAll('plan-activation-code'),
          xano.getAll('partners'),
          xano.getAll('beneficiaries'),
          xano.getAll('contracts').catch(() => []),
        ])
        setData({ users, codes, partners, beneficiaries, contracts })
      } catch (err) {
        console.error('Erreur chargement analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const periodDays = PERIOD_OPTIONS.find(p => p.key === period)?.days || 30

  // 1. Évolution des inscriptions
  const inscriptionsData = useMemo(() =>
    groupByPeriod(data.users, 'created_at', periodDays),
    [data.users, periodDays]
  )

  // 2. Taux d'activation par partenaire (bar horizontal)
  const activationData = useMemo(() => {
    const partnerMap = {}
    data.partners.forEach(p => { partnerMap[p.id] = p.name })

    const codesByPartner = {}
    data.codes.forEach(c => {
      const pid = c.partnerId?.id || c.partnerId
      if (!pid) return
      if (!codesByPartner[pid]) codesByPartner[pid] = { total: 0, used: 0 }
      codesByPartner[pid].total++
      if (c.used) codesByPartner[pid].used++
    })

    return Object.entries(codesByPartner)
      .map(([pid, stats]) => ({
        name: (partnerMap[pid] || 'Inconnu').slice(0, 20),
        used: stats.used,
        available: stats.total - stats.used,
        total: stats.total,
        rate: stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [data.codes, data.partners])

  // 3. Répartition statuts codes (donut)
  const statusData = useMemo(() => {
    const sentCodes = new Set()
    data.beneficiaries.forEach(b => {
      if ((b.status === 'sent' || b.status === 'activated') && b.code) sentCodes.add(b.code)
    })

    const used = data.codes.filter(c => c.used).length
    const sent = data.codes.filter(c => !c.used && sentCodes.has(c.code)).length
    const available = data.codes.length - used - sent

    return [
      { name: 'Disponibles', value: available, color: COLORS.teal },
      { name: 'Envoyés', value: sent, color: COLORS.blue },
      { name: 'Utilisés', value: used, color: COLORS.gray },
    ]
  }, [data.codes, data.beneficiaries])

  // 4. Top partenaires par utilisation (bar vertical)
  const topPartnersData = useMemo(() => {
    const partnerMap = {}
    data.partners.forEach(p => { partnerMap[p.id] = p.name })

    const usedByPartner = {}
    data.codes.forEach(c => {
      if (!c.used) return
      const pid = c.partnerId?.id || c.partnerId
      if (!pid) return
      if (!usedByPartner[pid]) usedByPartner[pid] = 0
      usedByPartner[pid]++
    })

    return Object.entries(usedByPartner)
      .map(([pid, count]) => ({
        name: (partnerMap[pid] || 'Inconnu').slice(0, 14),
        codes: count,
      }))
      .sort((a, b) => b.codes - a.codes)
      .slice(0, 10)
  }, [data.codes, data.partners])

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Tableaux de bord et indicateurs</p>
        </div>
        <SkeletonList count={4} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Tableaux de bord et indicateurs</p>
        </div>

        {/* Filtre période */}
        <div className="flex gap-1.5 flex-shrink-0">
          {PERIOD_OPTIONS.map(p => (
            <button key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: period === p.key ? '#2BBFB3' : '#f4f5f7',
                color: period === p.key ? 'white' : '#8a93a2',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Utilisateurs app', value: data.users.length, color: COLORS.teal },
          { label: 'Codes totaux', value: data.codes.length, color: COLORS.navy },
          { label: 'Codes utilisés', value: data.codes.filter(c => c.used).length, color: COLORS.purple },
          { label: 'Partenaires actifs', value: data.partners.filter(p => p.crm_status === 'client actif').length, color: COLORS.amber },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4"
            style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
            <p className="text-xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: '#8a93a2' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Graphiques — grille 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Évolution inscriptions */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1a2b4a' }}>Évolution des inscriptions</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inscriptionsData}>
                <defs>
                  <linearGradient id="grad-inscriptions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f5f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a93a2' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a93a2' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Inscriptions" stroke={COLORS.teal} strokeWidth={2} fill="url(#grad-inscriptions)" dot={false} activeDot={{ r: 4, fill: COLORS.teal }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Taux d'activation par partenaire */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1a2b4a' }}>Activation par partenaire</h2>
          {activationData.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 220 }}>
              <p className="text-sm" style={{ color: '#8a93a2' }}>Aucune donnée</p>
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activationData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f5f7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8a93a2' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#8a93a2' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="used" name="Utilisés" stackId="a" fill={COLORS.purple} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="available" name="Disponibles" stackId="a" fill="#e8eaed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Répartition statuts codes */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1a2b4a' }}>Répartition des codes</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Légende */}
          <div className="flex justify-center gap-4 -mt-2">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs" style={{ color: '#8a93a2' }}>
                  {s.name} ({s.value})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Top partenaires par utilisation */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1a2b4a' }}>Top partenaires — codes utilisés</h2>
          {topPartnersData.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 220 }}>
              <p className="text-sm" style={{ color: '#8a93a2' }}>Aucune donnée</p>
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPartnersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f5f7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a93a2' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: '#8a93a2' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="codes" name="Codes utilisés" fill={COLORS.navy} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}