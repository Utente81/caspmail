import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Users, Trash2, UserPlus, Star } from 'lucide-react'

function apiGet(path) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

function apiPost(path, body) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

function apiDelete(path) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

export default function MailContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiGet('/api/e2ee/contacts')
      .then(data => setContacts(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function handleAdd(e) {
    e.preventDefault()
    if (!newEmail) return
    apiPost('/api/e2ee/contacts', { contact_email: newEmail, contact_name: newName, is_favorite: false })
      .then(() => {
        setNewEmail('')
        setNewName('')
        load()
      })
      .catch(err => alert(err.message))
  }

  function handleDelete(id) {
    if (window.confirm('Delete this contact?')) {
      apiDelete(`/api/e2ee/contacts/${id}`).then(() => load()).catch(e => alert(e.message))
    }
  }

  return (
    <div className="mail-inbox-layout">
      <div className="mail-list-panel" style={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column' }}>
        <div className="mail-list-toolbar">
          <span className="mail-inbox-count">
            {contacts.length} Contacts
          </span>
          <button className="mail-btn-icon" onClick={load} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <UserPlus size={16} opacity={0.6} />
          <input 
            type="text" 
            placeholder="Name (optional)" 
            value={newName} 
            onChange={e => setNewName(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', width: '200px' }}
          />
          <input 
            type="email" 
            placeholder="user@domain.com" 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)}
            required
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', flex: 1 }}
          />
          <button type="submit" className="mail-btn-primary" style={{ padding: '6px 16px' }}>Add</button>
        </form>

        {loading && (
          <div className="mail-skeleton-list">
            {[...Array(5)].map((_, i) => <div key={i} className="mail-skeleton-row" />)}
          </div>
        )}
        {error && (
          <div className="mail-alert-error" style={{ margin: '1rem' }}>
            <AlertCircle size={14} /> {error}
            <button onClick={load} className="mail-btn-xs" style={{ marginLeft: 'auto' }}>Retry</button>
          </div>
        )}
        {!loading && !error && contacts.length === 0 && (
          <div className="mail-empty">
            <Users size={36} className="mail-empty-icon" />
            <p>Your address book is empty</p>
          </div>
        )}
        {!loading && !error && contacts.length > 0 && (
          <ul className="mail-msg-list">
            {contacts.map(c => (
              <li key={c.id} className="mail-msg-item" style={{ cursor: 'default', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {(c.contact_name || c.contact_email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="mail-msg-from">{c.contact_name || c.contact_email}</div>
                    {c.contact_name && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{c.contact_email}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleDelete(c.id)} className="mail-btn-icon" style={{ color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
