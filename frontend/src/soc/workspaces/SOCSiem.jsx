import React, { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, AlertCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { authFetch } from '../../auth/tokenRefresh.js'

const SEVERITIES = ['', 'critical', 'high', 'medium', 'low', 'info']
const TIME_RANGES = [
  { label: 'Last 1 hour',  value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours',value: '24h' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time',     value: '' },
]

const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e', info: '#3b82f6' }

function SevBadge({ s }) {
  const c = SEV_COLOR[s] || '#64748b'
  return (
    <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`,
      padding: '2px 8px', borderRadius: 20, fontSize: '.7rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {s}
    </span>
  )
}

function BarChart({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => Number(d.count)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map(d => (
        <div key={d.severity || d.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: '.75rem', color: '#7f8ea3', textAlign: 'right', flexShrink: 0 }}>
            {d.severity || d.type}
          </div>
          <div style={{ flex: 1, height: 20, background: '#0f1929', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${max ? (Number(d.count) / max) * 100 : 0}%`,
              background: SEV_COLOR[d.severity] || '#3b82f6',
              borderRadius: 4, transition: 'width .4s',
            }} />
          </div>
          <div style={{ width: 40, fontSize: '.75rem', color: '#7f8ea3', flexShrink: 0 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

export default function SOCSiem() {
  const [events, setEvents]   = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [expanded, setExpanded] = useState(null)

  // Filters
  const [search, setSearch]     = useState('')
  const [severity, setSeverity] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [page, setPage]         = useState(0)
  const PAGE = 100

  const loadEvents = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({ limit: PAGE, offset: page * PAGE })
      if (search)   qs.set('search', search)
      if (severity) qs.set('severity', severity)
      if (timeRange) qs.set('since', timeRange)

      const [evRes, stRes] = await Promise.all([
        authFetch(`/api/soc/events?${qs}`),
        authFetch('/api/soc/events/stats'),
      ])
      if (!evRes.ok || !stRes.ok) throw new Error('API error')
      const [evData, stData] = await Promise.all([evRes.json(), stRes.json()])
      setEvents(evData.data)
      setStats(stData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, severity, timeRange, page])

  useEffect(() => { loadEvents() }, [loadEvents])

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    loadEvents()
  }

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">SIEM — Security Event Log</h2>
        <button className="soc-btn soc-btn-ghost" onClick={loadEvents}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Charts row */}
      {stats && (
        <div className="soc-two-col" style={{ marginBottom: 'var(--gap)' }}>
          <div className="soc-panel" style={{ padding: '16px 20px' }}>
            <div className="soc-panel-header" style={{ marginBottom: 12 }}>
              <h3 className="soc-panel-title">Events by Severity (24h)</h3>
            </div>
            <BarChart data={stats.by_severity} />
          </div>
          <div className="soc-panel" style={{ padding: '16px 20px' }}>
            <div className="soc-panel-header" style={{ marginBottom: 12 }}>
              <h3 className="soc-panel-title">Top Event Types (24h)</h3>
            </div>
            <BarChart data={stats.by_type?.slice(0, 6)} />
          </div>
        </div>
      )}

      {/* Search & filters */}
      <div className="soc-panel" style={{ marginBottom: 'var(--gap)' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7f8ea3' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search message, type, user…"
              style={{
                width: '100%', background: '#0f1929', border: '1px solid #1a2535',
                color: '#e2e8f0', borderRadius: 8, padding: '7px 10px 7px 32px',
                fontSize: '.83rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            style={{ background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: '.83rem' }}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s || 'All severities'}</option>)}
          </select>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
            style={{ background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: '.83rem' }}>
            {TIME_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" className="soc-btn soc-btn-primary">
            <Filter size={13} /> Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="soc-panel">
        <div className="soc-panel-header">
          <h3 className="soc-panel-title">Events {events.length > 0 && <span style={{ color: '#7f8ea3', fontSize: '.8rem' }}>— {events.length} results</span>}</h3>
        </div>

        {error && (
          <div className="soc-error-state" style={{ padding: '24px' }}>
            <AlertCircle size={28} />
            <p>{error}</p>
            <button className="soc-btn soc-btn-primary" onClick={loadEvents}><RefreshCw size={13} /> Retry</button>
          </div>
        )}

        {loading && (
          <div style={{ padding: 16 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 6 }} />
            ))}
          </div>
        )}

        {!loading && !error && (
          <table className="soc-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Time</th>
                <th style={{ width: 90 }}>Severity</th>
                <th style={{ width: 140 }}>Type</th>
                <th>Message</th>
                <th style={{ width: 140 }}>Source IP</th>
                <th style={{ width: 140 }}>User</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#7f8ea3' }}>No events found</td></tr>
              )}
              {events.map(ev => (
                <React.Fragment key={ev.id}>
                  <tr
                    onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                    style={{ cursor: 'pointer' }}
                    className={expanded === ev.id ? 'soc-tr-expanded' : ''}
                  >
                    <td className="soc-td-mono soc-td-muted" style={{ fontSize: '.75rem' }}>
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td><SevBadge s={ev.severity} /></td>
                    <td className="soc-td-mono" style={{ fontSize: '.78rem' }}>{ev.type}</td>
                    <td className="soc-td-wrap" style={{ maxWidth: 320 }}>{ev.message}</td>
                    <td className="soc-td-mono soc-td-muted" style={{ fontSize: '.75rem' }}>{ev.source_ip || '—'}</td>
                    <td className="soc-td-muted" style={{ fontSize: '.78rem' }}>{ev.user_email || '—'}</td>
                  </tr>
                  {expanded === ev.id && (
                    <tr>
                      <td colSpan={6} style={{ background: '#080e1a', padding: '12px 20px' }}>
                        <pre style={{ fontSize: '.75rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                          {JSON.stringify(ev.raw || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {events.length === PAGE && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', gap: 8 }}>
            {page > 0 && <button className="soc-btn soc-btn-ghost" onClick={() => setPage(p => p - 1)}>← Previous</button>}
            <button className="soc-btn soc-btn-ghost" onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
