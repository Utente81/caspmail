import React, { useState, useEffect } from 'react'
import { MapPin, ShieldAlert, BadgeCheck, Loader2 } from 'lucide-react'
import { fetchAuth } from '../../utils/api'

export default function SOCPhysical() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [simEmail, setSimEmail] = useState('admin@caspermail.it')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAuth('/api/soc/physical-access')
      setLogs(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function simulateAnomaly() {
    try {
      // Hardcoded 'London' will trigger the UEBA Anomaly since it's far from Italy
      const res = await fetchAuth('/api/soc/physical-access', {
        method: 'POST',
        body: JSON.stringify({
          user_email: simEmail,
          location: 'London',
          action: 'entry',
          reader_id: 'Turnstile-LHR-01'
        })
      })
      if (res.anomaly) {
        alert('CRITICAL: UEBA Anomaly Detected! A SOC Event and Alert have been generated for Impossible Travel.')
      } else {
        alert('Access logged. No anomalies detected.')
      }
      loadLogs()
    } catch (err) {
      alert('Simulation failed: ' + err.message)
    }
  }

  async function simulateNormal() {
    try {
      const res = await fetchAuth('/api/soc/physical-access', {
        method: 'POST',
        body: JSON.stringify({
          user_email: simEmail,
          location: 'Rome',
          action: 'entry',
          reader_id: 'Turnstile-ROM-02'
        })
      })
      alert('Access logged. No anomalies detected.')
      loadLogs()
    } catch (err) {
      alert('Simulation failed: ' + err.message)
    }
  }

  return (
    <div className="soc-workspace">
      <div className="soc-workspace-header">
        <div>
          <h2>Physical Security & Badge Anomaly</h2>
          <p className="soc-subtext">Monitor physical badge entries and detect UEBA Impossible Travel anomalies.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="email" 
            className="soc-input" 
            value={simEmail} 
            onChange={e => setSimEmail(e.target.value)} 
            placeholder="User Email"
          />
          <button className="soc-btn success" onClick={simulateNormal}>
            <BadgeCheck size={14} /> Simulate Normal (Rome)
          </button>
          <button className="soc-btn danger" onClick={simulateAnomaly}>
            <ShieldAlert size={14} /> Simulate Anomaly (London)
          </button>
        </div>
      </div>

      <div className="soc-card">
        {error && <div className="soc-error-banner">{error}</div>}

        {loading ? (
          <div className="soc-empty">
            <Loader2 className="soc-spinner" size={24} />
            <p>Loading physical access logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="soc-empty">
            <MapPin size={32} />
            <p>No badge access logs available.</p>
          </div>
        ) : (
          <div className="soc-table-container">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User Email</th>
                  <th>Location</th>
                  <th>Reader ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="soc-fw-medium">{log.user_email}</td>
                    <td>
                      <MapPin size={12} style={{marginRight: '5px'}}/>
                      {log.location}
                    </td>
                    <td>{log.reader_id}</td>
                    <td>
                      <span className={`soc-badge ${log.action === 'entry' ? 'success' : 'neutral'}`}>
                        {log.action.toUpperCase()}
                      </span>
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
