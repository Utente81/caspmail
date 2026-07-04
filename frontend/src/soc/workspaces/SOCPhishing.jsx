import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Send, RefreshCw, BarChart2, Mail, Users, Trash2 } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';
import { encryptMessage } from '../../mail/crypto.js';

export default function SOCPhishing() {
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('it-support@acme.com');
  const [subject, setSubject] = useState('ACTION REQUIRED: Reset your password');
  const [body, setBody] = useState('<p>Please click <a href="https://api.caspmail.local/api/v4/soc/phishing/track/click/{TARGET_ID}">here</a> to reset your password immediately.</p><img src="https://api.caspmail.local/api/v4/soc/phishing/track/open/{TARGET_ID}" width="1" height="1" />');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCampaigns();
    loadUsers();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const res = await authFetch('/api/v4/soc/phishing/campaigns');
      if (res.ok) setCampaigns(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function loadUsers() {
    try {
      // Assuming there's a way to get users in the tenant, or we just type them manually
      // Since we might not have a generic users API exposed for the SOC, we'll allow manual entry
    } catch (e) {
      console.error(e);
    }
  }

  // To do true E2EE, the frontend would normally fetch public keys and encrypt here.
  // For the sake of the phishing simulator, if we don't have an endpoint to fetch all public keys easily,
  // we can mock the encryption (assuming the recipient's private key doesn't actually decrypt the spoofed message 
  // because it's just a simulation and they might not have a valid key for the spoofed sender anyway, 
  // but to render in the inbox, it must be valid AES). 
  // Actually, we must use real E2EE encryption if the inbox expects it!
  // To encrypt, we need the target's public key.
  
  async function handleCreateCampaign(e) {
    e.preventDefault();
    if (!name || !senderEmail || selectedTargets.length === 0) return alert('Fill all fields');
    
    setSubmitting(true);
    try {
      // 1. Fetch public keys for selected targets
      const targetsPayload = [];
      
      for (const email of selectedTargets) {
        // Fetch public key
        const keyRes = await authFetch(`/api/v4/mail/keys/${encodeURIComponent(email)}`);
        let pubKeyStr = null;
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          pubKeyStr = keyData.public_key;
        }
        
        if (!pubKeyStr) {
          console.warn(`No public key for ${email}, skipping...`);
          continue;
        }
        
        // Let's assume we have window.caspmailCrypto from MailApp to encrypt
        // For this simulator, we might have to bypass the real E2EE and just send plaintext if the backend allows,
        // BUT the inbox requires AES.
        // As a workaround, we will just send the plaintext string wrapped in JSON, and modify the mail client to 
        // fall back to rendering plaintext if decryption fails, OR we actually encrypt it.
        // Since we are not importing the complex crypto logic here, we'll send it as base64 to fake it, 
        // and modify MailInbox to detect phishing simulations!
        
        // We use real E2EE encryption to inject the phishing email
        const targetId = crypto.randomUUID();
        const payloadStr = JSON.stringify({ text: body.replace(/\{TARGET_ID\}/g, targetId) }); 
        
        try {
          const enc = await encryptMessage(pubKeyStr, subject, payloadStr);
          targetsPayload.push({
            id: targetId,
            user_email: email,
            subject_encrypted: enc.subject_encrypted,
            body_encrypted: enc.body_encrypted,
            nonce: enc.nonce
          });
        } catch (err) {
          console.error("Encryption failed for", email, err);
        }
      }

      if (targetsPayload.length === 0) {
        alert('No valid targets found with public keys.');
        setSubmitting(false);
        return;
      }

      const payload = {
        name,
        sender_email: senderEmail,
        targets: targetsPayload
      };

      const res = await authFetch('/api/v4/soc/phishing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowForm(false);
        setName('');
        setSelectedTargets([]);
        loadCampaigns();
      } else {
        alert('Error creating campaign');
      }
    } catch (e) {
      console.error(e);
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  }

  const handleAddTarget = () => {
    const email = prompt('Enter target email:');
    if (email && !selectedTargets.includes(email)) {
      setSelectedTargets([...selectedTargets, email]);
    }
  };

  return (
    <div className="soc-workspace soc-fade-in">
      <div className="soc-workspace-header">
        <h2 className="soc-workspace-title">Phishing Simulator</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="soc-btn soc-btn-ghost" onClick={loadCampaigns}><RefreshCw size={14} /> Refresh</button>
          <button className="soc-btn soc-btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> New Campaign
          </button>
        </div>
      </div>

      {showForm && (
        <div className="soc-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Create New Phishing Campaign</h3>
          <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Campaign Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Spoofed Sender Email</label>
              <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>HTML Body (Note: Links and pixels will have {`{TARGET_ID}`} injected by backend automatically. Just use standard tracking macros.)</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required rows={4} style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Targets ({selectedTargets.length})</label>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {selectedTargets.map(t => (
                  <span key={t} style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {t} <Trash2 size={12} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => setSelectedTargets(selectedTargets.filter(x => x !== t))} />
                  </span>
                ))}
              </div>
              <button type="button" className="soc-btn soc-btn-ghost" onClick={handleAddTarget}><Plus size={14} /> Add Target</button>
            </div>
            <button type="submit" className="soc-btn soc-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Launching...' : <><Send size={14} /> Launch Campaign</>}
            </button>
          </form>
        </div>
      )}

      <div className="soc-grid">
        {loading ? (
          <p>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="soc-empty-state">
            <ShieldAlert size={40} style={{ color: '#475569', marginBottom: 15 }} />
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#e2e8f0' }}>No Phishing Campaigns</h3>
            <p style={{ margin: 0, fontSize: '.9rem', color: '#94a3b8', maxWidth: 400 }}>
              Launch simulated phishing attacks to train users and test incident response processes.
            </p>
          </div>
        ) : campaigns.map(c => (
          <div key={c.id} className="soc-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{c.name}</h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sent from: {c.sender_email}</div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Started: {new Date(c.created_at).toLocaleString()}</div>
              </div>
              <div style={{ background: '#22c55e22', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                {c.status.toUpperCase()}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '20px' }}>
              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '5px' }}>OPEN RATE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {c.total_targets > 0 ? Math.round((c.opened_count / c.total_targets) * 100) : 0}%
                </div>
                <div style={{ fontSize: '10px', color: '#475569' }}>{c.opened_count} / {c.total_targets}</div>
              </div>
              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '5px' }}>CLICK RATE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                  {c.total_targets > 0 ? Math.round((c.clicked_count / c.total_targets) * 100) : 0}%
                </div>
                <div style={{ fontSize: '10px', color: '#475569' }}>{c.clicked_count} / {c.total_targets}</div>
              </div>
              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '5px' }}>REPORT RATE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                  {c.total_targets > 0 ? Math.round((c.reported_count / c.total_targets) * 100) : 0}%
                </div>
                <div style={{ fontSize: '10px', color: '#475569' }}>{c.reported_count} / {c.total_targets}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
