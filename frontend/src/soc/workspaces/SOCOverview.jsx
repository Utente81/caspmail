import React, { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Activity, FolderOpen, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'

function SeverityBadge({ severity }) {
  return <span className={`soc-badge sev-${severity?.toLowerCase()}`}>{severity}</span>
}

function StatusBadge({ status }) {
  return <span className={`soc-badge status-${status?.toLowerCase().replace(' ', '-')}`}>{status}</span>
}

function KpiSkeleton() {
  return (
    <div className="soc-kpi-card">
      <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 120, height: 32, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 60, height: 10 }} />
    </div>
  )
}

function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <table className="soc-table">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: cols }).map((_, j) => (
              <td key={j}><div className="skeleton" style={{ width: `${60 + Math.random() * 40}%`, height: 12 }} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const MOCK_DATA = {
  kpis: {
    events_24h: 142830,
    open_cases: 12,
    critical_alerts: 3,
    security_score: 87,
  },
  recent_alerts: [
    { id: 'a1', severity: 'Critical', message: 'Brute-force login detected from external IP', source_ip: '185.220.101.45', type: 'Authentication', time: '2 min ago', status: 'Open' },
    { id: 'a2', severity: 'High', message: 'Unusual outbound data transfer volume', source_ip: '10.0.1.14', type: 'Exfiltration', time: '11 min ago', status: 'Acknowledged' },
    { id: 'a3', severity: 'High', message: 'Malware signature matched in email attachment', source_ip: '10.0.2.33', type: 'Malware', time: '28 min ago', status: 'Open' },
    { id: 'a4', severity: 'Medium', message: 'Multiple failed MFA attempts', source_ip: '172.16.0.5', type: 'Authentication', time: '45 min ago', status: 'Open' },
    { id: 'a5', severity: 'Low', message: 'Port scan detected from internal host', source_ip: '10.0.3.22', type: 'Reconnaissance', time: '1 hr ago', status: 'Resolved' },
  ],
  recent_cases: [
    { id: 'CASE-0041', title: 'Credential stuffing campaign', severity: 'Critical', status: 'Investigating', assigned_to: 'J. Martinez' },
    { id: 'CASE-0040', title: 'Suspected insider data access', severity: 'High', status: 'Open', assigned_to: 'K. Patel' },
    { id: 'CASE-0039', title: 'Phishing email cluster', severity: 'Medium', status: 'Resolved', assigned_to: 'R. Chen' },
  ],
  system_health: [
    { name: 'SIEM Ingestion', status: 'healthy' },
    { name: 'Threat Intel Feed', status: 'healthy' },
    { name: 'Email Gateway', status: 'healthy' },
    { name: 'UEBA Engine', status: 'degraded' },
    { name: 'SOAR Automation', status: 'healthy' },
  ],
}


const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#64748b'
}

export default function SOCOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const token = sessionStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/overview', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      // Fall back to mock data in development
      if (import.meta.env.DEV) {
        setData(MOCK_DATA)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  if (error) {
    return (
      <div className="soc-error-state">
        <AlertTriangle size={36} />
        <p>Failed to load overview data</p>
        <p className="soc-error-detail">{error}</p>
        <button className="soc-btn soc-btn-primary" onClick={fetchData}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const kpis = data?.kpis || MOCK_DATA.kpis
  const alerts = data?.recent_alerts || MOCK_DATA.recent_alerts
  const cases = data?.recent_cases || MOCK_DATA.recent_cases
  const health = data?.system_health || MOCK_DATA.system_health

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Overview</h2>
        <div className="soc-workspace-meta">Last updated {new Date().toLocaleTimeString()}</div>
      </div>

      {/* KPI Row */}
      <div className="soc-kpi-row">
        {loading ? (
          <>
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </>
        ) : (
          <>
            <div className="soc-kpi-card">
              <div className="soc-kpi-label">
                <Activity size={13} /> Events (24h)
              </div>
              <div className="soc-kpi-value">{kpis.events_24h?.toLocaleString()}</div>
              <div className="soc-kpi-sub">Total ingested events</div>
            </div>
            <div className="soc-kpi-card">
              <div className="soc-kpi-label">
                <FolderOpen size={13} /> Open Cases
              </div>
              <div className="soc-kpi-value">{kpis.open_cases}</div>
              <div className="soc-kpi-sub">Requiring attention</div>
            </div>
            <div className="soc-kpi-card kpi-critical">
              <div className="soc-kpi-label">
                <AlertTriangle size={13} /> Critical Alerts
              </div>
              <div className="soc-kpi-value">{kpis.critical_alerts}</div>
              <div className="soc-kpi-sub">Unacknowledged</div>
            </div>
            <div className="soc-kpi-card kpi-score">
              <div className="soc-kpi-label">
                <ShieldCheck size={13} /> Security Score
              </div>
              <div className="soc-kpi-value">{kpis.security_score}<span className="soc-kpi-unit">/100</span></div>
              <div className="soc-kpi-sub">Overall posture</div>
            </div>
          </>
        )}
      </div>

      
      {/* Charts Row */}
      <div className="soc-two-col" style={{ marginBottom: 'var(--gap)' }}>
        <div className="soc-panel">
          <div className="soc-panel-header">
            <h3 className="soc-panel-title">Events Trend (24h)</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
              <ResponsiveContainer>
                <AreaChart data={data?.events_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time_bucket" tickFormatter={(t) => new Date(t).getHours() + ':00'} stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <RechartsTooltip 
                    labelFormatter={(t) => new Date(t).toLocaleString()}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="event_count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEvents)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="soc-panel">
          <div className="soc-panel-header">
            <h3 className="soc-panel-title">Severity Distribution</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data?.severity_distribution || []}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {(data?.severity_distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.severity] || COLORS.info} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="soc-two-col">
        {/* Recent Alerts */}
        <div className="soc-panel">
          <div className="soc-panel-header">
            <h3 className="soc-panel-title">Recent Alerts</h3>
          </div>
          {loading ? <TableSkeleton rows={5} cols={4} /> : (
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Type</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td className="soc-td-wrap">{a.message}</td>
                    <td className="soc-td-mono">{a.type}</td>
                    <td className="soc-td-muted">{a.time}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {/* Recent Cases */}
          <div className="soc-panel">
            <div className="soc-panel-header">
              <h3 className="soc-panel-title">Recent Cases</h3>
            </div>
            {loading ? <TableSkeleton rows={3} cols={4} /> : (
              <table className="soc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.id}>
                      <td className="soc-td-mono soc-td-muted">{c.id}</td>
                      <td>{c.title}</td>
                      <td><SeverityBadge severity={c.severity} /></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="soc-td-muted">{c.assigned_to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* System Health */}
          <div className="soc-panel">
            <div className="soc-panel-header">
              <h3 className="soc-panel-title">System Health</h3>
            </div>
            {loading ? <TableSkeleton rows={5} cols={2} /> : (
              <div className="soc-health-list">
                {health.map(h => (
                  <div key={h.name} className="soc-health-row">
                    <span className="soc-health-name">{h.name}</span>
                    <span className={`soc-health-status ${h.status}`}>{h.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
