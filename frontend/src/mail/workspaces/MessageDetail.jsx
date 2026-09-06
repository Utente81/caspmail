import React, { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { ChevronLeft, Reply, Forward, ShieldAlert, Star, Archive, AlertOctagon, Trash2, XCircle, AlertCircle, Unlock, Lock, Paperclip, Download } from 'lucide-react'
import { decryptMessage, decryptAttachment, loadPreKey } from '../crypto.js'

function apiGet(path) {
  const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

function apiPatch(path, body) {
  const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
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
  const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
  return fetch(path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

export default function MessageDetail({ msg, keyPair, onBack, onDelete, onFlag, onCompose, folder }) {
  const isImportant = msg?.recipient_flags?.important || msg?.sender_flags?.important;
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
      .then(async (full) => {
         let activePrivKey = keyPair.privateKey;
         if (full.recipient_flags?.prekey_id && folder !== 'sent') {
           const preKeyPair = await loadPreKey(full.recipient_flags.prekey_id);
           if (preKeyPair && preKeyPair.privateKey) {
             activePrivKey = preKeyPair.privateKey;
           } else {
             throw new Error('PFS PreKey used for this message is missing locally (try Syncing PreKeys in Security Settings).')
           }
         }

         const plain = await decryptMessage(activePrivKey, full.subject_encrypted, full.body_encrypted, full.nonce)
         let decryptedAtts = []
         if (full.attachments && full.attachments.length > 0) {
           decryptedAtts = await Promise.all(full.attachments.map(async (att) => {
             const dataKey = folder === 'sent' ? att.sender_data : att.recipient_data
             const nonceKey = folder === 'sent' ? att.sender_nonce : att.recipient_nonce
             if (!dataKey || !nonceKey) return { ...att, data: null }
             
             const rawData = await decryptAttachment(keyPair.privateKey, dataKey, nonceKey)
             // Convert Uint8Array to base64
             const chunkSize = 8192
             let binary = ''
             for (let i = 0; i < rawData.length; i += chunkSize) {
               binary += String.fromCharCode.apply(null, rawData.subarray(i, i + chunkSize))
             }
             return { ...att, data: btoa(binary) }
           }))
         }
         return { ...plain, decryptedAttachments: decryptedAtts }
      })
      .then(plain => setDecrypted(plain))
      .catch(err => setDecError('Could not decrypt this message. It may have been encrypted with a different key.'))
      .finally(() => setLoading(false))
  }, [msg?.id, keyPair, folder])

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
        headers: { Authorization: `Bearer ${(window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))}` }
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
          <button onClick={() => onFlag(msg.id, {important: !isImportant})} className="mail-btn-icon" title={isImportant ? "Remove Important" : "Mark Important"} style={{color: '#fbbf24'}}>
            <Star size={16} fill={isImportant ? '#fbbf24' : 'none'} />
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
            let attachments = decrypted.decryptedAttachments || []
            
            try {
              const parsed = JSON.parse(decrypted.body)
              if (parsed.text !== undefined) {
                bodyText = parsed.text
                // Fallback for old messages
                if (attachments.length === 0) attachments = parsed.attachments || []
              }
            } catch (e) {
              // Not JSON
            }

            let isPhishing = false;
            try {
              if (bodyText) {
                const lower = bodyText.toLowerCase();
                if (
                  lower.includes('aggiorna password') ||
                  lower.includes('urgent password reset') ||
                  lower.includes('http://fake-login') ||
                  lower.includes('suspended')
                ) {
                  isPhishing = true;
                }
              }
            } catch (e) {}

            return (
              <>
                {msg.expires_at && (
                  <div style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#fdba74', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                    <ShieldAlert size={16} />
                    <span style={{ fontSize: '0.85rem' }}>
                      <strong>Self-Destructing Message:</strong> This message will permanently expire and be purged on {new Date(msg.expires_at).toLocaleString()}.
                    </span>
                  </div>
                )}
                {isPhishing && (
                  <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={16} />
                    <span style={{ fontSize: '0.85rem' }}>
                      <strong>Warning:</strong> This message has been flagged by the SOC as a potential phishing attempt.
                    </span>
                  </div>
                )}
                
                <iframe className="mail-detail-body" srcDoc={DOMPurify.sanitize(bodyText)} sandbox="" style={{width: \'100%\', minHeight: \'400px\', border: \'none\'}} />

                {attachments.length > 0 && (
                  <div className="mail-attachments-list" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Paperclip size={14} /> Attachments ({attachments.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {attachments.map((att, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', color: '#e2e8f0', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{Math.round(att.size / 1024)} KB</span>
                          </div>
                          {att.data && (
                            <button 
                              className="mail-btn-icon" 
                              title="Download"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = `data:${att.type};base64,${att.data}`;
                                a.download = att.name;
                                a.click();
                              }}
                            >
                              <Download size={14} />
                            </button>
                          )}
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
