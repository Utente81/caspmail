import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Send, RefreshCw, BarChart2, Mail, Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';
import { encryptMessage, importPublicKeyPem } from '../../mail/crypto.js';

export default function SOCPhishing() {
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [campaignTargets, setCampaignTargets] = useState({});
  const [loadingTargets, setLoadingTargets] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('it-support@acme.com');
  const [subject, setSubject] = useState('ACTION REQUIRED: Reset your password');
  const [body, setBody] = useState('<p>Please click <a href="https://secure.internal/api/soc/simulations/track/click/{TARGET_ID}">here</a> to reset your password immediately.</p><img src="https://secure.internal/api/soc/simulations/track/open/{TARGET_ID}" width="1" height="1" />');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCampaigns();
    loadUsers();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const res = await authFetch('/api/v4/soc/simulations/campaigns');
      if (res.ok) setCampaigns(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function loadUsers() {
    try {
      const res = await authFetch('/api/v4/soc/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const handleDeleteCampaign = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const res = await authFetch(`/api/v4/soc/simulations/campaigns/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadCampaigns();
      } else {
        alert('Failed to delete campaign');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTarget = (email) => {
    if (selectedTargets.includes(email)) {
      setSelectedTargets(selectedTargets.filter(x => x !== email));
    } else {
      setSelectedTargets([...selectedTargets, email]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTargets.length === users.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(users.map(u => u.email));
    }
  };

  const toggleDetails = async (id) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
      return;
    }
    setExpandedCampaign(id);
    if (!campaignTargets[id]) {
      setLoadingTargets(true);
      try {
        const res = await authFetch(`/api/v4/soc/simulations/campaigns/${id}/targets`);
        if (res.ok) {
          const json = await res.json();
          setCampaignTargets(prev => ({ ...prev, [id]: json.data }));
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingTargets(false);
    }
  };

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
        const keyRes = await authFetch(`/api/e2ee/keys/${encodeURIComponent(email)}`);
        let pubKeyStr = null;
        if (keyRes.ok) {
          const resJson = await keyRes.json();
          if (resJson.data && resJson.data.length > 0) {
            pubKeyStr = resJson.data[0].public_key;
          }
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
          const recipientPublicKey = await importPublicKeyPem(pubKeyStr);
          const enc = await encryptMessage(recipientPublicKey, subject, payloadStr);
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

      const res = await authFetch('/api/v4/soc/simulations/campaigns', {
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Targets ({selectedTargets.length} / {users.length})</label>
                <button type="button" className="soc-btn soc-btn-ghost" onClick={handleSelectAll} style={{ padding: '2px 8px', fontSize: '11px' }}>
                  {selectedTargets.length > 0 && selectedTargets.length === users.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', maxHeight: '150px', overflowY: 'auto', background: '#0f1929', padding: '10px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                {users.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTargets.includes(u.email)} 
                      onChange={() => handleToggleTarget(u.email)} 
                    />
                    {u.name || u.email}
                  </label>
                ))}
                {users.length === 0 && <span style={{ color: '#64748b', fontSize: '12px' }}>No users found in this tenant.</span>}
              </div>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ background: '#22c55e22', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  {c.status.toUpperCase()}
                </div>
                <button className="soc-btn soc-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggleDetails(c.id)} title="View Details">
                  {expandedCampaign === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button className="soc-btn soc-btn-ghost" style={{ color: '#ef4444', padding: '4px 8px' }} onClick={() => handleDeleteCampaign(c.id)} title="Delete Campaign">
                  <Trash2 size={14} />
                </button>
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
            
            {expandedCampaign === c.id && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8' }}>Target Details</h4>
                {loadingTargets ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Loading targets...</p>
                ) : campaignTargets[c.id] && campaignTargets[c.id].length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                          <th style={{ padding: '8px 4px' }}>Target Email</th>
                          <th style={{ padding: '8px 4px' }}>Status</th>
                          <th style={{ padding: '8px 4px' }}>Opened</th>
                          <th style={{ padding: '8px 4px' }}>Clicked</th>
                          <th style={{ padding: '8px 4px' }}>Reported</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignTargets[c.id].map(t => (
                          <tr key={t.user_email} style={{ borderBottom: '1px solid #0f1929' }}>
                            <td style={{ padding: '8px 4px' }}>{t.user_email}</td>
                            <td style={{ padding: '8px 4px' }}>
                              {t.reported_at ? <span style={{ color: '#22c55e' }}>Reported</span> : 
                               t.clicked_at ? <span style={{ color: '#ef4444' }}>Compromised</span> : 
                               t.opened_at ? <span style={{ color: '#eab308' }}>Opened</span> : 
                               <span style={{ color: '#64748b' }}>Sent</span>}
                            </td>
                            <td style={{ padding: '8px 4px', color: '#94a3b8' }}>{t.opened_at ? new Date(t.opened_at).toLocaleString() : '-'}</td>
                            <td style={{ padding: '8px 4px', color: '#94a3b8' }}>{t.clicked_at ? new Date(t.clicked_at).toLocaleString() : '-'}</td>
                            <td style={{ padding: '8px 4px', color: '#94a3b8' }}>{t.reported_at ? new Date(t.reported_at).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>No targets found for this campaign.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
