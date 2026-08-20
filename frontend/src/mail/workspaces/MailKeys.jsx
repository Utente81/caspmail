import React, { useState, useEffect } from 'react'
import { Key, ShieldCheck, AlertCircle, RefreshCw, Trash2, CheckCircle, Download, Upload } from 'lucide-react'
import {
  generateKeyPair, exportPublicKeyPem, exportPrivateKeyPem, fingerprintPublicKey,
  storeKeyPair, loadKeyPair, deleteKeyPair,
  encryptPrivateKey, decryptPrivateKey, importPublicKeyPem,
  generatePreKeys, storePreKey, decryptPreKey
} from '../crypto.js'

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

export default function MailKeys({ keyPair, onKeyChange }) {
  const [localKey, setLocalKey] = useState(keyPair)
  const [serverKey, setServerKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [restorePassword, setRestorePassword] = useState('')

  useEffect(() => { setLocalKey(keyPair) }, [keyPair])

  useEffect(() => {
    apiFetch('/api/e2ee/me/keys')
      .then(data => setServerKey(data.data?.[0] || null))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    if (!recoveryPassword || recoveryPassword.length < 8) {
      setError('Please provide a recovery password (min 8 chars) to backup your private key securely.')
      return
    }
    if (localKey && !confirm('This will replace your current keypair. Old encrypted messages will no longer be readable. Continue?')) return
    
    setGenerating(true)
    setError(null)
    setSuccess(null)
    try {
      const kp = await generateKeyPair()
      const pem = await exportPublicKeyPem(kp.publicKey)
      const fingerprint = await fingerprintPublicKey(kp.publicKey)
      
      const { private_key_encrypted, private_key_salt } = await encryptPrivateKey(kp.privateKey, recoveryPassword)

      await storeKeyPair(kp)
      const reg = await apiFetch('/api/e2ee/me/keys', {
        method: 'POST',
        body: JSON.stringify({ 
          public_key: pem, 
          key_fingerprint: fingerprint,
          private_key_encrypted,
          private_key_salt
        }),
      })

      // Generate 200 PreKeys
      setSuccess('Generating 200 Perfect Forward Secrecy PreKeys in background...')
      setTimeout(async () => {
        try {
          const prekeys = await generatePreKeys(200, recoveryPassword);
          await apiFetch('/api/e2ee/me/prekeys', {
            method: 'POST',
            body: JSON.stringify({ keys: prekeys })
          });
          setSuccess('Keypair and 200 PFS PreKeys generated and backed up securely. You can now use CaspMail.')
        } catch(e) {
          console.error('PreKeys generation error', e)
        }
      }, 100);

      setLocalKey(kp)
      setServerKey(reg)
      setRecoveryPassword('')
      if (onKeyChange) onKeyChange(kp)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRestore() {
    if (!restorePassword) {
      setError('Please enter your recovery password.')
      return
    }
    setRestoring(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (!serverKey?.private_key_encrypted || !serverKey?.private_key_salt) {
        throw new Error('No encrypted backup found on the server.')
      }
      
      const privateKey = await decryptPrivateKey(
        serverKey.private_key_encrypted, 
        serverKey.private_key_salt, 
        restorePassword
      )
      
      const publicKey = await importPublicKeyPem(serverKey.public_key)
      
      const kp = { publicKey, privateKey }
      await storeKeyPair(kp)
      
      setSuccess('Private key successfully restored! Syncing PreKeys...')
      try {
        const syncRes = await apiFetch('/api/e2ee/me/prekeys/sync')
        if (syncRes.data) {
          for (const k of syncRes.data) {
            try {
              const preKeyPriv = await decryptPreKey(k.private_key_encrypted, restorePassword)
              const preKeyPub = await importPublicKeyPem(k.public_key)
              await storePreKey(k.prekey_id, { publicKey: preKeyPub, privateKey: preKeyPriv })
            } catch(e) {}
          }
        }
      } catch(e) {
        console.error('PreKey sync error', e)
      }

      setLocalKey(kp)
      setRestorePassword('')
      if (onKeyChange) onKeyChange(kp)
      setSuccess('Keys and PreKeys successfully restored from backup!')
    } catch (err) {
      console.error('[restore-key-error]', err)
      setError('Failed to restore. The password might be incorrect.')
    } finally {
      setRestoring(false)
    }
  }

  async function handleExportKeyPair() {
    if (!localKey) return;
    try {
      const pubPem = await exportPublicKeyPem(localKey.publicKey)
      const privPem = await exportPrivateKeyPem(localKey.privateKey)
      const combined = `${pubPem}\n\n${privPem}`
      
      const blob = new Blob([combined], { type: 'application/x-pem-file' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `caspmail-keypair-${new Date().toISOString().split('T')[0]}.pem`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess('KeyPair exported successfully.')
    } catch (e) {
      setError('Failed to export keypair: ' + e.message)
    }
  }

  async function handleDeleteLocal() {
    if (!confirm('Delete local private key? You will have to restore it from your backup password.')) return
    await deleteKeyPair()
    setLocalKey(null)
    if (onKeyChange) onKeyChange(null)
    setSuccess('Local private key deleted.')
  }

  const localOk = !!localKey
  const serverOk = !!serverKey

  return (
    <div className="mail-keys">
      <div className="mail-keys-card">
        <div className="mail-keys-header">
          <Key size={16} className="mail-keys-icon" />
          <div>
            <h2 className="mail-keys-title">End-to-End Encryption Keys</h2>
            <p className="mail-keys-sub">Your keys secure your messages.</p>
          </div>
        </div>

        {error && (
          <div className="mail-alert-error"><AlertCircle size={14} /> {error}</div>
        )}
        {success && (
          <div className="mail-alert-success"><CheckCircle size={14} /> {success}</div>
        )}

        <div className="mail-keys-status-grid">
          <div className={`mail-key-status-card${localOk ? ' ok' : ' missing'}`}>
            <div className="mail-key-status-dot" />
            <div>
              <div className="mail-key-status-label">Local Private Key</div>
              <div className="mail-key-status-val">
                {localOk ? 'Stored in browser (IndexedDB)' : 'Not found on this device'}
              </div>
            </div>
          </div>
          <div className={`mail-key-status-card${serverOk ? ' ok' : ' missing'}`}>
            <div className="mail-key-status-dot" />
            <div>
              <div className="mail-key-status-label">Public Key (Server)</div>
              <div className="mail-key-status-val">
                {serverOk
                  ? <code className="mail-fingerprint">{serverKey.key_fingerprint}</code>
                  : 'Not registered'
                }
              </div>
            </div>
          </div>
        </div>

        {!localOk && serverOk && serverKey.private_key_encrypted && (
          <div className="mail-key-restore-section" style={{ marginTop: '1.5rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={16} /> Restore Key from Backup
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px' }}>
              We found an encrypted backup of your private key on the server. Enter your Recovery Password to restore it to this device.
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input 
                type="password" 
                placeholder="Recovery Password" 
                value={restorePassword}
                onChange={e => setRestorePassword(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '4px' }}
              />
              <button className="mail-btn-primary" onClick={handleRestore} disabled={restoring}>
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        )}

        <div className="mail-key-generate-section" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} /> {localOk ? 'Regenerate Keys' : 'Generate New Keys'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px' }}>
            Choose a strong Recovery Password. It will be used to encrypt a backup of your private key so you can restore it on other devices. If you lose this password, you cannot recover your old messages.
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <input 
              type="password" 
              placeholder="Set Recovery Password (min 8 chars)" 
              value={recoveryPassword}
              onChange={e => setRecoveryPassword(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '4px' }}
            />
            <button className="mail-btn-primary" onClick={handleGenerate} disabled={generating || loading}>
              {generating ? 'Generating…' : 'Generate & Backup'}
            </button>
          </div>
        </div>

        {localOk && (
          <div className="mail-keys-actions" style={{ marginTop: '2rem', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={handleExportKeyPair} style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              padding: '10px 20px', 
              minWidth: '220px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.6)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.4)'; }}
            >
              <Download size={16} /> Export KeyPair (.pem)
            </button>
            <button onClick={handleDeleteLocal} style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              padding: '10px 20px', 
              minWidth: '220px',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)'; }}
            >
              <Trash2 size={16} /> Remove Local Key
            </button>
          </div>
        )}

        <div className="mail-alert-info" style={{ marginTop: '1.5rem' }}>
          <ShieldCheck size={14} />
          <div>
            <strong>Security note:</strong> The server receives an AES-256 encrypted copy of your private key. Because it doesn't know your Recovery Password, it cannot decrypt it. Your data remains perfectly End-to-End Encrypted.
          </div>
        </div>
      </div>
    </div>
  )
}
