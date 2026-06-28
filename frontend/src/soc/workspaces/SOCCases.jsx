import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'

const MOCK_CASES = [
  {
    id: 'CASE-0041',
    title: 'Credential stuffing campaign',
    type: 'Authentication Attack',
    severity: 'Critical',
    status: 'Investigating',
    assigned_to: 'J. Martinez',
    created: '2026-06-24T08:15:00Z',
    description: 'Large-scale credential stuffing attack targeting mail login endpoint. 4,200 unique IPs observed. Automated CAPTCHA bypass techniques detected.',
    events_linked: 1842,
    alerts_linked: 3,
    tags: ['credential-stuffing', 'brute-force', 'botnet'],
  },
  {
    id: 'CASE-0040',
    title: 'Suspected insider data access',
    type: 'Insider Threat',
    severity: 'High',
    status: 'Open',
    assigned_to: 'K. Patel',
    created: '2026-06-24T06:00:00Z',
    description: 'User account accessed unusually large volume of sensitive emails outside normal working hours. UEBA flagged anomalous behavior score of 94.',
    events_linked: 312,
    alerts_linked: 2,
    tags: ['insider-threat', 'ueba', 'data-access'],
  },
  {
    id: 'CASE-0039',
    title: 'Phishing email cluster',
    type: 'Phishing',
    severity: 'Medium',
    status: 'Resolved',
    assigned_to: 'R. Chen',
    created: '2026-06-23T14:30:00Z',
    description: 'Cluster of 38 phishing emails detected with lookalike domain. All emails quarantined. 2 users clicked link before quarantine; passwords reset and sessions revoked.',
    events_linked: 89,
    alerts_linked: 5,
    tags: ['phishing', 'lookalike-domain', 'email-security'],
  },
  {
    id: 'CASE-0038',
    title: 'Lateral movement via SMB',
    type: 'Lateral Movement',
    severity: 'High',
    status: 'Investigating',
    assigned_to: 'J. Martinez',
    created: '2026-06-23T11:00:00Z',
    description: 'Compromised internal host attempting lateral movement using Pass-the-Hash against multiple SMB shares. Host isolated pending forensic analysis.',
    events_linked: 567,
    alerts_linked: 4,
    tags: ['lateral-movement', 'smb', 'pass-the-hash'],
  },
  {
    id: 'CASE-0037',
    title: 'Malware C2 beaconing',
    type: 'Malware',
    severity: 'Critical',
    status: 'Resolved',
    assigned_to: 'A. Singh',
    created: '2026-06-22T09:00:00Z',
    description: 'Host identified beaconing to known C2 infrastructure every 60 seconds. Host isolated and reimaged. IOCs added to threat intel blocklist.',
    events_linked: 2201,
    alerts_linked: 7,
    tags: ['c2', 'malware', 'beacon'],
  },
]

function SeverityBadge({ severity }) {
  return <span className={`soc-badge sev-${severity?.toLowerCase()}`}>{severity}</span>
}

function StatusBadge({ status }) {
  return <span className={`soc-badge status-${status?.toLowerCase().replace(' ', '-')}`}>{status}</span>
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function CaseRow({ c }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr
        className="soc-case-row"
        onClick={() => setExpanded(v => !v)}
        style={{ cursor: 'pointer' }}
      >
        <td>
          <span className="soc-expand-icon">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </td>
        <td className="soc-td-mono soc-td-muted">{c.id}</td>
        <td>
          <div className="soc-case-title">{c.title}</div>
          <div className="soc-case-type">{c.type}</div>
        </td>
        <td><SeverityBadge severity={c.severity} /></td>
        <td><StatusBadge status={c.status} /></td>
        <td className="soc-td-muted">{c.assigned_to}</td>
        <td className="soc-td-muted soc-td-nowrap">{fmtTime(c.created)}</td>
      </tr>
      {expanded && (
        <tr className="soc-case-detail-row">
          <td colSpan={7}>
            <div className="soc-case-detail">
              <p className="soc-case-description">{c.description}</p>
              <div className="soc-case-meta-row">
                <div className="soc-case-meta-item">
                  <span className="soc-case-meta-label">Events Linked</span>
                  <span className="soc-case-meta-value">{c.events_linked?.toLocaleString()}</span>
                </div>
                <div className="soc-case-meta-item">
                  <span className="soc-case-meta-label">Alerts Linked</span>
                  <span className="soc-case-meta-value">{c.alerts_linked}</span>
                </div>
                <div className="soc-case-meta-item">
                  <span className="soc-case-meta-label">Tags</span>
                  <span className="soc-case-meta-value">
                    {c.tags?.map(t => (
                      <span key={t} className="soc-tag">{t}</span>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SOCCases() {
  const [cases, setCases] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCases = useCallback(async () => {
    setError(null)
    try {
      const token = sessionStorage.getItem('caspmail_access_token')
      const res = await fetch('/api/v4/soc/cases', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCases(json.data || json.cases || [])
    } catch (err) {
      if (import.meta.env.DEV) {
        setCases(MOCK_CASES)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCases() }, [fetchCases])

  if (error) {
    return (
      <div className="soc-error-state">
        <AlertTriangle size={36} />
        <p>Failed to load cases</p>
        <p className="soc-error-detail">{error}</p>
        <button className="soc-btn soc-btn-primary" onClick={fetchCases}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Cases</h2>
        <button className="soc-btn soc-btn-ghost" onClick={fetchCases} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="soc-panel">
        {loading ? (
          <table className="soc-table">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[20, 90, 200, 80, 100, 80, 130].map((w, j) => (
                    <td key={j}><div className="skeleton" style={{ width: w, height: 12 }} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : !cases || cases.length === 0 ? (
          <div className="soc-empty-state">
            <FolderOpen size={32} />
            <p>No cases found.</p>
          </div>
        ) : (
          <table className="soc-table soc-cases-table">
            <thead>
              <tr>
                <th style={{ width: 24 }} />
                <th>Case ID</th>
                <th>Title / Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => <CaseRow key={c.id} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
