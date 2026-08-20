import React, { useState } from 'react'
import { Send, Lock, AlertCircle, CheckCircle, Paperclip, X, Save } from 'lucide-react'
import { encryptMessage, encryptAttachment, importPublicKeyPem } from '../crypto.js'

function apiFetch(path, opts = {}) {
  const token = (sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token'))
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  }).then(async r => {
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
    return data
  })
}

const RichTextEditor = ({ value, onChange }) => {
  const editorRef = React.useRef(null);

  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (cmd, arg = null) => {
    document.execCommand(cmd, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
  };

  const btnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', background: 'rgba(0,0,0,0.1)' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => execCmd('bold')} title="Bold" style={btnStyle}><b>B</b></button>
        <button type="button" onClick={() => execCmd('italic')} title="Italic" style={btnStyle}><i>I</i></button>
        <button type="button" onClick={() => execCmd('underline')} title="Underline" style={btnStyle}><u>U</u></button>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        <button type="button" onClick={() => execCmd('insertUnorderedList')} title="Bullet List" style={btnStyle}>• List</button>
        <button type="button" onClick={() => execCmd('insertOrderedList')} title="Numbered List" style={btnStyle}>1. List</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        style={{ padding: '12px', minHeight: '150px', outline: 'none', color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5', overflowY: 'auto' }}
      />
    </div>
  );
};

export default function MailCompose({ keyPair, initialDraft, composeData, onDiscard, onSent }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [contacts, setContacts] = useState([])
  const [ttl, setTtl] = useState(null)

  React.useEffect(() => {
    if (initialDraft) {
      setTo(initialDraft.to_email || '')
      setSubject(initialDraft.plainSubject === '(No subject)' ? '' : initialDraft.plainSubject || '')
      try {
        const parsed = JSON.parse(initialDraft.plainBody)
        setBody(parsed.text || '')
        setAttachments(parsed.attachments || [])
      } catch (e) {
        setBody(initialDraft.plainBody || '')
      }
    } else if (composeData) {
      setTo(composeData.to || '')
      setSubject(composeData.subject || '')
      setBody(composeData.body || '')
      setAttachments(composeData.attachments || [])
    }
  }, [initialDraft, composeData])

  React.useEffect(() => {
    apiFetch('/api/e2ee/contacts')
      .then(d => setContacts(d.data || []))
      .catch(e => console.error('Failed to load contacts for autocomplete:', e))
  }, [])

  const handleFileChange = async (e) => {
    if (e.target.files) {
      const newFiles = await Promise.all(Array.from(e.target.files).map(f => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (event) => {
            resolve({
              name: f.name,
              type: f.type || 'application/octet-stream',
              size: f.size,
              buffer: event.target.result
            })
          }
          reader.readAsArrayBuffer(f)
        })
      }))
      setAttachments(prev => [...prev, ...newFiles])
    }
  }

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!to || !subject || !body) { setError('All fields are required.'); return }
    if (!keyPair) { setError('Generate your security keys first (Security Keys tab).'); return }

    setError(null)
    // DLP Check (Client-side) - Zero Trust: runs on ALL outgoing messages
    // Credit card approx regex (13-16 digits with optional spaces/dashes)
    const ccRegex = /\b(?:\d[ -]*?){13,16}\b/;
    // Italian Codice Fiscale approx regex
    const cfRegex = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i;
    // IBAN approx regex (European formats)
    const ibanRegex = /\b[A-Z]{2}[0-9]{2}(?:[ ]?[0-9a-zA-Z]){11,28}\b/;
    // US Social Security Number
    const ssnRegex = /\b(?!(000|666|9))\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/;
    // API Keys / Secrets (AWS, GitHub, Generic High Entropy)
    const apiKeyRegex = /(AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|xoxb-[0-9]{10,13}-[a-zA-Z0-9]{24})/i;
    const textToScan = subject + " " + body;
    
    let matchedRule = null;
    let matchedData = null;
    
    const ccMatch = textToScan.match(ccRegex);
    if (ccMatch) {
      // A naive check to ensure it's actually numbers and not just random text with dashes
      const rawNums = ccMatch[0].replace(/[ -]/g, '');
      if (rawNums.length >= 13 && rawNums.length <= 16) {
        matchedRule = "Credit Card (PCI-DSS)";
        matchedData = ccMatch[0];
      }
    } 
    
    if (!matchedRule) {
      const cfMatch = textToScan.match(cfRegex);
      if (cfMatch) {
        matchedRule = "Codice Fiscale (PII)";
        matchedData = cfMatch[0];
      }
    }
    
    if (!matchedRule) {
      const ibanMatch = textToScan.match(ibanRegex);
      if (ibanMatch) {
        matchedRule = "IBAN (Financial)";
        matchedData = ibanMatch[0];
      }
    }

    if (!matchedRule) {
      const ssnMatch = textToScan.match(ssnRegex);
      if (ssnMatch) {
        matchedRule = "Social Security Number (PII)";
        matchedData = ssnMatch[0];
      }
    }

    if (!matchedRule) {
      const apiMatch = textToScan.match(apiKeyRegex);
      if (apiMatch) {
        matchedRule = "API Key / Secret (Security)";
        matchedData = "********"; // Redact the actual secret in the alert
      }
    }

    if (matchedRule) {
      // Send telemetry to SOC
      try {
        await apiFetch('/api/v4/soc/telemetry/dlp', {
          method: 'POST',
          body: JSON.stringify({ to_email: to, subject, matched_data: matchedData, rule_name: matchedRule })
        });
      } catch (e) { console.error("SOC telemetry failed", e); }
      
      setError(`DLP Blocked: Sensitive data detected (${matchedRule}). Corporate policy prohibits sending this (Zero Trust).`);
      setSending(false);
      return;
    }

    try {
      // Fetch recipient's public key (Identity Key)
      const { data: keys } = await apiFetch(`/api/e2ee/keys/${encodeURIComponent(to)}`)
      if (!keys || keys.length === 0) {
        throw new Error(`Recipient ${to} has not set up their encryption keys yet.`)
      }

      // Try fetching a PreKey for PFS
      let prekey = null;
      try {
        const pkRes = await fetch(`/api/e2ee/prekeys/fetch/${encodeURIComponent(to)}`, {
           headers: { Authorization: `Bearer ${sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')}` }
        });
        if (pkRes.ok) {
           prekey = await pkRes.json();
        }
      } catch (e) { console.error('Failed to fetch PreKey', e); }

      // Encrypt for sender ONCE (to save a readable copy in Sent)
      const senderPayload = await encryptMessage(keyPair.publicKey, subject, body)

      for (let i = 0; i < keys.length; i++) {
        let recipientPublicKey;
        let usedPrekeyId = null;
        if (i === 0 && prekey && prekey.public_key) {
           recipientPublicKey = await importPublicKeyPem(prekey.public_key);
           usedPrekeyId = prekey.prekey_id;
        } else {
           recipientPublicKey = await importPublicKeyPem(keys[i].public_key);
        }
        
        const payload = await encryptMessage(recipientPublicKey, subject, body)
        
        // Encrypt attachments
        const encryptedAttachments = []
        for (let att of attachments) {
           const recAtt = await encryptAttachment(recipientPublicKey, att.buffer)
           let sndAtt = null
           if (i === 0) {
             sndAtt = await encryptAttachment(keyPair.publicKey, att.buffer)
           }
           encryptedAttachments.push({
             name: att.name,
             type: att.type,
             size: att.size,
             recipient_data: recAtt.data,
             recipient_nonce: recAtt.nonce,
             sender_data: sndAtt ? sndAtt.data : null,
             sender_nonce: sndAtt ? sndAtt.nonce : null
           })
        }

        // Send
        await apiFetch('/api/e2ee/messages', {
          method: 'POST',
          body: JSON.stringify({ 
            to_email: keys[i].user_email || to, 
            ...payload,
            prekey_id: usedPrekeyId,
            // Only save the sender copy on the first message so it doesn't duplicate in "Sent"
            sender_subject_encrypted: i === 0 ? senderPayload.subject_encrypted : null,
            sender_body_encrypted: i === 0 ? senderPayload.body_encrypted : null,
            sender_nonce: i === 0 ? senderPayload.nonce : null,
            attachments: encryptedAttachments,
            expires_at: ttl ? new Date(Date.now() + ttl * 3600000).toISOString() : null
          })
        })
      }

      if (initialDraft) {
        await apiFetch(`/api/e2ee/drafts/${initialDraft.id}`, { method: 'DELETE' }).catch(() => {})
      }

      setSent(true)
      setTo('')
      setSubject('')
      setBody('')
      setAttachments([])
      if (onSent) onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleSaveDraft() {
    if (!keyPair) { setError('Generate your security keys first.'); return }
    setError(null)
    setSending(true)

    try {
      // Encrypt with OWN public key
      const payload = await encryptMessage(keyPair.publicKey, subject || '(No subject)', body)
      
      if (initialDraft) {
        await apiFetch(`/api/e2ee/drafts/${initialDraft.id}`, {
          method: 'PUT',
          body: JSON.stringify({ to_email: to, ...payload }),
        })
      } else {
        await apiFetch('/api/e2ee/drafts', {
          method: 'POST',
          body: JSON.stringify({ to_email: to, ...payload }),
        })
      }
      alert('Draft saved successfully!')
      if (onSent) onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mail-compose">
      <div className="mail-compose-card">
        <div className="mail-compose-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={14} className="mail-compose-lock" />
            <span>{initialDraft ? 'Edit Draft' : 'New Encrypted Message'}</span>
          </div>
          {onDiscard && (
            <button onClick={onDiscard} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {sent && (
          <div className="mail-alert-success">
            <CheckCircle size={14} /> Message sent and encrypted successfully.
          </div>
        )}
        {error && (
          <div className="mail-alert-error">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSend} className="mail-compose-form">
          <div className="mail-form-group">
            <label className="mail-label">To</label>
            <input
              type="email"
              className="mail-input"
              placeholder="recipient@domain.com"
              value={to}
              onChange={e => setTo(e.target.value)}
              list="contacts-list"
              required
            />
            <datalist id="contacts-list">
              {contacts.map(c => (
                <option key={c.id} value={c.contact_email}>
                  {c.contact_name ? `${c.contact_name} <${c.contact_email}>` : c.contact_email}
                </option>
              ))}
            </datalist>
          </div>
          <div className="mail-form-group">
            <label className="mail-label">Subject</label>
            <input
              type="text"
              className="mail-input"
              placeholder="Subject (will be encrypted)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="mail-form-group">
            <label className="mail-label">Message</label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>

          {attachments.length > 0 && (
            <div className="mail-attachments-list" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {attachments.map((att, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', gap: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Paperclip size={12} opacity={0.7} />
                  <span>{att.name} <span style={{ opacity: 0.5 }}>({formatSize(att.size)})</span></span>
                  <button type="button" onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mail-compose-footer">
            <div className="mail-e2ee-note">
              <Lock size={11} />
              Encrypted end-to-end with the recipient's public key. Only they can read it.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label className="mail-btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem' }}>
                <Paperclip size={14} /> Attach Files
                <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              <select
                value={ttl || ''}
                onChange={e => setTtl(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', color: '#e2e8f0', padding: '8px', fontSize: '0.85rem', outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="" style={{color: 'black'}}>No Expiration (Keep Forever)</option>
                <option value="1" style={{color: 'black'}}>1 Hour (Burn After Reading)</option>
                <option value="24" style={{color: 'black'}}>24 Hours (1 Day)</option>
                <option value="168" style={{color: 'black'}}>168 Hours (7 Days)</option>
              </select>
              <button type="button" onClick={handleSaveDraft} className="mail-btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem' }} disabled={sending}>
                <Save size={14} /> Save Draft
              </button>
              <button type="submit" className="mail-btn-primary" disabled={sending}>
                {sending
                  ? <><div className="mail-spinner-sm" /> Encrypting…</>
                  : <><Send size={13} /> Send</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
