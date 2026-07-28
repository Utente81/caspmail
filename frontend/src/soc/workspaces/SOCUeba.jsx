import React, { useState, useEffect, useCallback } from 'react'
import { Users, AlertTriangle, RefreshCw, ChevronLeft, AlertCircle, Activity } from 'lucide-react'
import { authFetch } from '../../auth/tokenRefresh.js'

const RISK_COLOR = (score) => {
  if (score >= 75) return '#ef4444'
  if (score >= 50) return '#f97316'
  if (score >= 25) return '#f59e0b'
  return '#22c55e'
}

const RISK_LABEL = (score) => {
  if (score >= 75) return 'Critical'
  if (score >= 50) return 'High'
  if (score >= 25) return 'Medium'
  return 'Low'
}

function RiskMeter({ score }) {
  const color = RISK_COLOR(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: '#0f1929', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: '.75rem', fontWeight: 700, color, minWidth: 30 }}>{score}</span>
    </div>
  )
}

function UserTimeline({ email }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    authFetch(`/api/soc/ueba/${encodeURIComponent(email)}/timeline`)
      .then(r => r.json())
      .then(d => setEvents(d.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [email])

  const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e', info: '#3b82f6' }

  if (loading) return <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 200 }} /></div>
  if (error) return <div style={{ padding: 20, color: '#fca5a5', fontSize: '.83rem' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div style={{ padding: '0 4px' }}>
      {events.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#7f8ea3' }}>No events found</div>}
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: '#1a2535' }} />
        {events.map((ev, i) => (
          <div key={ev.id} style={{ position: 'relative', marginBottom: 14 }}>
            <div style={{
              position: 'absolute', left: -13, top: 4,
              width: 10, height: 10, borderRadius: '50%',
              background: SEV_COLOR[ev.severity] || '#7f8ea3',
              border: '2px solid #060b14',
            }} />
            <div style={{ background: '#0f1929', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '.78rem', fontWeight: 600, color: SEV_COLOR[ev.severity] }}>{ev.severity?.toUpperCase()}</span>
                <span style={{ fontSize: '.72rem', color: '#7f8ea3' }}>{new Date(ev.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '.82rem', marginBottom: 4 }}>{ev.message}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: '.73rem', color: '#7f8ea3' }}>
                <span>Type: <code style={{ color: '#94a3b8' }}>{ev.type}</code></span>
                {ev.source_ip && <span>IP: <code style={{ color: '#94a3b8' }}>{ev.source_ip}</code></span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SOCUeba() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch]   = useState('')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    authFetch('/api/soc/ueba')
      .then(r => r.json())
      .then(d => setUsers(d.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u =>
    !search || u.user_email?.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
    const user = users.find(u => u.user_email === selected)
    const color = RISK_COLOR(user?.risk_score || 0)
    return (
      <div className="soc-workspace soc-fade-in">
        <div className="soc-workspace-header">
          <button className="soc-btn soc-btn-ghost" onClick={() => setSelected(null)}>
            <ChevronLeft size={14} /> All Users
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--gap)' }}>
          {/* User card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div className="soc-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', wordBreak: 'break-all' }}>{user?.user_email}</div>
                  <div style={{ fontSize: '.75rem', color, fontWeight: 600, marginTop: 2 }}>
                    {RISK_LABEL(user?.risk_score || 0)} Risk
                  </div>
                </div>
              </div>
              <RiskMeter score={user?.risk_score || 0} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                {[
                  ['Total Events', user?.total_events],
                  ['Critical', user?.critical],
                  ['High', user?.high],
                  ['Medium', user?.medium],
                  ['Distinct IPs', user?.distinct_ips],
                  ['Events (1h)', user?.events_1h],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: '#0f1929', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '.7rem', color: '#7f8ea3', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{val ?? 0}</div>
                  </div>
                ))}
              </div>
              {user?.last_seen && (
                <div style={{ fontSize: '.75rem', color: '#7f8ea3', marginTop: 14 }}>
                  Last seen: {new Date(user.last_seen).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="soc-panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
            <div className="soc-panel-header">
              <h3 className="soc-panel-title"><Activity size={14} /> Event Timeline</h3>
            </div>
            <div style={{ padding: '8px 16px 16px' }}>
              <UserTimeline email={selected} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">UEBA — User & Entity Behavior Analytics</h2>
        <button className="soc-btn soc-btn-ghost" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {error && (
        <div className="soc-error-state">
          <AlertCircle size={28} /><p>{error}</p>
          <button className="soc-btn soc-btn-primary" onClick={load}><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      {!error && (
        <div className="soc-panel">
          <div className="soc-panel-header">
            <h3 className="soc-panel-title">User Risk Scores <span style={{ color: '#7f8ea3', fontSize: '.8rem' }}>— last 30 days</span></h3>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by email…"
              style={{
                background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0',
                borderRadius: 8, padding: '5px 10px', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {loading
            ? <div style={{ padding: 16 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)}</div>
            : (
              <table className="soc-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th style={{ width: 160 }}>Risk Score</th>
                    <th>Total</th>
                    <th>Critical</th>
                    <th>High</th>
                    <th>IPs</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#7f8ea3' }}>No user activity data</td></tr>
                  )}
                  {filtered.map(u => (
                    <tr key={u.user_email} onClick={() => setSelected(u.user_email)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500 }}>{u.user_email}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#0f1929', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${u.risk_score}%`, height: '100%', background: RISK_COLOR(u.risk_score), borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: '.78rem', color: RISK_COLOR(u.risk_score), fontWeight: 700, minWidth: 24 }}>{u.risk_score}</span>
                          <span style={{ fontSize: '.7rem', color: RISK_COLOR(u.risk_score) }}>{RISK_LABEL(u.risk_score)}</span>
                        </div>
                      </td>
                      <td className="soc-td-muted">{u.total_events}</td>
                      <td style={{ color: '#ef4444', fontWeight: u.critical > 0 ? 700 : 400 }}>{u.critical}</td>
                      <td style={{ color: '#f97316', fontWeight: u.high > 0 ? 700 : 400 }}>{u.high}</td>
                      <td className="soc-td-muted">{u.distinct_ips}</td>
                      <td className="soc-td-muted" style={{ fontSize: '.75rem' }}>
                        {u.last_seen ? new Date(u.last_seen).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}
