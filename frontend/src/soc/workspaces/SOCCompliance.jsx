import React, { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { authFetch } from '../../auth/tokenRefresh.js'

const FRAMEWORKS = [
  {
    id: 'nis2',
    name: 'NIS2',
    fullName: 'Network and Information Security Directive 2',
    controls: [
      { id: 'nis2-1', title: 'Risk Management', description: 'Policies on risk analysis and information system security', category: 'Governance' },
      { id: 'nis2-2', title: 'Incident Handling', description: 'Incident handling and reporting procedures in place', category: 'Response' },
      { id: 'nis2-3', title: 'Business Continuity', description: 'Backup management, disaster recovery, crisis management', category: 'Resilience' },
      { id: 'nis2-4', title: 'Supply Chain Security', description: 'Security in supply chains including third-party providers', category: 'Supply Chain' },
      { id: 'nis2-5', title: 'Secure Development', description: 'Security in network and information systems acquisition, development and maintenance', category: 'Development' },
      { id: 'nis2-6', title: 'Vulnerability Handling', description: 'Policies and procedures for vulnerability disclosure and handling', category: 'Vulnerability' },
      { id: 'nis2-7', title: 'Cyber Hygiene', description: 'Basic cyber hygiene practices and cybersecurity training', category: 'Training' },
      { id: 'nis2-8', title: 'Cryptography', description: 'Policies and procedures on the use of cryptography and encryption', category: 'Cryptography' },
      { id: 'nis2-9', title: 'Access Control', description: 'Human resources security, access control policies and asset management', category: 'Access' },
      { id: 'nis2-10', title: 'Multi-Factor Authentication', description: 'Use of multi-factor authentication and single sign-on solutions', category: 'Access' },
    ],
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    controls: [
      { id: 'gdpr-1', title: 'Data Processing Records', description: 'Maintain records of all data processing activities (Art. 30)', category: 'Documentation' },
      { id: 'gdpr-2', title: 'Lawful Basis', description: 'Identify and document lawful basis for all processing (Art. 6)', category: 'Legal' },
      { id: 'gdpr-3', title: 'Data Subject Rights', description: 'Processes for handling DSR: access, erasure, portability (Art. 15-22)', category: 'Rights' },
      { id: 'gdpr-4', title: 'Data Protection by Design', description: 'Privacy by design and by default implemented (Art. 25)', category: 'Design' },
      { id: 'gdpr-5', title: 'Breach Notification', description: '72-hour breach notification process to supervisory authority (Art. 33)', category: 'Incident' },
      { id: 'gdpr-6', title: 'DPA Agreements', description: 'Data Processing Agreements with all processors (Art. 28)', category: 'Legal' },
      { id: 'gdpr-7', title: 'Data Retention', description: 'Data retention and deletion policies in place (Art. 5(1)(e))', category: 'Retention' },
      { id: 'gdpr-8', title: 'Technical Measures', description: 'Appropriate technical and organisational measures (Art. 32)', category: 'Security' },
    ],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    fullName: 'Information Security Management System',
    controls: [
      { id: 'iso-1', title: 'Information Security Policies', description: 'Management direction for information security (A.5)', category: 'Policy' },
      { id: 'iso-2', title: 'Asset Management', description: 'Inventory and classification of information assets (A.8)', category: 'Assets' },
      { id: 'iso-3', title: 'Access Control', description: 'Limiting access to information and information systems (A.9)', category: 'Access' },
      { id: 'iso-4', title: 'Cryptography', description: 'Proper use of cryptographic controls (A.10)', category: 'Cryptography' },
      { id: 'iso-5', title: 'Physical Security', description: 'Preventing unauthorized access to premises and equipment (A.11)', category: 'Physical' },
      { id: 'iso-6', title: 'Operations Security', description: 'Secure operations of information processing facilities (A.12)', category: 'Operations' },
      { id: 'iso-7', title: 'Communications Security', description: 'Protection of information in networks (A.13)', category: 'Network' },
      { id: 'iso-8', title: 'Supplier Relationships', description: 'Protection of assets accessible by suppliers (A.15)', category: 'Supply Chain' },
      { id: 'iso-9', title: 'Incident Management', description: 'Consistent and effective approach to security incidents (A.16)', category: 'Incident' },
      { id: 'iso-10', title: 'Compliance', description: 'Avoiding breaches of legal and regulatory obligations (A.18)', category: 'Compliance' },
    ],
  },
]

const STATUS_OPTIONS = ['compliant', 'partial', 'non_compliant', 'not_assessed']
const STATUS_LABEL = { compliant: 'Compliant', partial: 'Partial', non_compliant: 'Non-Compliant', not_assessed: 'Not Assessed' }
const STATUS_COLOR = { compliant: '#22c55e', partial: '#f59e0b', non_compliant: '#ef4444', not_assessed: '#64748b' }
const STATUS_ICON = {
  compliant: CheckCircle,
  partial: Clock,
  non_compliant: XCircle,
  not_assessed: AlertCircle,
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#64748b'
  const label = STATUS_LABEL[status] || status
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      padding: '2px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function ScoreRing({ score, total }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const r = 30, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={r} fill="none" stroke="#1a2535" strokeWidth={7} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
        <text x={40} y={44} textAnchor="middle" fill={color} fontSize={16} fontWeight={700}>{pct}%</text>
      </svg>
      <span style={{ fontSize: '.72rem', color: '#7f8ea3' }}>{score}/{total} controls</span>
    </div>
  )
}

export default function SOCCompliance() {
  const [framework, setFramework] = useState('nis2')
  const [statuses, setStatuses] = useState({}) // { controlId: status }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const fw = FRAMEWORKS.find(f => f.id === framework)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/soc/compliance/${framework}`)
      if (res.ok) {
        const d = await res.json()
        setStatuses(d.statuses || {})
      } else if (res.status === 404) {
        setStatuses({})
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (err) {
      // If API not implemented yet, use empty state gracefully
      setStatuses({})
    } finally {
      setLoading(false)
    }
  }, [framework])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(controlId, newStatus) {
    setSaving(controlId)
    const updated = { ...statuses, [controlId]: newStatus }
    setStatuses(updated)
    try {
      await authFetch(`/api/soc/compliance/${framework}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ control_id: controlId, status: newStatus }),
      })
    } catch {
      // Optimistic update — silently ignore save errors
    } finally {
      setSaving(null)
    }
  }

  const compliant = fw.controls.filter(c => statuses[c.id] === 'compliant').length
  const partial = fw.controls.filter(c => statuses[c.id] === 'partial').length
  const nonCompliant = fw.controls.filter(c => statuses[c.id] === 'non_compliant').length
  const notAssessed = fw.controls.filter(c => !statuses[c.id] || statuses[c.id] === 'not_assessed').length

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Compliance — Control Status</h2>
        <button className="soc-btn soc-btn-ghost" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Framework selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--gap)' }}>
        {FRAMEWORKS.map(f => (
          <button
            key={f.id}
            className={`soc-btn ${framework === f.id ? 'soc-btn-primary' : 'soc-btn-ghost'}`}
            onClick={() => setFramework(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Score row */}
      <div className="soc-panel" style={{ marginBottom: 'var(--gap)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '.8rem', color: '#7f8ea3', marginBottom: 4 }}>Framework</div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{fw.fullName}</div>
          </div>
          <ScoreRing score={compliant} total={fw.controls.length} />
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              ['Compliant', compliant, '#22c55e'],
              ['Partial', partial, '#f59e0b'],
              ['Non-Compliant', nonCompliant, '#ef4444'],
              ['Not Assessed', notAssessed, '#64748b'],
            ].map(([label, count, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: '.7rem', color: '#7f8ea3' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls table */}
      <div className="soc-panel">
        <div className="soc-panel-header">
          <h3 className="soc-panel-title"><ShieldCheck size={14} /> Controls — {fw.name}</h3>
        </div>
        {loading
          ? <div style={{ padding: 16 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 8 }} />)}</div>
          : (
            <table className="soc-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Control</th>
                  <th style={{ width: 120 }}>Category</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th style={{ width: 200 }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {fw.controls.map((ctrl, i) => {
                  const st = statuses[ctrl.id] || 'not_assessed'
                  const Icon = STATUS_ICON[st] || AlertCircle
                  return (
                    <tr key={ctrl.id}>
                      <td className="soc-td-muted" style={{ fontSize: '.78rem' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '.84rem', marginBottom: 2 }}>{ctrl.title}</div>
                        <div style={{ fontSize: '.74rem', color: '#7f8ea3' }}>{ctrl.description}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '.72rem', color: '#94a3b8', background: '#0f1929', border: '1px solid #1a2535', padding: '2px 8px', borderRadius: 6 }}>
                          {ctrl.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={13} style={{ color: STATUS_COLOR[st], flexShrink: 0 }} />
                          <StatusBadge status={st} />
                        </div>
                      </td>
                      <td>
                        <select
                          value={st}
                          onChange={e => handleStatusChange(ctrl.id, e.target.value)}
                          disabled={saving === ctrl.id}
                          style={{
                            background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0',
                            borderRadius: 6, padding: '4px 8px', fontSize: '.78rem',
                            opacity: saving === ctrl.id ? 0.5 : 1, cursor: 'pointer',
                          }}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
