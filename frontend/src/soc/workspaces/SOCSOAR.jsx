import React, { useState, useEffect, useCallback } from 'react'
import { Zap, RefreshCw, AlertCircle, Play, Pause, Plus, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, Trash2, Edit3 } from 'lucide-react'
import { authFetch } from '../../auth/tokenRefresh.js'

const TRIGGER_TYPES = [
  { value: 'alert_critical', label: 'Alert: Critical severity' },
  { value: 'alert_high',     label: 'Alert: High severity' },
  { value: 'ueba_risk_75',   label: 'UEBA: Risk score ≥ 75' },
  { value: 'ueba_risk_50',   label: 'UEBA: Risk score ≥ 50' },
  { value: 'login_failure',  label: 'Multiple login failures' },
  { value: 'manual',         label: 'Manual trigger only' },
]

const ACTION_TYPES = [
  { value: 'webhook',        label: 'HTTP Webhook POST' },
  { value: 'disable_user',   label: 'Disable user account' },
  { value: 'block_ip',       label: 'Block source IP' },
  { value: 'create_case',    label: 'Create SOC Case' },
  { value: 'send_email',     label: 'Send email alert' },
  { value: 'slack_notify',   label: 'Slack notification' },
]

const STATUS_COLOR = { active: '#22c55e', inactive: '#64748b', error: '#ef4444' }
const RUN_COLOR    = { success: '#22c55e', failure: '#ef4444', running: '#f59e0b', pending: '#64748b' }
const RUN_ICON     = { success: CheckCircle, failure: XCircle, running: Clock, pending: Clock }

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#64748b'
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      padding: '2px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 700,
    }}>{status}</span>
  )
}

function RunBadge({ status }) {
  const color = RUN_COLOR[status] || '#64748b'
  const Icon = RUN_ICON[status] || Clock
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontSize: '.75rem', fontWeight: 600 }}>
      <Icon size={12} /> {status}
    </span>
  )
}

function PlaybookForm({ initial, onSave, onCancel }) {
  const [name, setName]       = useState(initial?.name || '')
  const [trigger, setTrigger] = useState(initial?.trigger_type || 'alert_critical')
  const [action, setAction]   = useState(initial?.action_type || 'create_case')
  const [config, setConfig]   = useState(initial?.config ? JSON.stringify(initial.config, null, 2) : '{}')
  const [enabled, setEnabled] = useState(initial?.status !== 'inactive')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    let parsedConfig
    try { parsedConfig = JSON.parse(config) } catch { setErr('Config must be valid JSON'); return }
    setSaving(true)
    try {
      const body = {
        name, trigger_type: trigger, action_type: action,
        config: parsedConfig, status: enabled ? 'active' : 'inactive',
      }
      const url = initial ? `/api/soc/soar/playbooks/${initial.id}` : '/api/soc/soar/playbooks'
      const res = await authFetch(url, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      onSave(d)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: '#0f1929', border: '1px solid #1a2535', color: '#e2e8f0',
    borderRadius: 8, padding: '8px 12px', fontSize: '.83rem', fontFamily: 'inherit',
    outline: 'none', width: '100%',
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ fontSize: '.75rem', color: '#7f8ea3', display: 'block', marginBottom: 4 }}>Playbook name</label>
        <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. Auto-block critical alerts" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: '.75rem', color: '#7f8ea3', display: 'block', marginBottom: 4 }}>Trigger</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value)} style={inputStyle}>
            {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '.75rem', color: '#7f8ea3', display: 'block', marginBottom: 4 }}>Action</label>
          <select value={action} onChange={e => setAction(e.target.value)} style={inputStyle}>
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: '.75rem', color: '#7f8ea3', display: 'block', marginBottom: 4 }}>
          Config (JSON) — e.g. {`{"url":"https://hooks.example.com/..."}`}
        </label>
        <textarea
          value={config}
          onChange={e => setConfig(e.target.value)}
          rows={4}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '.78rem', resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.83rem' }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Enable playbook
        </label>
      </div>
      {err && <div style={{ color: '#fca5a5', fontSize: '.8rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="soc-btn soc-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update Playbook' : 'Create Playbook'}
        </button>
        <button type="button" className="soc-btn soc-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PlaybookRow({ pb, onToggle, onDelete, onEdit, onRun }) {
  const [expanded, setExpanded] = useState(false)
  const [runs, setRuns]         = useState(null)
  const [loadingRuns, setLoadingRuns] = useState(false)

  async function loadRuns() {
    if (expanded) { setExpanded(false); return }
    setLoadingRuns(true)
    try {
      const res = await authFetch(`/api/soc/soar/playbooks/${pb.id}/runs?limit=10`)
      const d = await res.json()
      setRuns(d.data || [])
      setExpanded(true)
    } catch {
      setRuns([])
      setExpanded(true)
    } finally {
      setLoadingRuns(false)
    }
  }

  const triggerLabel = TRIGGER_TYPES.find(t => t.value === pb.trigger_type)?.label || pb.trigger_type
  const actionLabel  = ACTION_TYPES.find(a => a.value === pb.action_type)?.label  || pb.action_type

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={loadRuns}>
        <td style={{ fontWeight: 600, fontSize: '.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={13} style={{ color: pb.status === 'active' ? '#22c55e' : '#64748b', flexShrink: 0 }} />
            {pb.name}
          </div>
        </td>
        <td style={{ fontSize: '.78rem', color: '#94a3b8' }}>{triggerLabel}</td>
        <td style={{ fontSize: '.78rem', color: '#94a3b8' }}>{actionLabel}</td>
        <td><StatusBadge status={pb.status} /></td>
        <td className="soc-td-muted" style={{ fontSize: '.73rem' }}>
          {pb.last_run_at ? new Date(pb.last_run_at).toLocaleString() : 'Never'}
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="soc-btn soc-btn-ghost" style={{ padding: '3px 8px', fontSize: '.72rem' }}
              onClick={() => onRun(pb.id)} title="Run now">
              <Play size={11} /> Run
            </button>
            <button className="soc-btn soc-btn-ghost" style={{ padding: '3px 8px', fontSize: '.72rem' }}
              onClick={() => onToggle(pb)} title={pb.status === 'active' ? 'Disable' : 'Enable'}>
              {pb.status === 'active' ? <Pause size={11} /> : <Play size={11} />}
            </button>
            <button className="soc-btn soc-btn-ghost" style={{ padding: '3px 8px', fontSize: '.72rem' }}
              onClick={() => onEdit(pb)} title="Edit">
              <Edit3 size={11} />
            </button>
            <button className="soc-btn soc-btn-ghost" style={{ padding: '3px 8px', fontSize: '.72rem', color: '#ef4444' }}
              onClick={() => onDelete(pb.id)} title="Delete">
              <Trash2 size={11} />
            </button>
          </div>
        </td>
        <td style={{ width: 24 }}>
          {loadingRuns
            ? <Clock size={13} style={{ color: '#7f8ea3' }} />
            : expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          }
        </td>
      </tr>
      {expanded && runs && (
        <tr>
          <td colSpan={7} style={{ background: '#080e1a', padding: '12px 20px' }}>
            <div style={{ fontSize: '.75rem', color: '#7f8ea3', marginBottom: 8, fontWeight: 600 }}>Recent runs</div>
            {runs.length === 0
              ? <div style={{ color: '#7f8ea3', fontSize: '.78rem' }}>No runs yet</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {runs.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '8px 12px', background: '#0b1220', borderRadius: 6 }}>
                      <RunBadge status={r.status} />
                      <span style={{ fontSize: '.73rem', color: '#7f8ea3', minWidth: 140 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      {r.result && (
                        <span style={{ fontSize: '.73rem', color: '#94a3b8' }}>
                          {typeof r.result === 'string' ? r.result : JSON.stringify(r.result)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </td>
        </tr>
      )}
    </>
  )
}

export default function SOCSOAR() {
  const [playbooks, setPlaybooks] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showForm, setShowForm]   = useState(false)
  const [editPb, setEditPb]       = useState(null)
  const [runMsg, setRunMsg]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch('/api/soc/soar/playbooks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setPlaybooks(d.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(pb) {
    const newStatus = pb.status === 'active' ? 'inactive' : 'active'
    try {
      await authFetch(`/api/soc/soar/playbooks/${pb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pb, status: newStatus }),
      })
      setPlaybooks(prev => prev.map(p => p.id === pb.id ? { ...p, status: newStatus } : p))
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('Delete this playbook?')) return
    try {
      await authFetch(`/api/soc/soar/playbooks/${id}`, { method: 'DELETE' })
      setPlaybooks(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  async function handleRun(id) {
    setRunMsg(null)
    try {
      const res = await authFetch(`/api/soc/soar/playbooks/${id}/run`, { method: 'POST' })
      const d = await res.json()
      setRunMsg({ ok: res.ok, text: res.ok ? `Run queued (id: ${d.run_id})` : d.error || 'Run failed' })
      load()
    } catch (ex) {
      setRunMsg({ ok: false, text: ex.message })
    }
    setTimeout(() => setRunMsg(null), 5000)
  }

  function handleSaved(pb) {
    if (editPb) {
      setPlaybooks(prev => prev.map(p => p.id === pb.id ? pb : p))
    } else {
      setPlaybooks(prev => [pb, ...prev])
    }
    setShowForm(false)
    setEditPb(null)
  }

  function handleEdit(pb) {
    setEditPb(pb)
    setShowForm(true)
  }

  const active = playbooks.filter(p => p.status === 'active').length

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">SOAR — Security Orchestration & Automation</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="soc-btn soc-btn-ghost" onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="soc-btn soc-btn-primary" onClick={() => { setEditPb(null); setShowForm(v => !v) }}>
            <Plus size={13} /> New Playbook
          </button>
        </div>
      </div>

      {/* Run feedback */}
      {runMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 'var(--gap)',
          background: runMsg.ok ? '#14532d44' : '#7f1d1d44',
          border: `1px solid ${runMsg.ok ? '#22c55e44' : '#ef444444'}`,
          color: runMsg.ok ? '#86efac' : '#fca5a5', fontSize: '.83rem',
        }}>
          {runMsg.text}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="soc-panel" style={{ marginBottom: 'var(--gap)', padding: '20px 24px' }}>
          <div className="soc-panel-header" style={{ marginBottom: 16 }}>
            <h3 className="soc-panel-title">{editPb ? 'Edit Playbook' : 'New Playbook'}</h3>
          </div>
          <PlaybookForm
            initial={editPb}
            onSave={handleSaved}
            onCancel={() => { setShowForm(false); setEditPb(null) }}
          />
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--gap)' }}>
          {[
            ['Total Playbooks', playbooks.length, '#3b82f6'],
            ['Active', active, '#22c55e'],
            ['Inactive', playbooks.length - active, '#64748b'],
          ].map(([label, val, color]) => (
            <div key={label} className="soc-panel" style={{ padding: '14px 20px', flex: 1 }}>
              <div style={{ fontSize: '.72rem', color: '#7f8ea3', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Playbooks table */}
      <div className="soc-panel">
        <div className="soc-panel-header">
          <h3 className="soc-panel-title"><Zap size={14} /> Playbooks</h3>
        </div>

        {error && (
          <div className="soc-error-state" style={{ padding: 24 }}>
            <AlertCircle size={28} /><p>{error}</p>
            <button className="soc-btn soc-btn-primary" onClick={load}><RefreshCw size={13} /> Retry</button>
          </div>
        )}

        {loading && (
          <div style={{ padding: 16 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        )}

        {!loading && !error && (
          <table className="soc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 220 }}>Trigger</th>
                <th style={{ width: 180 }}>Action</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 160 }}>Last Run</th>
                <th style={{ width: 200 }}>Actions</th>
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {playbooks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#7f8ea3' }}>
                    <Zap size={28} style={{ marginBottom: 10, opacity: .4 }} /><br />
                    No playbooks yet — create one to automate your SOC responses
                  </td>
                </tr>
              )}
              {playbooks.map(pb => (
                <PlaybookRow
                  key={pb.id}
                  pb={pb}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onRun={handleRun}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
