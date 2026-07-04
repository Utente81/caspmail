import React, { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Activity, FolderOpen, AlertTriangle, ShieldCheck, RefreshCw, User, Clock, Hash, Lock, Unlock, Save, FileText } from 'lucide-react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive);

function SeverityBadge({ severity }) {
  return <span className={`soc-badge sev-${severity?.toLowerCase()}`}>{severity}</span>
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  return <span className={`soc-badge status-${status?.toLowerCase().replace(' ', '-')}`}>{status}</span>
}

function KpiSkeleton() {
  return (
    <div className="soc-kpi-card" style={{ height: '100%' }}>
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

const defaultGrid = [
  { i: 'kpi_events', x: 0, y: 0, w: 3, h: 4 },
  { i: 'kpi_cases', x: 3, y: 0, w: 3, h: 4 },
  { i: 'kpi_alerts', x: 6, y: 0, w: 3, h: 4 },
  { i: 'kpi_score', x: 9, y: 0, w: 3, h: 4 },
  { i: 'chart_trend', x: 0, y: 4, w: 8, h: 10 },
  { i: 'chart_severity', x: 8, y: 4, w: 4, h: 10 },
  { i: 'table_alerts', x: 0, y: 14, w: 12, h: 10 },
  { i: 'table_cases', x: 0, y: 24, w: 8, h: 9 },
  { i: 'sys_health', x: 8, y: 24, w: 4, h: 9 }
];

const DEFAULT_LAYOUTS = {
  lg: defaultGrid,
  md: defaultGrid,
  sm: defaultGrid,
  xs: defaultGrid,
  xxs: defaultGrid
};

export default function SOCOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditable, setIsEditable] = useState(false)
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS)
  const [layoutLoading, setLayoutLoading] = useState(true)

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
      if (import.meta.env.DEV) {
        setData(MOCK_DATA)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLayout = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/layout', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json();
        if (json.layout) setLayouts(json.layout);
      }
    } catch (err) {
      console.warn("Could not load custom layout", err);
    } finally {
      setLayoutLoading(false);
    }
  }, []);

  const saveLayout = async () => {
    setIsEditable(false);
    try {
      const token = sessionStorage.getItem('caspmail_access_token')
      await fetch('/api/v4/soc/layout', {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ layout: layouts })
      });
    } catch(err) {
      console.error("Failed to save layout", err);
    }
  };

  useEffect(() => {
    loadLayout();
    fetchData();
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData, loadLayout])

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

  const onLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
  };

  const generateReport = async () => {
    try {
      const token = sessionStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/report/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Weekly_SOC_Report.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        alert("Failed to generate report");
      }
    } catch(err) {
      console.error(err);
      alert("Error generating report");
    }
  };

  if (layoutLoading) {
    return <div style={{ padding: '2rem' }}>Loading layout...</div>
  }

  return (
    <div className="soc-workspace soc-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="soc-workspace-header" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="soc-workspace-title">Overview</h2>
          <div className="soc-workspace-meta">Last updated {new Date().toLocaleTimeString()}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="soc-btn" onClick={generateReport}>
            <FileText size={14} /> Send Weekly PDF
          </button>
          {isEditable ? (
            <button className="soc-btn soc-btn-primary" onClick={saveLayout}>
              <Save size={14} /> Save Layout
            </button>
          ) : (
            <button className="soc-btn" onClick={() => setIsEditable(true)}>
              <Unlock size={14} /> Edit Layout
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', margin: '0 -16px' }}>
        <ResponsiveGridLayout
          className={`soc-grid-layout ${isEditable ? 'is-editable' : ''}`}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
          rowHeight={30}
          onLayoutChange={onLayoutChange}
          isDraggable={isEditable}
          isResizable={isEditable}
          margin={[16, 16]}
          containerPadding={[16, 0]}
        >
          {/* KPI 1 */}
          <div key="kpi_events" className={`soc-panel ${isEditable?'edit-mode':''}`} style={{ padding: 16 }}>
            {loading ? <KpiSkeleton /> : (
              <div className="soc-kpi-card" style={{height:'100%', padding:0, border:'none', background:'none'}}>
                <div className="soc-kpi-label"><Activity size={13} /> Events (24h)</div>
                <div className="soc-kpi-value">{kpis.events_24h?.toLocaleString()}</div>
                <div className="soc-kpi-sub">Total ingested events</div>
              </div>
            )}
          </div>
          
          {/* KPI 2 */}
          <div key="kpi_cases" className={`soc-panel ${isEditable?'edit-mode':''}`} style={{ padding: 16 }}>
            {loading ? <KpiSkeleton /> : (
              <div className="soc-kpi-card" style={{height:'100%', padding:0, border:'none', background:'none'}}>
                <div className="soc-kpi-label"><FolderOpen size={13} /> Open Cases</div>
                <div className="soc-kpi-value">{kpis.open_cases}</div>
                <div className="soc-kpi-sub">Requiring attention</div>
              </div>
            )}
          </div>

          {/* KPI 3 */}
          <div key="kpi_alerts" className={`soc-panel kpi-critical ${isEditable?'edit-mode':''}`} style={{ padding: 16 }}>
            {loading ? <KpiSkeleton /> : (
              <div className="soc-kpi-card" style={{height:'100%', padding:0, border:'none', background:'none'}}>
                <div className="soc-kpi-label"><AlertTriangle size={13} /> Critical Alerts</div>
                <div className="soc-kpi-value">{kpis.critical_alerts}</div>
                <div className="soc-kpi-sub">Unacknowledged</div>
              </div>
            )}
          </div>

          {/* KPI 4 */}
          <div key="kpi_score" className={`soc-panel kpi-score ${isEditable?'edit-mode':''}`} style={{ padding: 16 }}>
            {loading ? <KpiSkeleton /> : (
              <div className="soc-kpi-card" style={{height:'100%', padding:0, border:'none', background:'none'}}>
                <div className="soc-kpi-label"><ShieldCheck size={13} /> Security Score</div>
                <div className="soc-kpi-value">{kpis.security_score}<span className="soc-kpi-unit">/100</span></div>
                <div className="soc-kpi-sub">Overall posture</div>
              </div>
            )}
          </div>

          {/* Charts Row */}
          <div key="chart_trend" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Events Trend (24h)</h3></div>
            <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
              {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
                <ResponsiveContainer>
                  <AreaChart data={data?.events_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time_bucket" tickFormatter={(t) => new Date(t).getHours() + ':00'} stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <RechartsTooltip 
                      labelFormatter={(t) => new Date(t).toLocaleString()}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 8, color: '#f1f5f9' }}
                    />
                    <Area type="monotone" dataKey="event_count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEvents)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div key="chart_severity" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Severity</h3></div>
            <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
              {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data?.severity_distribution || []}
                      dataKey="count"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {(data?.severity_distribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.severity] || COLORS.info} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 8, color: '#f1f5f9' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Alerts - Full Width */}
          <div key="table_alerts" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Recent Alerts</h3></div>
            <div style={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
              {loading ? <TableSkeleton rows={5} cols={5} /> : (
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
                        <td className="soc-td-message" title={a.message}>{a.message}</td>
                        <td className="soc-td-mono soc-td-muted">{a.event_type || a.type || "N/A"}</td>
                        <td className="soc-td-muted">{formatDate(a.created_at || a.time)}</td>
                        <td><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Cases */}
          <div key="table_cases" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Recent Cases</h3></div>
            <div style={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
              {loading ? <TableSkeleton rows={3} cols={5} /> : (
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
                      <tr key={c.id.substring(0,8)}>
                        <td className="soc-td-mono soc-td-muted">{c.id.substring(0,8)}</td>
                        <td className="soc-td-message" title={c.title}>{c.title}</td>
                        <td><SeverityBadge severity={c.severity} /></td>
                        <td><StatusBadge status={c.status} /></td>
                        <td className="soc-td-muted">{c.assigned_to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* System Health */}
          <div key="sys_health" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">System Health</h3></div>
            <div style={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
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

        </ResponsiveGridLayout>
      </div>
    </div>
  )
}
