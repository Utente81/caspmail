import React, { useState, useEffect } from 'react';
import { Building2, Plus, ShieldAlert, CheckCircle, FileText, XCircle, Trash2, ShieldCheck } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [serviceProvided, setServiceProvided] = useState('');
  const [riskLevel, setRiskLevel] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/vendors');
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!name || !contactEmail || !serviceProvided) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact_email: contactEmail, service_provided: serviceProvided, risk_level: riskLevel })
      });
      if (res.ok) {
        setShowForm(false);
        setName('');
        setContactEmail('');
        setServiceProvided('');
        setRiskLevel('medium');
        loadVendors();
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this vendor?')) return;
    try {
      const res = await authFetch(`/api/admin/vendors/${id}`, { method: 'DELETE' });
      if (res.ok) loadVendors();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignDPA = async (id) => {
    try {
      const res = await authFetch(`/api/admin/vendors/${id}/dpa/sign`, { method: 'POST' });
      if (res.ok) loadVendors();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssess = async (id) => {
    const scoreStr = prompt('Enter assessment score (0-100):', '100');
    if (scoreStr === null) return;
    const score = parseInt(scoreStr, 10) || 100;
    try {
      const res = await authFetch(`/api/admin/vendors/${id}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
      if (res.ok) loadVendors();
    } catch (err) {
      console.error(err);
    }
  };

  const renderRiskBadge = (level) => {
    const colors = {
      low: '#22c55e',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444'
    };
    return (
      <span style={{ background: `${colors[level]}22`, color: colors[level], padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
        {level}
      </span>
    );
  };

  return (
    <div className="adm-workspace adm-fade-in">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Vendor Risk Management</h2>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Add Vendor
        </button>
      </div>
      <p className="adm-workspace-desc">
        Manage third-party supply chain risk (NIS2) and track Data Processing Agreements (GDPR).
      </p>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Register New Vendor</h3>
          <form onSubmit={handleAddVendor} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Vendor Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="adm-input" placeholder="e.g. Acme Cloud Services" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Contact Email</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required className="adm-input" placeholder="compliance@vendor.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Service Provided</label>
                <input type="text" value={serviceProvided} onChange={e => setServiceProvided(e.target.value)} required className="adm-input" placeholder="e.g. Cloud Hosting, Analytics" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Risk Level</label>
                <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="adm-input" style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }}>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Saving...' : 'Register Vendor'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading vendors...</p>
      ) : vendors.length === 0 ? (
        <div className="adm-empty-state">
          <Building2 size={40} style={{ color: '#475569', marginBottom: 15 }} />
          <h3>No Vendors Found</h3>
          <p>Register your first vendor to start tracking supply chain compliance.</p>
        </div>
      ) : (
        <div className="adm-grid">
          {vendors.map(v => (
            <div key={v.id} className="adm-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{v.name}</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{v.service_provided}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{v.contact_email}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {renderRiskBadge(v.risk_level)}
                  <button className="adm-btn adm-btn-ghost" style={{ color: '#ef4444', padding: '4px 8px' }} onClick={() => handleDelete(v.id)} title="Remove Vendor">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}><FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/>DPA Status (GDPR)</div>
                  {v.dpa_status === 'valid' ? (
                    <div style={{ color: '#22c55e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={14}/> Valid (Signed: {new Date(v.dpa_signed_at).toLocaleDateString()})</div>
                  ) : (
                    <div style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><XCircle size={14}/> Missing or Expired</div>
                  )}
                </div>
                {v.dpa_status !== 'valid' && (
                  <button className="adm-btn adm-btn-ghost" onClick={() => handleSignDPA(v.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>Mark as Signed</button>
                )}
              </div>

              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}><ShieldCheck size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/>Security Assessment (NIS2)</div>
                  {v.assessment_status === 'completed' ? (
                    <div style={{ color: '#22c55e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={14}/> Completed (Score: {v.assessment_score}/100)</div>
                  ) : (
                    <div style={{ color: '#eab308', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldAlert size={14}/> Pending Assessment</div>
                  )}
                </div>
                {v.assessment_status !== 'completed' && (
                  <button className="adm-btn adm-btn-ghost" onClick={() => handleAssess(v.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>Complete Assessment</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
