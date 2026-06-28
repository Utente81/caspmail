import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, FileEdit, Trash2, Lock, Unlock, AlertCircle } from 'lucide-react'
import { decryptMessage } from '../crypto.js'
import MailCompose from './MailCompose'

function apiGet(path) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => {
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

export default function MailDrafts({ keyPair }) {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingDraft, setEditingDraft] = useState(null)
  
  // Per semplicità decriptiamo i draft al volo nella lista o quando cliccati
  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiGet('/api/e2ee/drafts')
      .then(async data => {
        // Decrypt all drafts immediately since they are small and for the current user
        const decryptedDrafts = []
        for (const draft of data.data) {
          try {
            const plain = await decryptMessage(keyPair.privateKey, draft.subject_encrypted, draft.body_encrypted, draft.nonce)
            decryptedDrafts.push({ ...draft, plainSubject: plain.subject, plainBody: plain.body })
          } catch (e) {
            decryptedDrafts.push({ ...draft, plainSubject: '(Decryption failed)', plainBody: '' })
          }
        }
        setDrafts(decryptedDrafts)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [keyPair])

  useEffect(() => {
    if (keyPair) load()
  }, [load, keyPair])

  function handleDelete(id, e) {
    if (e) e.stopPropagation()
    if (window.confirm('Delete this draft permanently?')) {
      apiDelete(`/api/e2ee/drafts/${id}`).then(() => setDrafts(prev => prev.filter(d => d.id !== id))).catch(e => alert(e.message))
    }
  }

  if (editingDraft) {
    return (
      <MailCompose 
        keyPair={keyPair} 
        initialDraft={editingDraft} 
        onDiscard={() => setEditingDraft(null)} 
        onSent={() => { load(); setEditingDraft(null) }} 
      />
    )
  }

  return (
    <div className="mail-inbox-layout">
      <div className="mail-list-panel" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="mail-list-toolbar">
          <span className="mail-inbox-count">
            {drafts.length} drafts
          </span>
          <button className="mail-btn-icon" onClick={load} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

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
        {!loading && !error && drafts.length === 0 && (
          <div className="mail-empty">
            <FileEdit size={36} className="mail-empty-icon" />
            <p>No drafts</p>
          </div>
        )}
        {!loading && !error && drafts.length > 0 && (
          <ul className="mail-msg-list">
            {drafts.map(msg => (
              <li key={msg.id} className="mail-msg-item" style={{ cursor: 'pointer' }} onClick={() => setEditingDraft(msg)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="mail-msg-from">To: {msg.to_email || '(No recipient)'}</div>
                  <button onClick={(e) => handleDelete(msg.id, e)} className="mail-btn-icon" style={{ color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mail-msg-meta" style={{ marginTop: '4px' }}>
                  <span className="mail-msg-subject">
                    {msg.plainSubject}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(msg.updated_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {msg.plainBody}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
