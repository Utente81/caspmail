import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, AlertTriangle, X, Check, Search } from 'lucide-react'

function api(path, opts) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  })
}

const ROLES = ['user', 'admin', 'soc_analyst', 'soc_manager']

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

export default function AdminUsers() {
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', email: '', name: '', role: 'user', quota_mb: 1024, password: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', role: 'user', quota_mb: 1024, status: 'active', password: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [uRes, tRes] = await Promise.all([
        api('/users' + (tenantFilter ? `?tenant_id=${encodeURIComponent(tenantFilter)}` : '')),
        api('/tenants?limit=200'),
      ])
      if (!uRes.ok) throw new Error(`${uRes.status} ${uRes.statusText}`)
      const [ud, td] = await Promise.all([uRes.json(), tRes.json()])
      setRows(ud.data || [])
      setTenants(td.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tenantFilter])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(u =>
    !filter || u.email.toLowerCase().includes(filter.toLowerCase()) || u.name?.toLowerCase().includes(filter.toLowerCase())
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.tenant_id || !form.email) { setFormError('Tenant and Email are required'); return }
    if (!form.password || form.password.length < 8) { setFormError('Password is required (min 8 chars)'); return }
    setSaving(true); setFormError(null)
    try {
      const res = await api('/users', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || res.statusText) }
      const user = await res.json()
      setRows(r => r.some(existing => existing.id === user.id)
        ? r.map(existing => existing.id === user.id ? user : existing)
        : [user, ...r]
      )
      setShowNew(false)
      setForm({ tenant_id: '', email: '', name: '', role: 'user', quota_mb: 1024, password: '' })
    } catch (e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  function openEdit(u) {
    setEditUser(u)
    setEditForm({ name: u.name || '', role: u.role, quota_mb: u.quota_mb, status: u.status, password: '' })
    setEditError(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true); setEditError(null)
    try {
      const res = await api(`/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || res.statusText) }
      const updated = await res.json()
      setRows(r => updated.status === 'deleted'
        ? r.filter(u => u.id !== updated.id)
        : r.map(u => u.id === updated.id ? updated : u)
      )
      setEditUser(null)
    } catch (e) { setEditError(e.message) }
    finally { setEditSaving(false) }
  }

  async function handleRevokeSessions() {
    if (!window.confirm('Force logout all active sessions for this user?')) return
    setRevoking(true)
    try {
      const res = await api(`/users/${editUser.id}/logout`, { method: 'POST', body: JSON.stringify({}) })
      if (!res.ok) throw new Error('Failed to revoke sessions')
      alert('All active sessions have been revoked.')
    } catch (e) { alert(e.message) }
    finally { setRevoking(false) }
  }

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Users</h2>
        <div className="adm-header-actions">
          <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
          </button>
          <button className="adm-btn adm-btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New User
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error">
          <AlertTriangle size={15} />{error}
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="adm-filter-bar">
        <div className="adm-search">
          <Search size={14} className="adm-search-icon" />
          <input className="adm-search-input" placeholder="Search users…" value={filter}
            onChange={e => setFilter(e.target.value)} />
        </div>
        <select className="adm-select adm-select-sm" value={tenantFilter}
          onChange={e => setTenantFilter(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Tenant</th><th>Role</th><th>Quota</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 7 }, (_, j) => <td key={j}><div className="adm-skeleton adm-skeleton-row" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="adm-empty">{filter ? 'No users match the filter.' : 'No users yet.'}</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="adm-tr-clickable" onClick={() => openEdit(u)}>
                <td className="adm-td-name">{u.email}</td>
                <td>{u.name || '—'}</td>
                <td><code className="adm-code">{u.tenant_id}</code></td>
                <td><span className={`adm-badge adm-badge-role ${u.role}`}>{u.role}</span></td>
                <td>{u.quota_mb} MB</td>
                <td><span className={`adm-badge adm-badge-status ${u.status}`}>{u.status}</span></td>
                <td className="adm-td-date">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <Modal title={`Edit User — ${editUser.email}`} onClose={() => setEditUser(null)}>
          <form className="adm-form" onSubmit={handleEdit}>
            {editError && <div className="adm-alert adm-alert-error"><AlertTriangle size={14} />{editError}</div>}
            <div className="adm-field">
              <label>Display Name</label>
              <input className="adm-input" placeholder="Full Name" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label>Role</label>
                <select className="adm-select" value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="adm-field">
                <label>Quota (MB)</label>
                <input className="adm-input" type="number" min={100} max={102400} value={editForm.quota_mb}
                  onChange={e => setEditForm(f => ({ ...f, quota_mb: parseInt(e.target.value, 10) }))} />
              </div>
            </div>
            <div className="adm-field">
              <label>Status</label>
              <select className="adm-select" value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="deleted">deleted</option>
              </select>
            </div>
            <div className="adm-field">
              <label>New Password</label>
              <input className="adm-input" type="password" placeholder="Leave empty to keep current password" value={editForm.password}
                onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-ghost" style={{ color: 'var(--red)', marginRight: 'auto' }} onClick={handleRevokeSessions} disabled={revoking}>
                {revoking ? 'Revoking...' : 'Revoke Sessions'}
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={editSaving}>
                {editSaving ? 'Saving…' : <><Check size={14} /> Save Changes</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNew && (
        <Modal title="New User" onClose={() => setShowNew(false)}>
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
              <label>Email <span className="adm-required">*</span></label>
              <input className="adm-input" type="email" placeholder="user@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="adm-field">
              <label>Display Name</label>
              <input className="adm-input" placeholder="Full Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label>Role</label>
                <select className="adm-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="adm-field">
                <label>Quota (MB)</label>
                <input className="adm-input" type="number" min={100} max={102400} value={form.quota_mb}
                  onChange={e => setForm(f => ({ ...f, quota_mb: parseInt(e.target.value, 10) }))} />
              </div>
            </div>
            <div className="adm-field">
              <label>Password <span className="adm-required">*</span></label>
              <input className="adm-input" type="password" placeholder="Min 8 characters" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                {saving ? 'Creating…' : <><Check size={14} /> Create User</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
