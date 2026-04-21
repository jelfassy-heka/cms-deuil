import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

// ─── Toast notification ────────────────────────────
export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])
  return { toast, showToast, clearToast: () => setToast(null) }
}

export function Toast({ toast, onClose }) {
  if (!toast) return null
  const colors = {
    success: { bg: '#e8f8f7', border: '#2BBFB3', text: '#2BBFB3', icon: '✓' },
    error: { bg: '#fee2e2', border: '#ef4444', text: '#ef4444', icon: '✕' },
    warning: { bg: '#fef3c7', border: '#d97706', text: '#d97706', icon: '!' },
    info: { bg: '#e8f0fe', border: '#1a2b4a', text: '#1a2b4a', icon: 'i' },
  }
  const c = colors[toast.type] || colors.success
  return (
    <div className="rounded-2xl p-3 mb-4 flex items-center gap-3 animate-fade-in"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: c.text }}>{c.icon}</div>
      <p className="text-sm flex-1" style={{ color: '#1a2b4a' }}>{toast.message}</p>
      <button onClick={onClose} className="text-sm flex-shrink-0" style={{ color: '#8a93a2' }}>×</button>
    </div>
  )
}

// ─── Confirm Modal ─────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', confirmColor = '#ef4444', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26,43,74,0.5)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h3 className="font-bold text-lg mb-2" style={{ color: '#1a2b4a' }}>{title}</h3>
        <p className="text-sm mb-6" style={{ color: '#8a93a2' }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: confirmColor }}>{confirmLabel}</button>
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#f4f5f7', color: '#8a93a2' }}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [state, setState] = useState(null)
  const confirm = useCallback((title, message, opts = {}) => {
    return new Promise(resolve => {
      setState({ title, message, ...opts, resolve })
    })
  }, [])
  const handleConfirm = () => { state?.resolve(true); setState(null) }
  const handleCancel = () => { state?.resolve(false); setState(null) }
  const ConfirmDialog = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      confirmColor={state.confirmColor}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null
  return { confirm, ConfirmDialog }
}

// ─── Skeleton Loader ───────────────────────────────
export function Skeleton({ width = '100%', height = '20px', rounded = '12px', className = '' }) {
  return (
    <div className={`animate-pulse ${className}`}
      style={{ width, height, borderRadius: rounded, backgroundColor: '#e8eaed' }} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton width="40px" height="40px" rounded="12px" />
        <div className="flex-1">
          <Skeleton width="60%" height="14px" className="mb-2" />
          <Skeleton width="40%" height="12px" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton width="70px" height="22px" rounded="20px" />
        <Skeleton width="70px" height="22px" rounded="20px" />
      </div>
    </div>
  )
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3 mb-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <Skeleton width="50px" height="28px" className="mb-2" />
          <Skeleton width="80px" height="12px" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ count = 5 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

// ─── Search Input with clear ───────────────────────
export function SearchInput({ value, onChange, placeholder = 'Rechercher...' }) {
  return (
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 pr-10 rounded-2xl text-sm outline-none"
        style={{ backgroundColor: '#f4f5f7', color: '#1a2b4a' }} />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
          style={{ backgroundColor: '#e8eaed', color: '#8a93a2' }}>×</button>
      )}
    </div>
  )
}

// ─── Copy Button ───────────────────────────────────
export function CopyButton({ text, label = 'Copier' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) { console.error('Copie échouée:', err) }
  }
  return (
    <button onClick={handleCopy}
      className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
      style={{
        backgroundColor: copied ? '#e8f8f7' : '#f4f5f7',
        color: copied ? '#2BBFB3' : '#8a93a2',
      }}>
      {copied ? '✓ Copié' : label}
    </button>
  )
}

// ─── Empty State ───────────────────────────────────
export function EmptyState({ icon = '📭', title, message, actionLabel, onAction }) {
  return (
    <div className="bg-white rounded-3xl p-10 md:p-14 text-center"
      style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
      <span className="text-5xl block mb-4">{icon}</span>
      <p className="font-bold text-lg mb-1" style={{ color: '#1a2b4a' }}>{title}</p>
      {message && <p className="text-sm mb-4" style={{ color: '#8a93a2' }}>{message}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="px-5 py-3 rounded-2xl text-white text-sm font-semibold mt-2"
          style={{ backgroundColor: '#2BBFB3' }}>{actionLabel}</button>
      )}
    </div>
  )
}

// ─── Pagination ────────────────────────────────────
export function usePagination(items, perPage = 25) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(items.length / perPage)
  const paginated = items.slice((page - 1) * perPage, page * perPage)

  useEffect(() => { setPage(1) }, [items.length])

  return { paginated, page, totalPages, setPage, total: items.length }
}

export function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid #f4f5f7' }}>
      <p className="text-xs" style={{ color: '#8a93a2' }}>{total} résultat{total > 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
          style={{ backgroundColor: page === 1 ? '#f4f5f7' : 'white', color: page === 1 ? '#d1d5db' : '#1a2b4a', border: '0.5px solid #f4f5f7' }}>←</button>
        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
          let p
          if (totalPages <= 5) p = i + 1
          else if (page <= 3) p = i + 1
          else if (page >= totalPages - 2) p = totalPages - 4 + i
          else p = page - 2 + i
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: page === p ? '#2BBFB3' : 'white',
                color: page === p ? 'white' : '#8a93a2',
                border: page === p ? 'none' : '0.5px solid #f4f5f7',
              }}>{p}</button>
          )
        })}
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
          style={{ backgroundColor: page === totalPages ? '#f4f5f7' : 'white', color: page === totalPages ? '#d1d5db' : '#1a2b4a', border: '0.5px solid #f4f5f7' }}>→</button>
      </div>
    </div>
  )
}

// ─── Debounced search ──────────────────────────────
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ─── Export CSV ────────────────────────────────────
export function exportToCSV(data, filename, columns) {
  if (!data.length) return
  const headers = columns.map(c => c.label).join(';')
  const rows = data.map(row => columns.map(c => {
    const val = row[c.key] || ''
    return `"${String(val).replace(/"/g, '""')}"`
  }).join(';'))
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = `${filename}.csv`; link.click()
  URL.revokeObjectURL(url)
}

// ─── Form validation ──────────────────────────────
export function useFormValidation(rules) {
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const validate = useCallback((field, value) => {
    const rule = rules[field]
    if (!rule) return ''
    if (rule.required && !value) return `${rule.label || field} est requis`
    if (rule.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email invalide'
    if (rule.minLength && value && value.length < rule.minLength) return `Minimum ${rule.minLength} caractères`
    return ''
  }, [rules])

  const touchField = useCallback((field, value) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validate(field, value) }))
  }, [validate])

  const validateAll = useCallback((values) => {
    const newErrors = {}
    let valid = true
    Object.keys(rules).forEach(field => {
      const err = validate(field, values[field])
      if (err) { newErrors[field] = err; valid = false }
    })
    setErrors(newErrors)
    setTouched(Object.keys(rules).reduce((acc, k) => ({ ...acc, [k]: true }), {}))
    return valid
  }, [rules, validate])

  return { errors, touched, touchField, validateAll }
}

export function FieldError({ error, touched }) {
  if (!error || !touched) return null
  return <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>
}

// ─── Sparkline Chart (Recharts) ───────────────────
export function SparklineChart({ data = [], color = '#2BBFB3', height = 32 }) {
  if (!data.length) return null
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Sparkline data helper ────────────────────────
export function buildSparklineData(items, dateField = 'created_at', days = 7) {
  const now = new Date()
  const labels = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
  const result = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const count = items.filter(item => {
      const itemDate = new Date(item[dateField])
      return itemDate >= dayStart && itemDate < dayEnd
    }).length

    result.push({ day: labels[dayStart.getDay()], value: count })
  }

  return result
}

// ─── Time ago helper ──────────────────────────────
export function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── Global styles (add to index.css or inject) ───
export const globalStyles = `
@keyframes fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.3s ease-out; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes slide-down { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-down { animation: slide-down 0.2s ease-out; }
`