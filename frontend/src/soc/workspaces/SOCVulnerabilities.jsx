import React, { useState, useEffect } from 'react'
import { Bug, Search, Loader2, Play } from 'lucide-react'
import { fetchAuth } from '../../utils/api'

export default function SOCVulnerabilities() {
  const [vulns, setVulns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadVulns()
  }, [])

  async function loadVulns() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAuth('/api/soc/vulnerabilities')
      setVulns(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function triggerScan() {
    try {
      setScanning(true)
      await fetchAuth('/api/soc/vulnerabilities/scan', { method: 'POST' })
      await loadVulns()
    } catch (err) {
      alert('Scan failed: ' + err.message)
    } finally {
      setScanning(false)
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await fetchAuth(`/api/soc/vulnerabilities/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })
      loadVulns()
    } catch (err) {
      alert('Error updating status: ' + err.message)
    }
  }

  const getSevColor = (sev) => {
    switch (sev) {
      case 'critical': return 'danger'
      case 'high': return 'warning'
      case 'medium': return 'primary'
      case 'low': return 'success'
      default: return 'neutral'
    }
  }

  return (
    <div className="soc-workspace">
      <div className="soc-workspace-header">
        <div>
          <h2>Vulnerability & SBOM Management</h2>
          <p className="soc-subtext">Track CVEs across software components and manage patching workflows.</p>
        </div>
        <button className="soc-btn danger" onClick={triggerScan} disabled={scanning}>
          {scanning ? <Loader2 size={14} className="soc-spinner" /> : <Play size={14} />} 
          Run SBOM Scan
        </button>
      </div>

      <div className="soc-card">
        <div className="soc-card-header">
          <div className="soc-search-box">
            <Search size={14} />
            <input type="text" placeholder="Search CVE or component..." />
          </div>
        </div>

        {error && <div className="soc-error-banner">{error}</div>}

        {loading ? (
          <div className="soc-empty">
            <Loader2 className="soc-spinner" size={24} />
            <p>Loading vulnerabilities...</p>
          </div>
        ) : vulns.length === 0 ? (
          <div className="soc-empty">
            <Bug size={32} />
            <p>No Vulnerabilities found. Run a scan to populate.</p>
          </div>
        ) : (
          <div className="soc-table-container">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>CVE ID</th>
                  <th>Component</th>
                  <th>Severity</th>
                  <th>CVSS Score</th>
                  <th>Status</th>
                  <th>Discovered At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vulns.map(v => (
                  <tr key={v.id}>
                    <td className="soc-fw-medium">{v.cve_id}</td>
                    <td style={{fontFamily: 'monospace', fontSize: '12px'}}>{v.component}</td>
                    <td>
                      <span className={`soc-badge ${getSevColor(v.severity)}`}>
                        {v.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>{v.cvss_score}</td>
                    <td>
                      <span className={`soc-badge ${v.status === 'open' ? 'danger' : 'success'}`}>
                        {v.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{new Date(v.created_at).toLocaleDateString()}</td>
                    <td>
                      {v.status === 'open' ? (
                        <button className="soc-btn neutral" onClick={() => updateStatus(v.id, 'mitigated')}>Mark Mitigated</button>
                      ) : (
                        <button className="soc-btn neutral" onClick={() => updateStatus(v.id, 'open')}>Re-open</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
