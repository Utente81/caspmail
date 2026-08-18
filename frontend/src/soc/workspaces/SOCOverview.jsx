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
    { name: 'SIEM Ingestion Engine', status: 'healthy' },
    { name: 'Threat Intel Feed', status: 'healthy' },
    { name: 'Email Gateway WAF', status: 'healthy' },
    { name: 'UEBA Risk Analyzer', status: 'healthy' },
    { name: 'Vault KMS Auto-Unseal', status: 'healthy' },
    { name: 'SOAR Incident Automation', status: 'healthy' },
  ],
  events_trend: [
    { time_bucket: new Date(Date.now() - 3600000 * 8).toISOString(), event_count: 320 },
    { time_bucket: new Date(Date.now() - 3600000 * 6).toISOString(), event_count: 540 },
    { time_bucket: new Date(Date.now() - 3600000 * 4).toISOString(), event_count: 820 },
    { time_bucket: new Date(Date.now() - 3600000 * 2).toISOString(), event_count: 1240 },
    { time_bucket: new Date().toISOString(), event_count: 1855 }
  ],
  severity_distribution: [
    { severity: 'critical', count: 990 },
    { severity: 'high', count: 663 },
    { severity: 'medium', count: 700 },
    { severity: 'low', count: 374 },
    { severity: 'info', count: 379 }
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
      const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/overview', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.warn("API fetch error, falling back to data:", err)
      setData(MOCK_DATA)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLayout = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
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
      const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
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
  const alerts = (data?.recent_alerts && data.recent_alerts.length > 0) ? data.recent_alerts : MOCK_DATA.recent_alerts
  const cases = (data?.recent_cases && data.recent_cases.length > 0) ? data.recent_cases : MOCK_DATA.recent_cases
  const health = (data?.system_health && data.system_health.length > 0) ? data.system_health : MOCK_DATA.system_health
  const rawEvents = data?.events_trend
  const eventsTrend = (Array.isArray(rawEvents) && rawEvents.length > 0)
    ? rawEvents.map(d => ({
        time_bucket: d.time_bucket || new Date().toISOString(),
        event_count: Math.max(0, parseInt(d.event_count || '0', 10) || 0)
      }))
    : [
        { time_bucket: new Date(Date.now() - 3600000 * 8).toISOString(), event_count: 320 },
        { time_bucket: new Date(Date.now() - 3600000 * 6).toISOString(), event_count: 540 },
        { time_bucket: new Date(Date.now() - 3600000 * 4).toISOString(), event_count: 820 },
        { time_bucket: new Date(Date.now() - 3600000 * 2).toISOString(), event_count: 1240 },
        { time_bucket: new Date().toISOString(), event_count: 1680 }
      ]

  const rawSev = data?.severity_distribution
  const severityDistribution = (Array.isArray(rawSev) && rawSev.length > 0)
    ? rawSev.map(d => ({
        severity: String(d.severity || 'info').toLowerCase(),
        count: Math.max(0, parseInt(d.count || '0', 10) || 0)
      }))
    : [
        { severity: 'critical', count: 4 },
        { severity: 'high', count: 12 },
        { severity: 'medium', count: 28 },
        { severity: 'low', count: 45 },
        { severity: 'info', count: 90 }
      ]

  const onLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
  };

  const generateReport = async () => {
    try {
      const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
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
                    {/* Charts Row */}
          <div key="chart_trend" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="soc-panel-title">Events Trend (24h)</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Live Telemetry</span>
            </div>
            <div style={{ width: '100%', height: 250, padding: '16px 16px 10px 16px', boxSizing: 'border-box', position: 'relative' }}>
              {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <svg viewBox="0 0 500 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="40" y1="30" x2="480" y2="30" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="40" y1="75" x2="480" y2="75" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="40" y1="120" x2="480" y2="120" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="40" y1="150" x2="480" y2="150" stroke="#334155" />
                    
                    {/* Y-Axis Labels */}
                    <text x="32" y="34" fill="#64748b" fontSize="10" textAnchor="end">2.0k</text>
                    <text x="32" y="79" fill="#64748b" fontSize="10" textAnchor="end">1.0k</text>
                    <text x="32" y="124" fill="#64748b" fontSize="10" textAnchor="end">500</text>
                    <text x="32" y="154" fill="#64748b" fontSize="10" textAnchor="end">0</text>

                    {/* Dynamic Area & Path */}
                    {(() => {
                      const dataPts = eventsTrend.length > 0 ? eventsTrend : [
                        { time_bucket: new Date().toISOString(), event_count: 100 }
                      ];
                      const maxVal = Math.max(...dataPts.map(d => Number(d.event_count) || 0), 100) || 100;
                      const widthStep = 440 / Math.max(dataPts.length - 1, 1);
                      const points = dataPts.map((d, i) => {
                        const x = 40 + i * widthStep;
                        const val = Number(d.event_count) || 0;
                        const y = 150 - Math.min(120, (val / maxVal) * 120);
                        return { x, y: isNaN(y) ? 150 : y, val, time: d.time_bucket };
                      });
                      const pathD = points.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
                      const lastX = points[points.length - 1]?.x || 480;
                      const areaD = `${pathD} L ${lastX} 150 L 40 150 Z`;

                      return (
                        <g>
                          <path d={areaD} fill="url(#trendGradient)" />
                          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                          {points.map((pt, i) => (
                            <g key={i} className="soc-chart-point">
                              <circle cx={pt.x} cy={pt.y} r="4" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
                              <text x={pt.x} y="168" fill="#64748b" fontSize="9" textAnchor="middle">
                                {(() => { try { return new Date(pt.time).getHours() + ':00'; } catch(e) { return ''; } })()}
                              </text>
                            </g>
                          ))}
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div key="chart_severity" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="soc-panel-title">Severity</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Distribution</span>
            </div>
            <div style={{ width: '100%', height: 250, padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? <div className="skeleton" style={{ width: '100%', height: '100%' }} /> : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  {/* Donut Chart */}
                  <div style={{ position: 'relative', width: 140, height: 140 }}>
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      {(() => {
                        const total = severityDistribution.reduce((acc, item) => acc + (item.count || 0), 0) || 1;
                        let cumPercent = 0;
                        return severityDistribution.map((item, idx) => {
                          const percent = (item.count || 0) / total;
                          const strokeDasharray = `${percent * 283} 283`;
                          const strokeDashoffset = -cumPercent * 283;
                          cumPercent += percent;
                          const color = COLORS[item.severity?.toLowerCase()] || COLORS.info;
                          return (
                            <circle
                              key={idx}
                              cx="50" cy="50" r="45"
                              fill="none"
                              stroke={color}
                              strokeWidth="10"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              style={{ transition: 'all 0.5s ease' }}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                        {severityDistribution.reduce((a, b) => a + (b.count || 0), 0)}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Alerts</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {severityDistribution.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[item.severity?.toLowerCase()] || COLORS.info }} />
                        <span style={{ color: '#cbd5e1', textTransform: 'capitalize', width: 60 }}>{item.severity}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
