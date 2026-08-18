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

function TimeAgo({ iso }) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return <span>just now</span>
  if (mins < 60) return <span>{mins}m ago</span>
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return <span>{hrs}h ago</span>
  return <span>{d.toLocaleDateString()}</span>
}

function MessageList({ messages, onSelect, selected, folder, checkedIds, setCheckedIds }) {
  if (!messages.length) {
    return (
      <div className="mail-empty">
        <Mail size={36} className="mail-empty-icon" />
        <p>{folder === 'trash' ? 'Trash is empty' : folder === 'sent' ? 'No sent messages' : 'Inbox is empty'}</p>
      </div>
    )
  }
  return (
    <ul className="mail-msg-list">
      {messages.map(msg => (
        <li
          key={msg.id}
          className={`mail-msg-item${selected?.id === msg.id ? ' selected' : ''}${(!msg.read_at && folder === 'inbox') ? ' unread' : ''}`}
          onClick={() => onSelect(msg)}
        >
          <input type="checkbox" onClick={(e) => e.stopPropagation()} onChange={(e) => { const newIds = new Set(checkedIds); if (e.target.checked) newIds.add(msg.id); else newIds.delete(msg.id); setCheckedIds(newIds); }} checked={checkedIds.has(msg.id)} style={{marginRight: '12px'}} /><div className="mail-msg-from">{folder === 'sent' ? `To: ${msg.to_email}` : `From: ${msg.from_email}`}</div>
          <div className="mail-msg-meta">
            <span className="mail-msg-subject">
              <Lock size={10} className="mail-lock-icon" />
              Encrypted
            </span>
            <TimeAgo iso={msg.created_at} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function MessageDetail({ msg, keyPair, onBack, onDelete, onFlag, onCompose, folder }) {
  const [decrypted, setDecrypted] = useState(null)
  const [decError, setDecError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!msg) return
    setDecrypted(null)
    setDecError(null)

    if (!keyPair) {
      setDecError('No decryption key loaded. Go to Security Keys to generate your keypair.')
      return
    }

    setLoading(true)
    apiGet(`/api/e2ee/messages/${msg.id}`)
      .then(full => decryptMessage(keyPair.privateKey, full.subject_encrypted, full.body_encrypted, full.nonce))
      .then(plain => setDecrypted(plain))
      .catch(err => setDecError('Could not decrypt this message. It may have been encrypted with a different key.'))
      .finally(() => setLoading(false))
  }, [msg?.id, keyPair])

  if (!msg) return null

  function handleDelete() {
    if (folder === 'trash') {
      if (window.confirm('Permanently delete this message? This action cannot be undone.')) {
        apiDelete(`/api/e2ee/messages/${msg.id}`).then(() => onDelete(msg.id)).catch(e => alert(e.message))
      }
    } else {
      apiPatch(`/api/e2ee/messages/${msg.id}/trash`).then(() => onDelete(msg.id)).catch(e => alert(e.message))
    }
  }

  async function handleReportPhishing() {
    if (!window.confirm('Report this message as a phishing attempt to the SOC team?')) return;
    try {
      const res = await fetch(`/api/v4/soc/simulations/report/${msg.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${(sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token'))}` }
      });
      const data = await res.json();
      alert(data.message || 'Reported');
      onDelete(msg.id); // Remove from view
    } catch (err) {
      alert('Error reporting phishing: ' + err.message);
    }
  }

  function handleReply() {
    if (!decrypted) return
    let oldBody = decrypted.body
    try {
      const parsed = JSON.parse(decrypted.body)
      oldBody = parsed.text
    } catch (e) {}
    
    const replyBody = `\n\n--- Original Message ---\nFrom: ${msg.from_email}\nDate: ${new Date(msg.created_at).toLocaleString()}\n\n${oldBody}`
    const replySubject = decrypted.subject.startsWith('Re:') ? decrypted.subject : `Re: ${decrypted.subject}`
    
    onCompose({
      to: msg.from_email,
      subject: replySubject,
      body: replyBody
    })
  }

  function handleForward() {
    if (!decrypted) return
    let oldBody = decrypted.body
    let attachments = []
    try {
      const parsed = JSON.parse(decrypted.body)
      oldBody = parsed.text
      attachments = parsed.attachments || [] || []
    } catch (e) {}

    const fwdBody = `\n\n--- Forwarded Message ---\nFrom: ${msg.from_email}\nDate: ${new Date(msg.created_at).toLocaleString()}\n\n${oldBody}`
    const fwdSubject = decrypted.subject.startsWith('Fwd:') ? decrypted.subject : `Fwd: ${decrypted.subject}`

    onCompose({
      to: '',
      subject: fwdSubject,
      body: fwdBody,
      attachments
    })
  }

  return (
    <div className="mail-detail">
      <button className="mail-detail-back" onClick={onBack}>
        <ChevronLeft size={14} /> Back
      </button>
      <div className="mail-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="mail-detail-from">{folder === 'sent' ? `To: ${msg.to_email}` : `From: ${msg.from_email}`}</div>
          <div className="mail-detail-time">{new Date(msg.created_at).toLocaleString()}</div>
        </div>
        <div style={{display: 'flex', gap: '4px'}}>
          <button onClick={handleReply} className="mail-btn-icon" title="Reply" style={{color: '#60a5fa'}}>
            <Reply size={16} />
          </button>
          <button onClick={handleForward} className="mail-btn-icon" title="Forward" style={{color: '#60a5fa'}}>
            <Forward size={16} />
          </button>
          <button onClick={handleReportPhishing} className="mail-btn-icon" title="Report Phishing" style={{color: '#ef4444', border: '1px solid #ef444433', borderRadius: '4px'}}>
            <ShieldAlert size={16} />
          </button>
          <button onClick={() => onFlag(msg.id, {important: true})} className="mail-btn-icon" title="Mark Important" style={{color: '#fbbf24'}}>
            <Star size={16} />
          </button>
          <button onClick={() => onFlag(msg.id, {archived: true})} className="mail-btn-icon" title="Archive" style={{color: '#94a3b8'}}>
            <Archive size={16} />
          </button>
          <button onClick={() => onFlag(msg.id, {spam: true})} className="mail-btn-icon" title="Mark as Spam" style={{color: '#f97316'}}>
            <AlertOctagon size={16} />
          </button>
          <button onClick={handleDelete} className="mail-btn-icon" style={{ color: '#ef4444' }} title={folder === 'trash' ? 'Permanently Delete' : 'Move to Trash'}>
            {folder === 'trash' ? <XCircle size={16} /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {loading && <div className="mail-detail-loading"><div className="mail-spinner" /></div>}

      {decError && (
        <div className="mail-alert-error">
          <AlertCircle size={14} />
          {decError}
        </div>
      )}

      {decrypted && (
        <>
          <div className="mail-detail-subject">
            <Unlock size={13} className="mail-unlock-icon" />
            {decrypted.subject}
          </div>
          
          {/* Corpo del messaggio (supporto allegati) */}
          {(() => {
            let bodyText = decrypted.body
            let attachments = []
            
            try {
              const parsed = JSON.parse(decrypted.body)
              if (parsed.text !== undefined) {
                bodyText = parsed.text
                attachments = parsed.attachments || []
              }
            } catch (e) {
              // Non Ã¨ un JSON, fallback a testo semplice (email vecchie)
            }

            let isPhishing = false;
            try {
              if (bodyText) {
                const lower = bodyText.toLowerCase();
                if (
                  lower.includes('aggiorna password') ||
                  lower.includes('urgent password reset') ||
                  lower.includes('http://fake-login') ||
                  lower.includes('verify your account') ||
                  (lower.includes('http://') && lower.includes('login'))
                ) {
                  isPhishing = true;
                }
              }
            } catch (e) {}

            const downloadAttachment = (att) => {
              const link = document.createElement('a')
              link.href = `data:${att.type};base64,${att.data}`
              link.download = att.name
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }

            return (
              <>
                {isPhishing && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertOctagon size={24} style={{ color: '#ef4444' }} />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600 }}>Phishing Warning</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>This message contains suspicious links or keywords often associated with phishing attacks. Do not click on any links or provide personal information.</p>
                    </div>
                  </div>
                )}
                <div className="mail-detail-body" dangerouslySetInnerHTML={{ __html: bodyText }} />
                {attachments.length > 0 && (
                  <div className="mail-detail-attachments" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Paperclip size={14} /> Attachments
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {attachments.map((att, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <span>{att.name}</span>
                          <button onClick={() => downloadAttachment(att)} title="Download" style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px' }}>
                            <Download size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}

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
    apiPatch(`/api/e2ee/messages/${id}/flags`, { flags })
      .then(() => {
        if (folder === 'inbox' && (flags.archived || flags.spam)) {
           handleDeleteItem(id)
        } else if (folder === 'archive' && flags.archived === false) {
           handleDeleteItem(id)
        } else if (folder === 'spam' && flags.spam === false) {
           handleDeleteItem(id)
        } else {
           alert('Action applied successfully')
        }
      }).catch(e => alert(e.message))
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
              <select style={{fontSize:'0.8rem', padding:'4px', background:'rgba(255,255,255,0.1)', color:'#fff', border:'none', borderRadius:'4px'}} onChange={(e) => {
                if (e.target.value) {
                  apiPatch('/api/e2ee/messages/bulk/flags', { ids: Array.from(checkedIds), flags: { folder_id: e.target.value } }).then(()=>load(false));
                }
              }}>
                <option value="">Move to...</option>
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





