import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Circle } from 'lucide-react'

const SEVERITIES = ['All', 'Critical', 'High', 'Medium', 'Low']
const STATUSES = ['All', 'Active', 'Open', 'Acknowledged', 'Resolved']

const MOCK_ALERTS = [
  { id: 'al-001', severity: 'Critical', message: 'Brute-force login detected from external IP', source_ip: '185.220.101.45', type: 'Authentication', time: '2026-06-24T10:02:00Z', status: 'Open' },
  { id: 'al-002', severity: 'Critical', message: 'C2 beacon pattern detected in DNS queries', source_ip: '10.0.4.88', type: 'C2 Communication', time: '2026-06-24T09:55:00Z', status: 'Open' },
  { id: 'al-003', severity: 'Critical', message: 'Ransomware file pattern detected on file server', source_ip: '10.0.1.5', type: 'Malware', time: '2026-06-24T09:40:00Z', status: 'Acknowledged' },
  { id: 'al-004', severity: 'High', message: 'Unusual outbound data transfer volume', source_ip: '10.0.1.14', type: 'Exfiltration', time: '2026-06-24T09:31:00Z', status: 'Acknowledged' },
  { id: 'al-005', severity: 'High', message: 'Malware signature matched in email attachment', source_ip: '10.0.2.33', type: 'Malware', time: '2026-06-24T09:14:00Z', status: 'Open' },
  { id: 'al-006', severity: 'High', message: 'Privilege escalation attempt on linux host', source_ip: '10.0.3.17', type: 'Privilege Escalation', time: '2026-06-24T08:58:00Z', status: 'Open' },
  { id: 'al-007', severity: 'Medium', message: 'Multiple failed MFA attempts', source_ip: '172.16.0.5', type: 'Authentication', time: '2026-06-24T08:47:00Z', status: 'Open' },
  { id: 'al-008', severity: 'Medium', message: 'Suspicious PowerShell execution detected', source_ip: '10.0.2.11', type: 'Execution', time: '2026-06-24T08:30:00Z', status: 'Resolved' },
  { id: 'al-009', severity: 'Medium', message: 'Unusual login time for privileged account', source_ip: '192.168.1.20', type: 'Authentication', time: '2026-06-24T08:10:00Z', status: 'Acknowledged' },
  { id: 'al-010', severity: 'Low', message: 'Port scan detected from internal host', source_ip: '10.0.3.22', type: 'Reconnaissance', time: '2026-06-24T07:55:00Z', status: 'Resolved' },
  { id: 'al-011', severity: 'Low', message: 'Self-signed certificate presented by external server', source_ip: '203.0.113.55', type: 'Network', time: '2026-06-24T07:30:00Z', status: 'Resolved' },
]

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function SeverityDot({ severity }) {
  return (
    <span className={`soc-sev-dot sev-${severity?.toLowerCase()}`}>
      <Circle size={8} fill="currentColor" />
      {severity}
    </span>
  )
}

function StatusBadge({ status }) {
  return <span className={`soc-badge status-${status?.toLowerCase()}`}>{status}</span>
}

export default function SOCAlerts() {
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sevFilter, setSevFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Active')

  const fetchAlerts = useCallback(async () => {
    setError(null)
    try {
      const token = window.memoryStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setAlerts(json.data || json.alerts || [])
    } catch (err) {
      if (import.meta.env.DEV) {
        setAlerts(MOCK_ALERTS)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function updateStatus(id, newStatus) {
    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    try {
      const token = window.memoryStorage.getItem('caspmail_access_token')
      const res = await fetch(`/api/v4/soc/alerts/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus.toLowerCase() }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch {
      // Revert on failure
      fetchAlerts()
    }
  }

  const displayed = (alerts || []).filter(a => {
    if (sevFilter !== 'All' && a.severity?.toLowerCase() !== sevFilter.toLowerCase()) return false
    if (statusFilter === 'Active') {
      if (a.status?.toLowerCase() === 'resolved') return false
    } else if (statusFilter !== 'All' && a.status?.toLowerCase() !== statusFilter.toLowerCase()) {
      return false
    }
    return true
  })

  if (error) {
    return (
      <div className="soc-error-state">
        <AlertTriangle size={36} />
        <p>Failed to load alerts</p>
        <p className="soc-error-detail">{error}</p>
        <button className="soc-btn soc-btn-primary" onClick={fetchAlerts}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Alerts</h2>
        <button className="soc-btn soc-btn-ghost" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="soc-filter-bar">
        <div className="soc-filter-group">
          <span className="soc-filter-label">Severity</span>
          {SEVERITIES.map(s => (
            <button
              key={s}
              className={`soc-filter-btn${sevFilter === s ? ' active' : ''}${s !== 'All' ? ` sev-filter-${s.toLowerCase()}` : ''}`}
              onClick={() => setSevFilter(s)}
            >{s}</button>
          ))}
        </div>
        <div className="soc-filter-group">
          <span className="soc-filter-label">Status</span>
          {STATUSES.map(s => (
            <button
              key={s}
              className={`soc-filter-btn${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >{s}</button>
          ))}
        </div>
        <span className="soc-filter-count">{displayed.length} alert{displayed.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="soc-panel">
        {loading ? (
          <table className="soc-table">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[120, 280, 100, 90, 80, 140].map((w, j) => (
                    <td key={j}><div className="skeleton" style={{ width: w, height: 12 }} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : displayed.length === 0 ? (
          <div className="soc-empty-state">
            <CheckCircle size={32} />
            <p>No alerts match the current filters.</p>
          </div>
        ) : (
          <table className="soc-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Message</th>
                <th>Source IP</th>
                <th>Type</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(a => (
                <tr key={a.id} className={`soc-alert-row sev-row-${a.severity?.toLowerCase()}`}>
                  <td><SeverityDot severity={a.severity} /></td>
                  <td className="soc-td-wrap">{a.message}</td>
                  <td className="soc-td-mono">{a.source_ip}</td>
                  <td className="soc-td-mono">{a.type}</td>
                  <td className="soc-td-muted soc-td-nowrap">{fmtTime(a.time)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="soc-action-btns">
                      {a.status === 'Open' && (
                        <button
                          className="soc-btn soc-btn-ghost soc-btn-sm"
                          onClick={() => updateStatus(a.id, 'Acknowledged')}
                        >
                          <CheckCircle size={13} /> Acknowledge
                        </button>
                      )}
                      {a.status !== 'Resolved' && (
                        <button
                          className="soc-btn soc-btn-ghost soc-btn-sm"
                          onClick={() => updateStatus(a.id, 'Resolved')}
                        >
                          <XCircle size={13} /> Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
