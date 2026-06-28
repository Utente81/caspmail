import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, AlertTriangle, X, Check, Globe, Copy } from 'lucide-react'

function api(path, opts) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  })
}

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

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className="adm-btn adm-btn-ghost adm-btn-xs" onClick={copy} title="Copy">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

export default function AdminDomains() {
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', domain: '', is_primary: false })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [verifying, setVerifying] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [dRes, tRes] = await Promise.all([api('/domains'), api('/tenants?limit=200')])
      if (!dRes.ok) throw new Error(`${dRes.status}`)
      const [dd, td] = await Promise.all([dRes.json(), tRes.json()])
      setRows(dd.data || [])
      setTenants(td.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.tenant_id || !form.domain) { setFormError('Tenant and Domain are required'); return }
    setSaving(true); setFormError(null)
    try {
      const res = await api('/domains', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || res.statusText) }
      const domain = await res.json()
      setRows(r => [domain, ...r])
      setShowNew(false)
      setForm({ tenant_id: '', domain: '', is_primary: false })
    } catch (e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function handleVerify(domainId) {
    setVerifying(domainId)
    try {
      const res = await api(`/domains/${domainId}/verify`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Verification failed') }
      const updated = await res.json()
      setRows(r => r.map(d => d.id === domainId ? { ...d, ...updated } : d))
    } catch (e) {
      alert(e.message)
    } finally {
      setVerifying(null)
    }
  }

  const tenantName = id => tenants.find(t => t.id === id)?.name || id

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Domains</h2>
        <div className="adm-header-actions">
          <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
          </button>
          <button className="adm-btn adm-btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Add Domain
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
            <tr><th>Domain</th><th>Tenant</th><th>Primary</th><th>Verified</th><th>DNS Token</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 6 }, (_, j) => <td key={j}><div className="adm-skeleton adm-skeleton-row" /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="adm-empty">No domains registered yet.</td></tr>
            ) : rows.map(d => (
              <tr key={d.id}>
                <td>
                  <div className="adm-domain-cell">
                    <Globe size={13} className="adm-domain-icon" />
                    <span className="adm-td-name">{d.domain}</span>
                  </div>
                </td>
                <td>{tenantName(d.tenant_id)}</td>
                <td>{d.is_primary ? <span className="adm-badge active">Primary</span> : <span className="adm-muted">—</span>}</td>
                <td>
                  <span className={`adm-badge adm-badge-status ${d.verified ? 'active' : 'inactive'}`}>
                    {d.verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div className="adm-token-cell">
                    <code className="adm-code adm-code-sm">{d.dns_txt_token}</code>
                    <CopyBtn text={d.dns_txt_token} />
                  </div>
                </td>
                <td>
                  {!d.verified && (
                    <button
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      onClick={() => handleVerify(d.id)}
                      disabled={verifying === d.id}
                    >
                      {verifying === d.id ? 'Checking…' : 'Verify DNS'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="Add Domain" onClose={() => setShowNew(false)}>
          <form className="adm-form" onSubmit={handleCreate}>
            {formError && <div className="adm-alert adm-alert-error"><AlertTriangle size={14} />{formError}</div>}
            <div className="adm-field">
              <label>Tenant <span className="adm-required">*</span></label>
              <select className="adm-select" value={form.tenant_id}
                onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">Select a tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="adm-field">
              <label>Domain <span className="adm-required">*</span></label>
              <input className="adm-input" placeholder="mail.example.com" value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain: e.target.value.toLowerCase() }))} />
              <span className="adm-field-hint">A DNS TXT token will be generated for ownership verification.</span>
            </div>
            <div className="adm-field">
              <label className="adm-checkbox-label">
                <input type="checkbox" checked={form.is_primary}
                  onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
                Set as primary domain for this tenant
              </label>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                {saving ? 'Adding…' : <><Check size={14} /> Add Domain</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
