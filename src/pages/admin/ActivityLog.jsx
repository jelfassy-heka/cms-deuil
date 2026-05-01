// Sécurité Admin — Journal d'activité (Batch 7H.2)
// Brancher sur GET /admin/audit-logs (api_id=1437) au lieu de reconstruire les activités
// côté client à partir des tables métier.

import { useEffect, useMemo, useState } from 'react'
import { getAuditLogs } from '../../api/adminApi'
import {
  PageHeader,
  Pagination,
  SkeletonList,
  EmptyState,
  StatusBadge,
} from '../../components/SharedUI'

// ─── Mappings métier ──────────────────────────────────────────────
const ACTION_LABELS = {
  login: 'Connexion',
  login_failed: 'Tentative de connexion refusée',
  failed: 'Tentative de connexion refusée',
  signup: "Création d'un compte CMS",
  password_change: 'Changement de mot de passe',
  verify_password: 'Vérification de mot de passe',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  role_change: "Modification d'un rôle",
  process_request: "Traitement d'une demande",
  send_email: "Envoi d'un email transactionnel",
  send_code_email: "Envoi d'un code par email",
}

const OBJECT_LABELS = {
  cms_user: 'Compte CMS',
  auth_session: "Session d'authentification",
  partner: 'Partenaire',
  partner_member: 'Référent partenaire',
  code_request: 'Demande de codes',
  activation_code: "Code d'activation",
  beneficiary: 'Collaborateur bénéficiaire',
  contract: 'Contrat',
  contact: 'Contact',
  crm_activity: 'Activité CRM',
  email: 'Email',
}

const ACTION_OPTIONS = [
  'login',
  'login_failed',
  'signup',
  'password_change',
  'verify_password',
  'create',
  'update',
  'delete',
  'role_change',
  'process_request',
  'send_email',
  'send_code_email',
]

const OBJECT_OPTIONS = [
  'cms_user',
  'auth_session',
  'partner',
  'partner_member',
  'code_request',
  'activation_code',
  'beneficiary',
  'contract',
  'contact',
  'crm_activity',
  'email',
]

const METHOD_OPTIONS = ['POST', 'PATCH', 'PUT', 'DELETE', 'GET']

const PER_PAGE_OPTIONS = [25, 50, 100]

// ─── Sécurité affichage ───────────────────────────────────────────
// Masque défensivement les clés sensibles si elles apparaissent dans l'audit.
// Les writers backend Batch 7B-7F ont déjà whitelistés ; cette fonction est une
// défense supplémentaire côté UI uniquement (n'altère pas les données backend).
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'authToken',
  'auth_token',
  'bearer',
  'api_key',
  'apiKey',
  'secret',
  'BREVO_API_KEY',
  'token',
])

function sanitizeForDisplay(value) {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sanitizeForDisplay)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '[masqué]'
      } else {
        out[k] = sanitizeForDisplay(v)
      }
    }
    return out
  }
  return value
}

// ─── Utilitaires ──────────────────────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—'
  const d = new Date(typeof timestamp === 'number' ? timestamp : timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Convertit une date string YYYY-MM-DD en timestamp ms.
// kind="from" → début de journée locale, kind="to" → fin de journée locale.
function dateInputToTimestamp(value, kind) {
  if (!value) return ''
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d, kind === 'to' ? 23 : 0, kind === 'to' ? 59 : 0, kind === 'to' ? 59 : 0)
  return String(date.getTime())
}

const ROLE_BADGE = {
  admin: { bg: '#e8f0fe', color: '#1a2b4a', label: 'admin' },
  partner: { bg: '#fef3c7', color: '#d97706', label: 'partenaire' },
}

const STATUS_COLOR = (status) => {
  if (status >= 200 && status < 300) return { bg: '#e8f8f7', color: '#2BBFB3' }
  if (status >= 400 && status < 500) return { bg: '#fef3c7', color: '#d97706' }
  if (status >= 500) return { bg: '#fee2e2', color: '#ef4444' }
  return { bg: '#f4f5f7', color: '#8a93a2' }
}

// ─── Composant principal ──────────────────────────────────────────
export default function ActivityLog() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [drawer, setDrawer] = useState(null)

  // Filtres serveur
  const [actionType, setActionType] = useState('')
  const [objectType, setObjectType] = useState('')
  const [objectId, setObjectId] = useState('')
  const [actorEmail, setActorEmail] = useState('')
  const [method, setMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const totalPages = useMemo(() => {
    if (total <= 0 || perPage <= 0) return 1
    return Math.max(1, Math.ceil(total / perPage))
  }, [total, perPage])

  const filtersSignature = useMemo(
    () => JSON.stringify({ actionType, objectType, objectId, actorEmail, method, dateFrom, dateTo, perPage }),
    [actionType, objectType, objectId, actorEmail, method, dateFrom, dateTo, perPage]
  )

  // Reset page=1 quand filtres changent
  useEffect(() => {
    setPage(1)
  }, [filtersSignature])

  // Fetch
  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const isInitial = items.length === 0 && !error && !forbidden
      if (isInitial) setLoading(true)
      else setReloading(true)
      setError(null)
      setForbidden(false)
      try {
        const params = {
          page,
          per_page: perPage,
          action_type: actionType || undefined,
          object_type: objectType || undefined,
          object_id: objectId ? Number(objectId) : undefined,
          actor_email: actorEmail || undefined,
          method: method || undefined,
          date_from: dateInputToTimestamp(dateFrom, 'from') || undefined,
          date_to: dateInputToTimestamp(dateTo, 'to') || undefined,
        }
        const data = await getAuditLogs(params)
        if (cancelled) return
        setItems(Array.isArray(data?.items) ? data.items : [])
        setTotal(typeof data?.total === 'number' ? data.total : 0)
      } catch (err) {
        if (cancelled) return
        if (err?.message === 'forbidden') {
          setForbidden(true)
        } else {
          setError(err?.message || 'Erreur réseau')
        }
        setItems([])
        setTotal(0)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setReloading(false)
        }
      }
    }
    fetchData()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtersSignature])

  const resetFilters = () => {
    setActionType('')
    setObjectType('')
    setObjectId('')
    setActorEmail('')
    setMethod('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = !!(actionType || objectType || objectId || actorEmail || method || dateFrom || dateTo)

  // ─── Header ────────────────────────────────────────
  const header = (
    <PageHeader
      title="Sécurité Admin — Journal d'activité"
      subtitle="Suivre les actions sensibles réalisées dans le CMS Héka."
    />
  )

  if (forbidden) {
    return (
      <div>
        {header}
        <EmptyState
          icon="🔒"
          title="Accès réservé aux administrateurs."
          message="Cette page est réservée aux comptes administrateurs Héka."
        />
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Bandeau intro */}
      <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <p className="text-sm" style={{ color: '#1a2b4a' }}>
          Ce journal retrace les actions réalisées côté CMS&nbsp;: connexions, créations, modifications, suppressions, envois d&apos;emails et changements de rôles.
        </p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterField label="Type d'action">
            <select value={actionType} onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              <option value="">Toutes les actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Type d'objet">
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              <option value="">Tous les objets</option>
              {OBJECT_OPTIONS.map((o) => (
                <option key={o} value={o}>{OBJECT_LABELS[o] || o}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Identifiant objet (object_id)">
            <input type="number" value={objectId} onChange={(e) => setObjectId(e.target.value)}
              placeholder="ex: 5"
              min={1}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
          </FilterField>

          <FilterField label="Auteur (email)">
            <input type="text" value={actorEmail} onChange={(e) => setActorEmail(e.target.value)}
              placeholder="email exact"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
          </FilterField>

          <FilterField label="Méthode HTTP">
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              <option value="">Toutes</option>
              {METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Résultats par page">
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }}>
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Date début">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
          </FilterField>

          <FilterField label="Date fin">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
          </FilterField>

          <div className="flex items-end">
            <button onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="w-full px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: hasActiveFilters ? '#1a2b4a' : '#f4f5f7',
                color: hasActiveFilters ? 'white' : '#b0b7c3',
              }}>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <EmptyState
          icon="⚠️"
          title="Impossible de charger le journal"
          message={error}
          actionLabel="Réessayer"
          onAction={() => setPage((p) => p)}
        />
      ) : items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon="🔍"
            title="Aucune activité ne correspond à vos filtres."
            message="Ajustez ou réinitialisez les filtres pour voir d'autres résultats."
            actionLabel="Réinitialiser"
            onAction={resetFilters}
          />
        ) : (
          <EmptyState
            icon="📋"
            title="Aucune activité enregistrée pour le moment."
            message="Les actions sensibles réalisées dans le CMS apparaîtront ici."
          />
        )
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          {reloading && (
            <div className="px-4 py-2 text-xs text-center" style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>
              Mise à jour en cours…
            </div>
          )}

          {/* Table desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f4f5f7', backgroundColor: '#fafbfc' }}>
                  <Th>Date</Th>
                  <Th>Auteur</Th>
                  <Th>Action</Th>
                  <Th>Objet</Th>
                  <Th>Méthode</Th>
                  <Th>Statut</Th>
                  <Th align="right">Détails</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <Row
                    key={row.id}
                    row={row}
                    isLast={idx === items.length - 1}
                    onOpen={() => setDrawer(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Liste mobile */}
          <div className="md:hidden">
            {items.map((row, idx) => (
              <RowMobile
                key={row.id}
                row={row}
                isLast={idx === items.length - 1}
                onOpen={() => setDrawer(row)}
              />
            ))}
          </div>

          <div className="px-5 pb-3">
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Drawer détail */}
      {drawer && <DetailDrawer row={drawer} onClose={() => setDrawer(null)} />}
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────
function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1" style={{ color: '#8a93a2' }}>{label}</span>
      {children}
    </label>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap"
      style={{ color: '#8a93a2', textAlign: align }}>
      {children}
    </th>
  )
}

function Row({ row, isLast, onOpen }) {
  const action = ACTION_LABELS[row.action_type] || row.action_label || row.action_type || '—'
  const objLabel = OBJECT_LABELS[row.object_type] || row.object_type || '—'
  const objSuffix = row.object_id ? ` #${row.object_id}` : ''
  const role = ROLE_BADGE[row.actor_role]
  const statusColors = STATUS_COLOR(row.status)
  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#1a2b4a' }}>{formatDate(row.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ color: '#1a2b4a' }}>{row.actor_email || '—'}</span>
          {role && <StatusBadge label={role.label} bg={role.bg} color={role.color} size="sm" />}
        </div>
      </td>
      <td className="px-4 py-3" style={{ color: '#1a2b4a' }}>{action}</td>
      <td className="px-4 py-3" style={{ color: '#1a2b4a' }}>{objLabel}{objSuffix}</td>
      <td className="px-4 py-3" style={{ color: '#8a93a2' }}>{row.method || '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge label={String(row.status || '—')} bg={statusColors.bg} color={statusColors.color} size="sm" />
      </td>
      <td className="px-4 py-3" style={{ textAlign: 'right' }}>
        <button onClick={onOpen}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
          style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
          Voir les modifications avant / après
        </button>
      </td>
    </tr>
  )
}

function RowMobile({ row, isLast, onOpen }) {
  const action = ACTION_LABELS[row.action_type] || row.action_label || row.action_type || '—'
  const objLabel = OBJECT_LABELS[row.object_type] || row.object_type || '—'
  const objSuffix = row.object_id ? ` #${row.object_id}` : ''
  const role = ROLE_BADGE[row.actor_role]
  const statusColors = STATUS_COLOR(row.status)
  return (
    <div className="px-4 py-3" style={{ borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: '#8a93a2' }}>{formatDate(row.created_at)}</span>
        <StatusBadge label={String(row.status || '—')} bg={statusColors.bg} color={statusColors.color} size="sm" />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: '#1a2b4a' }}>{action}</p>
      <p className="text-xs mb-2" style={{ color: '#8a93a2' }}>{objLabel}{objSuffix} • {row.method || '—'}</p>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs truncate" style={{ color: '#1a2b4a' }}>{row.actor_email || '—'}</span>
        {role && <StatusBadge label={role.label} bg={role.bg} color={role.color} size="sm" />}
      </div>
      <button onClick={onOpen}
        className="w-full px-3 py-2 rounded-lg text-xs font-medium"
        style={{ backgroundColor: '#e8f8f7', color: '#2BBFB3' }}>
        Voir les modifications avant / après
      </button>
    </div>
  )
}

function DetailDrawer({ row, onClose }) {
  const [showTechnical, setShowTechnical] = useState(false)
  const action = ACTION_LABELS[row.action_type] || row.action_label || row.action_type || '—'
  const objLabel = OBJECT_LABELS[row.object_type] || row.object_type || '—'
  const objSuffix = row.object_id ? ` #${row.object_id}` : ''

  const previousValues = sanitizeForDisplay(row.previous_values || {})
  const newValues = sanitizeForDisplay(row.new_values || {})
  const metadata = sanitizeForDisplay(row.metadata || {})

  return (
    <div className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="bg-white w-full max-w-xl h-full overflow-y-auto"
        style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <header className="px-6 py-5 sticky top-0 bg-white"
          style={{ borderBottom: '1px solid #f4f5f7' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8a93a2' }}>
                {formatDate(row.created_at)}
              </p>
              <h2 className="text-lg font-bold" style={{ color: '#1a2b4a' }}>{action}</h2>
              <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>{row.actor_email || '—'}</p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#f4f5f7' }}
              aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="#8a93a2" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Résumé */}
        <section className="px-6 py-4" style={{ borderBottom: '1px solid #f4f5f7' }}>
          <SummaryRow label="Objet" value={`${objLabel}${objSuffix}`} />
          <SummaryRow label="Endpoint" value={row.endpoint || '—'} />
          <SummaryRow label="Méthode" value={row.method || '—'} />
          <SummaryRow label="Statut HTTP" value={String(row.status || '—')} />
        </section>

        {/* Avant */}
        <Section title="Avant">
          <JsonBlock value={previousValues} />
        </Section>

        {/* Après */}
        <Section title="Après">
          <JsonBlock value={newValues} />
        </Section>

        {/* Métadonnées */}
        <Section title="Métadonnées">
          <JsonBlock value={metadata} />
        </Section>

        {/* Technique repliable */}
        <section className="px-6 py-4" style={{ borderTop: '1px solid #f4f5f7' }}>
          <button onClick={() => setShowTechnical((v) => !v)}
            className="text-xs font-medium"
            style={{ color: '#8a93a2' }}>
            {showTechnical ? '▾ Masquer' : '▸ Afficher'} les détails techniques
          </button>
          {showTechnical && (
            <div className="mt-3 space-y-1.5">
              <SummaryRow label="Audit ID" value={String(row.id)} />
              <SummaryRow label="acted_at" value={formatDate(row.acted_at)} />
              <SummaryRow label="actor_partner_id" value={String(row.actor_partner_id ?? '—')} />
              <SummaryRow label="object_partner_id" value={String(row.object_partner_id ?? '—')} />
              <SummaryRow label="ip_address" value={row.ip_address || '—'} />
              <SummaryRow label="user_agent" value={row.user_agent || '—'} />
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="px-6 py-4 sticky bottom-0 bg-white"
          style={{ borderTop: '1px solid #f4f5f7' }}>
          <button onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#1a2b4a', color: 'white' }}>
            Fermer
          </button>
        </footer>
      </aside>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="px-6 py-4" style={{ borderBottom: '1px solid #f4f5f7' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8a93a2' }}>{title}</h3>
      {children}
    </section>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span style={{ color: '#8a93a2' }}>{label}</span>
      <span className="text-right break-all" style={{ color: '#1a2b4a' }}>{value}</span>
    </div>
  )
}

function JsonBlock({ value }) {
  const json = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return ''
    }
  }, [value])

  if (!json || json === '{}' || json === '[]') {
    return <p className="text-xs italic" style={{ color: '#8a93a2' }}>(vide)</p>
  }

  return (
    <pre className="text-xs rounded-lg p-3 overflow-x-auto"
      style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {json}
    </pre>
  )
}
