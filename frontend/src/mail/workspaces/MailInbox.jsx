import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Mail, Lock, Unlock, AlertCircle, ChevronLeft, Paperclip, Download, Trash2, XCircle, Star, Archive, AlertOctagon, Reply, Forward, ShieldAlert } from 'lucide-react'
import { decryptMessage } from '../crypto.js'

function apiGet(path) {
  const token = (sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token'))
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

function apiPatch(path, body) {
  const token = (sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token'))
  const headers = { Authorization: `Bearer ${token}` }
  const options = { method: 'PATCH', headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  return fetch(path, options).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

function apiDelete(path) {
  const token = (sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token'))
  return fetch(path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

import MessageList from './MessageList'
import MessageDetail from './MessageDetail'

export default function MailInbox({ keyPair, folder = 'inbox', refreshTrigger = 0, onCompose, onRead, folders = [] }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    if (!silent) setError(null)
    apiGet(`/api/e2ee/messages?folder=${folder}&limit=50`)
      .then(data => { 
        setMessages(data.data); 
        // Don't reset selected if it's a silent refresh
        if (!silent) {
          setSelected(null); setShowDetail(false); setCheckedIds(new Set());
        }
      })
      .catch(err => { if (!silent) setError(err.message) })
      .finally(() => { if (!silent) setLoading(false) })
  }, [folder])

  useEffect(() => { load(false) }, [folder]) // normal load on mount/folder change
  
  useEffect(() => {
    if (refreshTrigger > 0) load(true)
  }, [refreshTrigger, load])

  function handleSelect(msg) {
    setSelected(msg)
    setShowDetail(true)
    // Mark read locally
    if (!msg.read_at) {
      if (onRead) onRead()
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m))
    }
  }

  function handleDeleteItem(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) {
      setSelected(null)
      setShowDetail(false)
    }
  }

  function handleFlag(id, flags) {
    const updatedMsgs = messages.map(m => {
      if (m.id === id) {
        const updated = { ...m };
        if (updated.recipient_flags) updated.recipient_flags = { ...updated.recipient_flags, ...flags };
        else updated.recipient_flags = { ...flags };
        if (updated.sender_flags) updated.sender_flags = { ...updated.sender_flags, ...flags };
        else updated.sender_flags = { ...flags };
        return updated;
      }
      return m;
    });
    setMessages(updatedMsgs);
    if (selected?.id === id) {
      setSelected(updatedMsgs.find(m => m.id === id));
    }

    apiPatch(`/api/e2ee/messages/${id}/flags`, { flags })
      .then(() => {
        if (folder === 'inbox' && (flags.archived || flags.spam)) {
           handleDeleteItem(id)
        } else if (folder === 'archive' && flags.archived === false) {
           handleDeleteItem(id)
        } else if (folder === 'spam' && flags.spam === false) {
           handleDeleteItem(id)
        }
      }).catch(e => {
        alert(e.message)
        load(false)
      })
  }

  const unread = messages.filter(m => !m.read_at).length

  return (
    <div className="mail-inbox-layout">
      {/* List panel */}
      <div className={`mail-list-panel${showDetail ? ' hidden-mobile' : ''}`}>
                <div className="mail-list-toolbar" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          {checkedIds.size > 0 ? (
            <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
              <span style={{fontSize:'0.85rem', fontWeight:600}}>{checkedIds.size} selected</span>
              <button className="mail-btn-icon" title="Trash Selected" onClick={() => {
                if(confirm(folder === 'trash' ? 'Eliminare definitivamente i messaggi selezionati? Questa azione non può essere annullata.' : 'Cestinare i messaggi selezionati?')) {
                  if (folder === 'trash') {
                    Promise.all(Array.from(checkedIds).map(id => apiDelete(`/api/e2ee/messages/${id}`))).then(() => load(false));
                  } else {
                    apiPatch('/api/e2ee/messages/bulk/trash', { ids: Array.from(checkedIds) }).then(()=>load(false));
                  }
                }
              }}><Trash2 size={14}/></button>
              <select value="" style={{fontSize:'0.85rem', padding:'6px 12px', background:'#1e293b', color:'#f8fafc', border:'1px solid #334155', borderRadius:'6px', cursor:'pointer'}} onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                
                let req;
                if (val === 'trash') {
                  req = apiPatch('/api/e2ee/messages/bulk/trash', { ids: Array.from(checkedIds) });
                } else if (val === 'archive') {
                  req = apiPatch('/api/e2ee/messages/bulk/flags', { ids: Array.from(checkedIds), flags: { archived: true, spam: false, folder_id: null } });
                } else if (val === 'spam') {
                  req = apiPatch('/api/e2ee/messages/bulk/flags', { ids: Array.from(checkedIds), flags: { spam: true, archived: false, folder_id: null } });
                } else if (val === 'inbox') {
                  req = apiPatch('/api/e2ee/messages/bulk/flags', { ids: Array.from(checkedIds), flags: { archived: false, spam: false, folder_id: null } });
                } else {
                  req = apiPatch('/api/e2ee/messages/bulk/flags', { ids: Array.from(checkedIds), flags: { folder_id: val } });
                }
                req.then(()=>load(false));
              }}>
                <option value="" disabled>Move to...</option>
                {folder !== 'inbox' && <option value="inbox">Inbox</option>}
                {folder !== 'archive' && <option value="archive">Archive</option>}
                {folder !== 'spam' && <option value="spam">Spam</option>}
                {folder !== 'trash' && <option value="trash">Trash</option>}
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          ) : (
            <span className="mail-inbox-count">
              <input type="checkbox" onChange={(e) => {
                if (e.target.checked) setCheckedIds(new Set(messages.map(m => m.id)));
                else setCheckedIds(new Set());
              }} checked={messages.length > 0 && checkedIds.size === messages.length} style={{marginRight:'12px'}} />
              {folder === 'inbox' && unread > 0 ? <><strong>{unread}</strong> unread</> : `${messages.length} messages`}
            </span>
          )}
          <div style={{display:'flex', gap:'8px'}}>
            {folder === 'trash' && messages.length > 0 && (
              <button className="mail-btn-xs" style={{background:'#ef4444', color:'white', border:'none', cursor:'pointer'}} onClick={() => {
                if(confirm('Svuotare definitivamente il cestino? Questa operazione è irreversibile.')) {
                  apiDelete('/api/e2ee/trash').then(()=>load(false));
                }
              }}>Empty Trash</button>
            )}
            <button className="mail-btn-icon" onClick={() => load(false)} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="mail-skeleton-list">
            {[...Array(5)].map((_, i) => <div key={i} className="mail-skeleton-row" />)}
          </div>
        )}
        {error && (
          <div className="mail-alert-error" style={{ margin: '1rem' }}>
            <AlertCircle size={14} /> {error}
            <button onClick={() => load(false)} className="mail-btn-xs" style={{ marginLeft: 'auto' }}>Retry</button>
          </div>
        )}
        {!loading && !error && (
          <MessageList messages={messages} onSelect={handleSelect} selected={selected} folder={folder} checkedIds={checkedIds} setCheckedIds={setCheckedIds} />
        )}
      </div>

      {/* Detail panel */}
      <div className={`mail-detail-panel${!showDetail ? ' hidden-mobile' : ''}`}>
        {selected
          ? <MessageDetail msg={selected} keyPair={keyPair} onBack={() => setShowDetail(false)} onDelete={handleDeleteItem} onFlag={handleFlag} onCompose={onCompose} folder={folder} />
          : (
            <div className="mail-detail-placeholder">
              <Lock size={32} className="mail-detail-placeholder-icon" />
              <p>Select a message to read</p>
              <span>Messages are end-to-end encrypted</span>
            </div>
          )
        }
      </div>
    </div>
  )
}





