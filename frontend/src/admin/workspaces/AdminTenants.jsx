import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, AlertTriangle, X, Check } from 'lucide-react'

function api(path, opts) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  })
}

const PLANS = ['starter', 'professional', 'enterprise']
const REGIONS = ['eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-2']

function Modal({ title, onClose, children }) {
  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-header">
          <h3 className="adm-modal-title">{title}</h3>
          <button className="adm-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function AdminTenants() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', plan: 'starter', region: 'eu-west-1' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api('/tenants')
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setRows(data.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.id || !form.name) { setFormError('ID and Name are required'); return }
    setSaving(true); setFormError(null)
    try {
      const res = await api('/tenants', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || res.statusText) }
      const tenant = await res.json()
      setRows(r => [tenant, ...r])
      setShowNew(false)
      setForm({ id: '', name: '', plan: 'starter', region: 'eu-west-1' })
    } catch (e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Tenants</h2>
        <div className="adm-header-actions">
          <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
          </button>
          <button className="adm-btn adm-btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New Tenant
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error">
          <AlertTriangle size={15} />{error}
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Plan</th><th>Region</th><th>Status</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }, (_, j) => (
                    <td key={j}><div className="adm-skeleton adm-skeleton-row" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="adm-empty">No tenants yet. Create the first one.</td></tr>
            ) : rows.map(t => (
              <tr key={t.id}>
                <td><code className="adm-code">{t.id}</code></td>
                <td className="adm-td-name">{t.name}</td>
                <td><span className="adm-badge adm-badge-plan">{t.plan}</span></td>
                <td>{t.region}</td>
                <td><span className={`adm-badge adm-badge-status ${t.status === 'active' ? 'active' : 'inactive'}`}>{t.status}</span></td>
                <td className="adm-td-date">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="New Tenant" onClose={() => setShowNew(false)}>
          <form className="adm-form" onSubmit={handleCreate}>
            {formError && <div className="adm-alert adm-alert-error"><AlertTriangle size={14} />{formError}</div>}
            <div className="adm-field">
              <label>Tenant ID <span className="adm-required">*</span></label>
              <input className="adm-input" placeholder="acme-corp" value={form.id}
                onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
              <span className="adm-field-hint">Lowercase, alphanumeric + hyphens</span>
            </div>
            <div className="adm-field">
              <label>Display Name <span className="adm-required">*</span></label>
              <input className="adm-input" placeholder="Acme Corporation" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label>Plan</label>
                <select className="adm-select" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="adm-field">
                <label>Region</label>
                <select className="adm-select" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                {saving ? 'Creating…' : <><Check size={14} /> Create Tenant</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
