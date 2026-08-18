import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  let str = String(dateString);
  if (str && !str.includes('T')) str = str.replace(' ', 'T');
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'N/A';
  }
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

  const kpis = data?.kpis || MOCK_DATA.kpis
  const alerts = (data?.recent_alerts && data.recent_alerts.length > 0) ? data.recent_alerts : MOCK_DATA.recent_alerts
  const cases = (data?.recent_cases && data.recent_cases.length > 0) ? data.recent_cases : MOCK_DATA.recent_cases
  const health = (data?.system_health && data.system_health.length > 0) ? data.system_health : MOCK_DATA.system_health

  // ─── Pure SVG Vector Calculations using useMemo Hooks ───────────────────────
  const trendPoints = useMemo(() => {
    const raw = (data?.events_trend && data.events_trend.length > 0)
      ? data.events_trend
      : MOCK_DATA.events_trend;

    const dataPts = raw.map(d => {
      let count = parseInt(d.event_count || d.count || '0', 10);
      if (isNaN(count)) count = 0;
      let timeStr = String(d.time_bucket || '');
      if (timeStr && !timeStr.includes('T')) {
        timeStr = timeStr.replace(' ', 'T');
      }
      let hourLabel = '';
      try {
        const dt = new Date(timeStr);
        if (!isNaN(dt.getTime())) {
          hourLabel = dt.getHours().toString().padStart(2, '0') + ':00';
        }
      } catch (e) {
        hourLabel = '';
      }
      return { count, hourLabel };
    });

    const maxVal = Math.max(...dataPts.map(p => p.count), 100) || 100;
    const widthStep = 440 / Math.max(dataPts.length - 1, 1);

    const pts = dataPts.map((p, i) => {
      const x = 40 + i * widthStep;
      const y = 150 - Math.min(120, (p.count / maxVal) * 120);
      return { x: isNaN(x) ? 40 : x, y: isNaN(y) ? 150 : y, count: p.count, label: p.hourLabel };
    });

    const pathD = pts.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
    const lastX = pts[pts.length - 1]?.x || 480;
    const areaD = pts.length > 0 ? `${pathD} L ${lastX} 150 L 40 150 Z` : 'M 40 150 L 480 150 Z';

    return { pts, pathD, areaD };
  }, [data]);

  const sevSegments = useMemo(() => {
    const raw = (data?.severity_distribution && data.severity_distribution.length > 0)
      ? data.severity_distribution
      : MOCK_DATA.severity_distribution;

    const items = raw.map(d => ({
      severity: String(d.severity || 'info').toLowerCase(),
      count: Math.max(0, parseInt(d.count || '0', 10) || 0)
    }));

    const total = items.reduce((a, b) => a + b.count, 0) || 1;
    let cumPercent = 0;

    const segments = items.map(item => {
      const percent = item.count / total;
      const strokeDasharray = `${(percent * 283).toFixed(1)} 283`;
      const strokeDashoffset = (-cumPercent * 283).toFixed(1);
      cumPercent += percent;
      const color = COLORS[item.severity] || COLORS.info;
      return { ...item, strokeDasharray, strokeDashoffset, color };
    });

    return { segments, total };
  }, [data]);

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

                    {/* Area & Path */}
                    {trendPoints.areaD && <path d={trendPoints.areaD} fill="url(#trendGradient)" />}
                    {trendPoints.pathD && <path d={trendPoints.pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />}
                    {trendPoints.pts.map((pt, i) => (
                      <g key={i} className="soc-chart-point">
                        <circle cx={pt.x} cy={pt.y} r="4" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
                        {pt.label && (
                          <text x={pt.x} y="168" fill="#64748b" fontSize="9" textAnchor="middle">
                            {pt.label}
                          </text>
                        )}
                      </g>
                    ))}
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
                      {sevSegments.segments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="50" cy="50" r="45"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="10"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          style={{ transition: 'all 0.5s ease' }}
                        />
                      ))}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                        {sevSegments.total}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Alerts</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sevSegments.segments.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                        <span style={{ color: '#cbd5e1', textTransform: 'capitalize', width: 60 }}>{item.severity}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table: Recent Alerts */}
          <div key="table_alerts" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Recent Alerts</h3></div>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              {loading ? <TableSkeleton rows={5} cols={5} /> : alerts.length === 0 ? (
                <div className="soc-empty-state"><p>No recent alerts</p></div>
              ) : (
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Message</th>
                      <th>Type</th>
                      <th>Source IP</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id}>
                        <td><SeverityBadge severity={a.severity} /></td>
                        <td style={{ fontWeight: 500 }}>{a.message}</td>
                        <td style={{ color: 'var(--muted)' }}>{a.event_type || a.type || 'N/A'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.source_ip || 'N/A'}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{formatDate(a.created_at || a.time)}</td>
                        <td><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Table: Active Cases */}
          <div key="table_cases" className={`soc-panel ${isEditable?'edit-mode':''}`}>
            <div className="soc-panel-header"><h3 className="soc-panel-title">Active Cases</h3></div>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              {loading ? <TableSkeleton rows={3} cols={5} /> : cases.length === 0 ? (
                <div className="soc-empty-state"><p>No active cases</p></div>
              ) : (
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{c.id}</td>
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                        <td><SeverityBadge severity={c.severity} /></td>
                        <td><StatusBadge status={c.status} /></td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.assigned_to || 'Unassigned'}</td>
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
            <div style={{ padding: '8px 16px', flex: 1, overflowY: 'auto' }}>
              {loading ? <TableSkeleton rows={5} cols={2} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {health.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < health.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</span>
                      <span className={`soc-badge status-${item.status?.toLowerCase()}`}>{item.status}</span>
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
