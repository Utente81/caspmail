import React, { useState, useEffect } from 'react'
import { Server, Search, Loader2 } from 'lucide-react'
import { fetchAuth } from '../../utils/api'

export default function SOCITAM() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAssets()
  }, [])

  async function loadAssets() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAuth('/api/soc/assets')
      setAssets(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateAsset(id, updates) {
    try {
      await fetchAuth(`/api/soc/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      })
      loadAssets()
    } catch (err) {
      alert('Error updating asset: ' + err.message)
    }
  }

  const getRiskColor = (risk) => {
    switch (risk) {
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
          <h2>IT Asset Management (ITAM)</h2>
          <p className="soc-subtext">Autodiscovered assets from authentication and network logs.</p>
        </div>
      </div>

      <div className="soc-card">
        <div className="soc-card-header">
          <div className="soc-search-box">
            <Search size={14} />
            <input type="text" placeholder="Search IP or device..." />
          </div>
        </div>

        {error && <div className="soc-error-banner">{error}</div>}

        {loading ? (
          <div className="soc-empty">
            <Loader2 className="soc-spinner" size={24} />
            <p>Loading assets...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="soc-empty">
            <Server size={32} />
            <p>No Assets autodiscovered yet.</p>
          </div>
        ) : (
          <div className="soc-table-container">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Device / User-Agent</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td className="soc-fw-medium" style={{fontFamily: 'monospace'}}>{a.ip_address}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.device_type}>
                      {a.device_type || 'Unknown'}
                    </td>
                    <td>
                      <span className={`soc-badge ${getRiskColor(a.risk_level)}`}>
                        {a.risk_level.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`soc-badge ${a.status === 'active' ? 'success' : 'neutral'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>{new Date(a.last_seen).toLocaleString()}</td>
                    <td>
                      <select 
                        className="soc-input" 
                        value={a.risk_level}
                        onChange={(e) => updateAsset(a.id, { risk_level: e.target.value })}
                        style={{ padding: '2px 6px', fontSize: '11px', height: 'auto', display: 'inline-block', width: 'auto' }}
                      >
                        <option value="low">Low Risk</option>
                        <option value="medium">Medium Risk</option>
                        <option value="high">High Risk</option>
                        <option value="critical">Critical Risk</option>
                      </select>
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
