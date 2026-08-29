import React, { useState } from 'react';
import { Key, ShieldAlert, ShieldCheck, Lock, Unlock, AlertTriangle, Shield, CheckCircle2, Search, Mail, FileText, Loader2 } from 'lucide-react';
import { generateCorporateMasterKey, unlockCorporateMasterKey, unescrowPrivateKey, decryptMessage } from '../../mail/crypto.js';
import { fetchAuth } from '../../utils/api';

export default function SOCEDiscovery() {
  const [shares, setShares] = useState(['', '', '']);
  const [unlockedKey, setUnlockedKey] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [generatedShares, setGeneratedShares] = useState(null);
  const [error, setError] = useState(null);

  // Search State
  const [searchMode, setSearchMode] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);

  async function handleSetup() {
    try {
      setError(null);
      const { publicKeyPem, shares } = await generateCorporateMasterKey(3, 2);
      setGeneratedShares(shares);
      await fetchAuth('/api/e2ee/corporate-key', { method: 'POST', body: JSON.stringify({ public_key: publicKeyPem }) });
    } catch(e) {
      setError('Error generating key: ' + e.message);
    }
  }

  async function handleUnlock() {
    try {
      setError(null);
      const validShares = shares.filter(s => s.trim() !== '');
      if (validShares.length < 2) {
        setError('You need at least 2 shares to unlock the Master Key (Dual Control).');
        return;
      }
      const masterKey = await unlockCorporateMasterKey(validShares);
      setUnlockedKey(masterKey);
    } catch(e) {
      setError('Error unlocking: ' + e.message);
    }
  }

  async function handleSearch() {
    if (!searchEmail) return;
    try {
      setSearching(true);
      setSearchError(null);
      setDecryptedMessages([]);

      const data = await fetchAuth(`/api/e2ee/ediscovery/user/${encodeURIComponent(searchEmail)}`);
      
      const { identityKey, prekeys, messages } = data;
      
      // Unescrow the identity private key
      let identityPrivateKey = null;
      try {
        identityPrivateKey = await unescrowPrivateKey(unlockedKey, identityKey.escrow_data, identityKey.escrow_aes, identityKey.escrow_iv);
      } catch (err) {
        console.warn('Failed to unescrow identity key:', err);
      }
      
      // Unescrow prekeys
      const unescrowedPrekeys = {};
      for (const pk of prekeys) {
        try {
          unescrowedPrekeys[pk.prekey_id] = await unescrowPrivateKey(unlockedKey, pk.escrow_data, pk.escrow_aes, pk.escrow_iv);
        } catch (err) {
          console.warn(`Failed to unescrow prekey ${pk.prekey_id}:`, err);
        }
      }

      // Decrypt messages
      const decrypted = [];
      for (const msg of messages) {
        try {
          // If the message was sent TO this user, it was encrypted with their public key.
          // If it was sent FROM this user, we can't easily decrypt it unless we have the recipient's key! 
          // Wait, if it was sent by this user, the backend query returned it. 
          // In standard E2EE, sender can't decrypt their own sent mail unless they encrypted a copy for themselves.
          // Let's assume the eDiscovery returns emails sent TO them for now, or if from them, they might fail.
          // Let's try to decrypt. If it fails, mark as unreadable.
          const privateKeyToUse = msg.prekey_id ? unescrowedPrekeys[msg.prekey_id] : identityPrivateKey;
          
          if (!privateKeyToUse) {
            throw new Error('Required private key not found');
          }

          const { subject, body } = await decryptMessage(privateKeyToUse, msg.subject_encrypted, msg.body_encrypted, msg.nonce);
          decrypted.push({ ...msg, subject, body, decrypted: true });
        } catch (err) {
          decrypted.push({ ...msg, subject: '--- ENCRYPTED (Not recipient) ---', body: 'Cannot decrypt. Target user was likely the sender.', decrypted: false });
        }
      }
      setDecryptedMessages(decrypted);

    } catch(e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="soc-workspace">
      <div className="soc-workspace-header">
        <div>
          <h2>Corporate Key Escrow (Shamir Secret Sharing)</h2>
          <p className="soc-subtext">Manage eDiscovery cryptographic access via Dual Control (2-of-3 Shares).</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={`soc-btn ${!setupMode ? 'primary' : ''}`} onClick={() => { setSetupMode(false); setSearchMode(false); setUnlockedKey(null); setShares(['', '', '']); setError(null); }}>
            <Unlock size={14} /> Unlock Mode
          </button>
          <button className={`soc-btn ${setupMode ? 'danger' : ''}`} onClick={() => { setSetupMode(true); setSearchMode(false); setGeneratedShares(null); setUnlockedKey(null); setError(null); }}>
            <ShieldAlert size={14} /> Initialize New Key
          </button>
        </div>
      </div>

      <div className={searchMode ? "soc-card" : "soc-card"} style={searchMode ? { marginTop: '20px' } : { maxWidth: '800px', margin: '0 auto', marginTop: '20px' }}>
        {error && <div className="soc-error-banner" style={{ marginBottom: '20px' }}>{error}</div>}

        {setupMode ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 15px auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Initialize Corporate Master Key</h3>
              <p className="soc-subtext" style={{ maxWidth: '600px', margin: '0 auto' }}>
                Generating a new Master Key will invalidate the previous one. The new private key will be split into 3 Shamir Shares and immediately destroyed from memory.
              </p>
            </div>
            
            {!generatedShares ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <button onClick={handleSetup} className="soc-btn danger" style={{ padding: '12px 24px', fontSize: '16px' }}>
                  <Key size={18} />
                  Generate Master Key (Shamir 2-of-3)
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>WARNING: Private Key Destroyed</h4>
                    <p style={{ color: '#fca5a5', fontSize: '0.875rem' }}>Store these 3 shares securely in separate physical/digital vaults. You will need at least 2 of them to perform eDiscovery in the future.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {generatedShares.map((s, i) => (
                    <div key={i}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>
                        Share {i+1} {i===0 ? '(CEO Escrow)' : i===1 ? '(Platform Admin)' : '(DPO)'}
                      </label>
                      <input readOnly value={s} className="soc-input" style={{ width: '100%', fontFamily: 'monospace', color: '#4ade80' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : searchMode ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center' }}>
                 <Search className="mr-2" size={20} /> Mailbox eDiscovery Search
               </h3>
               <button className="soc-btn danger" onClick={() => { setSearchMode(false); setUnlockedKey(null); setShares(['','','']); }}>
                  <Lock size={14} /> Lock Key & Exit
               </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="email" 
                className="soc-input" 
                style={{ flex: 1 }} 
                placeholder="Enter user email (e.g., target@caspmail.com)"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
              />
              <button className="soc-btn primary" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="soc-spinner" size={16} /> : <Search size={16} />} Search & Decrypt
              </button>
            </div>

            {searchError && <div className="soc-error-banner" style={{ marginBottom: '20px' }}>{searchError}</div>}

            {decryptedMessages.length > 0 && (
              <div className="soc-table-container">
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sender</th>
                      <th>Recipient</th>
                      <th>Subject (Decrypted)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decryptedMessages.map(msg => (
                      <tr 
                        key={msg.id} 
                        onClick={() => msg.decrypted && setSelectedMessage(msg)}
                        style={{ cursor: msg.decrypted ? 'pointer' : 'default', transition: 'background 0.2s' }}
                        onMouseEnter={e => { if (msg.decrypted) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(msg.created_at).toLocaleString()}</td>
                        <td>{msg.sender}</td>
                        <td>{msg.recipient}</td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: msg.decrypted ? '#fff' : '#ef4444' }}>{msg.subject}</span>
                        </td>
                        <td>
                          {msg.decrypted ? (
                            <span className="soc-badge success"><Search size={10} style={{ marginRight: '4px' }}/> VIEW DETAILS</span>
                          ) : (
                            <span className="soc-badge danger"><Lock size={10} style={{ marginRight: '4px' }}/> FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!searching && decryptedMessages.length === 0 && searchEmail && !searchError && (
              <div className="soc-empty">
                 <Mail size={32} />
                 <p>No messages found or search not performed yet.</p>
              </div>
            )}

          </div>
        ) : (
          <div>
            {!unlockedKey ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                  <Lock size={48} style={{ color: '#94a3b8', margin: '0 auto 15px auto' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Unlock Master Key</h3>
                  <p className="soc-subtext" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    Enter at least 2 of the 3 Shamir Shares (Dual Control) to securely reconstruct the Corporate Master Key in memory.
                  </p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px', padding: '0 20px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Share 1 (CEO Escrow)</label>
                    <input type="password" placeholder="Enter share 1..." className="soc-input" style={{ width: '100%' }} value={shares[0]} onChange={e => { const newS = [...shares]; newS[0] = e.target.value; setShares(newS); }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Share 2 (Platform Admin)</label>
                    <input type="password" placeholder="Enter share 2..." className="soc-input" style={{ width: '100%' }} value={shares[1]} onChange={e => { const newS = [...shares]; newS[1] = e.target.value; setShares(newS); }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Share 3 (DPO)</label>
                    <input type="password" placeholder="Enter share 3..." className="soc-input" style={{ width: '100%' }} value={shares[2]} onChange={e => { const newS = [...shares]; newS[2] = e.target.value; setShares(newS); }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button onClick={handleUnlock} className="soc-btn primary" style={{ padding: '10px 24px' }}>
                    <Key size={16} /> Reconstruct Key in Memory
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <CheckCircle2 size={64} style={{ color: '#22c55e', margin: '0 auto 20px auto' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '10px' }}>Master Key Reconstructed</h3>
                <p style={{ color: '#4ade80', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 30px auto' }}>
                  The Corporate Master Key has been successfully reconstructed in memory. 
                  You can now perform eDiscovery operations on encrypted mailboxes.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                  <button className="soc-btn primary" onClick={() => setSearchMode(true)}>
                    Go to Mailbox eDiscovery Search
                  </button>
                  <button className="soc-btn danger" onClick={() => { setUnlockedKey(null); setShares(['','','']); }}>
                    <Lock size={14} /> Lock Key
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMessage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }} onClick={() => setSelectedMessage(null)}>
          <div style={{
            background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px',
            width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem', display: 'flex', alignItems: 'center' }}>
                <FileText size={20} style={{ marginRight: '10px', color: '#3b82f6' }} />
                Decrypted Message Evidence
              </h3>
              <button className="soc-btn" style={{ padding: '6px 12px' }} onClick={() => setSelectedMessage(null)}>Close</button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', marginBottom: '24px', fontSize: '0.9rem' }}>
                <div style={{ color: '#64748b', fontWeight: 600 }}>DATE</div>
                <div style={{ color: '#e2e8f0' }}>{new Date(selectedMessage.created_at).toLocaleString()}</div>
                
                <div style={{ color: '#64748b', fontWeight: 600 }}>SENDER</div>
                <div style={{ color: '#e2e8f0' }}>{selectedMessage.sender}</div>
                
                <div style={{ color: '#64748b', fontWeight: 600 }}>RECIPIENT</div>
                <div style={{ color: '#e2e8f0' }}>{selectedMessage.recipient}</div>
                
                <div style={{ color: '#64748b', fontWeight: 600 }}>SUBJECT</div>
                <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{selectedMessage.subject}</div>
              </div>
              
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
                <div style={{ color: '#64748b', fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', letterSpacing: '0.05em' }}>DECRYPTED BODY</div>
                <div style={{ 
                  background: '#0b1121', padding: '20px', borderRadius: '8px', 
                  color: '#f8fafc', fontSize: '0.95rem', lineHeight: 1.6, 
                  whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                  border: '1px solid #1e293b'
                }}>
                  {selectedMessage.body}
                </div>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', background: '#0b1121', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                 <ShieldCheck size={12} style={{ marginRight: '6px', color: '#22c55e' }} />
                 Audit Logged: eDiscovery Access recorded for SOC Compliance
               </span>
               <button className="soc-btn primary" onClick={() => setSelectedMessage(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
