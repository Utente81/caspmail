import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle, Search, Plus, Trash2, Edit } from 'lucide-react'

function api(path, options = {}) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
  })
}

export default function AdminAliases() {
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setModalOpen] = useState(false)
  const [editAlias, setEditAlias] = useState(null)
  
  const [formAliasEmail, setFormAliasEmail] = useState('')
  const [formMembers, setFormMembers] = useState('')
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api('/aliases')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAliases(data.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setFormError(null)
    const emails = formMembers.split(',').map(e => e.trim()).filter(Boolean)
    if (!formAliasEmail || emails.length === 0) {
      setFormError('Alias email and at least one member are required.')
      return
    }

    try {
      if (editAlias) {
        const res = await api(`/aliases/${editAlias.id}`, {
          method: 'PUT',
          body: JSON.stringify({ members: emails })
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        const res = await api('/aliases', {
          method: 'POST',
          body: JSON.stringify({ alias_email: formAliasEmail, members: emails })
        })
        if (!res.ok) throw new Error(await res.text())
      }
      setModalOpen(false)
      load()
    } catch (e) {
      setFormError(e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this alias?')) return
    try {
      const res = await api(`/aliases/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const openCreate = () => {
    setEditAlias(null)
    setFormAliasEmail('')
    setFormMembers('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (alias) => {
    setEditAlias(alias)
    setFormAliasEmail(alias.alias_email)
    setFormMembers(alias.members.join(', '))
    setFormError(null)
    setModalOpen(true)
  }

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Groups &amp; Aliases</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
          </button>
          <button className="adm-btn adm-btn-primary" onClick={openCreate}>
            <Plus size={14} /> New Alias
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error">
          <AlertTriangle size={15} />{error}
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="adm-table-wrap" style={{ marginTop: '20px' }}>
        <table className="adm-table">
          <thead>
            <tr><th>Alias Email</th><th>Members</th><th>Created At</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="adm-empty">Loading...</td></tr>
            ) : aliases.length === 0 ? (
              <tr><td colSpan={4} className="adm-empty">No aliases configured.</td></tr>
            ) : aliases.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.alias_email}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {a.members.map(m => <span key={m} className="adm-badge">{m}</span>)}
                  </div>
                </td>
                <td className="adm-td-date">{new Date(a.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="adm-btn adm-btn-ghost" onClick={() => openEdit(a)}><Edit size={14} /></button>
                  <button className="adm-btn adm-btn-ghost" style={{ color: 'var(--red)' }} onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="adm-modal-overlay">
          <div className="adm-modal">
            <h3 className="adm-section-title">{editAlias ? 'Edit Alias' : 'Create Alias'}</h3>
            {formError && <div className="adm-alert adm-alert-error">{formError}</div>}
            
            <div className="adm-form-group">
              <label className="adm-label">Alias Email</label>
              <input className="adm-input" value={formAliasEmail} onChange={e => setFormAliasEmail(e.target.value)} disabled={!!editAlias} placeholder="e.g. info@acme.com" />
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Members (comma separated)</label>
              <textarea className="adm-input" style={{ minHeight: '80px' }} value={formMembers} onChange={e => setFormMembers(e.target.value)} placeholder="e.g. alice@acme.com, bob@acme.com" />
            </div>

            <div className="adm-modal-actions">
              <button className="adm-btn adm-btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
