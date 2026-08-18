import React, { useState } from 'react'
import { Send, Lock, AlertCircle, CheckCircle, Paperclip, X, Save } from 'lucide-react'
import { encryptMessage, importPublicKeyPem } from '../crypto.js'

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

export default function MailCompose({ keyPair, initialDraft, composeData, onDiscard, onSent }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [contacts, setContacts] = useState([])

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
            const base64Data = event.target.result.split(',')[1]
            resolve({
              name: f.name,
              type: f.type || 'application/octet-stream',
              size: f.size,
              data: base64Data
            })
          }
          reader.readAsDataURL(f)
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
      // Fetch recipient's public key
      const { data: keys } = await apiFetch(`/api/e2ee/keys/${encodeURIComponent(to)}`)
      if (!keys || keys.length === 0) {
        throw new Error(`Recipient ${to} has not set up their encryption keys yet.`)
      }

      // Se ci sono allegati, convertiamo il body in un JSON contenente sia il testo che i file in base64.
      let finalBody = body
      if (attachments.length > 0) {
        finalBody = JSON.stringify({
          text: body,
          attachments: attachments
        })
      }

      // Encrypt for sender ONCE (to save a readable copy in Sent)
      const senderPayload = await encryptMessage(keyPair.publicKey, subject, finalBody)

      // Iterate over all returned keys (useful if "to" is an Alias mapping to multiple members)
      for (let i = 0; i < keys.length; i++) {
        const recipientPublicKey = await importPublicKeyPem(keys[i].public_key)
        const payload = await encryptMessage(recipientPublicKey, subject, finalBody)

        // Send
        await apiFetch('/api/e2ee/messages', {
          method: 'POST',
          body: JSON.stringify({ 
            to_email: keys[i].user_email || to, 
            ...payload,
            // Only save the sender copy on the first message so it doesn't duplicate in "Sent"
            sender_subject_encrypted: i === 0 ? senderPayload.subject_encrypted : null,
            sender_body_encrypted: i === 0 ? senderPayload.body_encrypted : null,
            sender_nonce: i === 0 ? senderPayload.nonce : null
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
      let finalBody = body
      if (attachments.length > 0) {
        finalBody = JSON.stringify({ text: body, attachments: attachments })
      }
      
      // Encrypt with OWN public key
      const payload = await encryptMessage(keyPair.publicKey, subject || '(No subject)', finalBody)
      
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
            <textarea
              className="mail-textarea"
              rows={8}
              placeholder="Write your message here…"
              value={body}
              onChange={e => setBody(e.target.value)}
              required
            />
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
