import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, RefreshCw, AlertCircle, Search, Filter } from 'lucide-react'
import { authFetch } from '../../auth/tokenRefresh.js'

const TIME_RANGES = [
  { label: 'Last 1 hour',   value: '1h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days',   value: '7d' },
  { label: 'Last 30 days',  value: '30d' },
  { label: 'All time',      value: '' },
]

const ACTION_COLORS = {
  create: '#22c55e',
  update: '#3b82f6',
  update_status: '#3b82f6',
  delete: '#ef4444',
  verify: '#8b5cf6',
  login: '#f59e0b',
  logout: '#64748b',
}

function actionColor(action) {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action?.includes(key)) return color
  }
  return '#94a3b8'
}

export default function SOCAuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [page, setPage] = useState(0)
  const PAGE = 100

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({ limit: PAGE, offset: page * PAGE })
      if (search) qs.set('search', search)
      if (timeRange) qs.set('since', timeRange)

      const res = await authFetch(`/api/soc/audit?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setEntries(d.data || d)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, timeRange, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    load()
  }

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Audit Log — Security Activity Trail</h2>
        <button className="soc-btn soc-btn-ghost" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Filters */}
      <div className="soc-panel" style={{ marginBottom: 'var(--gap)' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7f8ea3' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actor, action, resource…"
              style={{
                width: '100%', background: '#0f1929', border: '1px solid #1a2535',
                color: '#e2e8f0', borderRadius: 8, padding: '7px 10px 7px 32px',
                fontSize: '.83rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
            style={{ background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: '.83rem' }}>
            {TIME_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" className="soc-btn soc-btn-primary">
            <Filter size={13} /> Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="soc-panel">
        <div className="soc-panel-header">
          <h3 className="soc-panel-title">
            <ClipboardList size={14} /> Entries
            {entries.length > 0 && <span style={{ color: '#7f8ea3', fontSize: '.8rem', marginLeft: 8 }}>— {entries.length} results</span>}
          </h3>
        </div>

        {error && (
          <div className="soc-error-state" style={{ padding: 24 }}>
            <AlertCircle size={28} /><p>{error}</p>
            <button className="soc-btn soc-btn-primary" onClick={load}><RefreshCw size={13} /> Retry</button>
          </div>
        )}

        {loading && (
          <div style={{ padding: 16 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6, marginBottom: 6 }} />)}
          </div>
        )}

        {!loading && !error && (
          <table className="soc-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Time</th>
                <th style={{ width: 120 }}>Actor</th>
                <th style={{ width: 160 }}>Action</th>
                <th style={{ width: 140 }}>Resource</th>
                <th>Details</th>
                <th style={{ width: 120 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#7f8ea3' }}>No audit entries found</td></tr>
              )}
              {entries.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    style={{ cursor: 'pointer' }}
                    className={expanded === entry.id ? 'soc-tr-expanded' : ''}
                  >
                    <td className="soc-td-mono soc-td-muted" style={{ fontSize: '.75rem' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '.78rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.actor || '—'}
                    </td>
                    <td>
                      <span style={{
                        color: actionColor(entry.action),
                        background: `${actionColor(entry.action)}18`,
                        border: `1px solid ${actionColor(entry.action)}33`,
                        padding: '2px 8px', borderRadius: 6,
                        fontSize: '.72rem', fontWeight: 700, fontFamily: 'monospace',
                      }}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="soc-td-mono" style={{ fontSize: '.75rem' }}>{entry.resource || '—'}</td>
                    <td className="soc-td-wrap" style={{ maxWidth: 280, fontSize: '.78rem', color: '#94a3b8' }}>
                      {entry.details
                        ? typeof entry.details === 'string'
                          ? entry.details
                          : Object.entries(entry.details).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : '—'
                      }
                    </td>
                    <td className="soc-td-mono soc-td-muted" style={{ fontSize: '.73rem' }}>{entry.ip || '—'}</td>
                  </tr>
                  {expanded === entry.id && (
                    <tr>
                      <td colSpan={6} style={{ background: '#080e1a', padding: '12px 20px' }}>
                        <pre style={{ fontSize: '.75rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                          {JSON.stringify({
                            id: entry.id,
                            actor: entry.actor,
                            action: entry.action,
                            resource: entry.resource,
                            details: entry.details,
                            ip: entry.ip,
                            tenant_id: entry.tenant_id,
                            created_at: entry.created_at,
                          }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {entries.length === PAGE && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', gap: 8 }}>
            {page > 0 && <button className="soc-btn soc-btn-ghost" onClick={() => setPage(p => p - 1)}>← Previous</button>}
            <button className="soc-btn soc-btn-ghost" onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
