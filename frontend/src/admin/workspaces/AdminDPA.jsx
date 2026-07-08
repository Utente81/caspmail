import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Loader2 } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminDPA() {
  const [dpas, setDpas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [vendorName, setVendorName] = useState('');
  const [title, setTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDpas();
  }, []);

  const loadDpas = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/dpas');
      if (res.ok) {
        const json = await res.json();
        setDpas(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAddDPA = async (e) => {
    e.preventDefault();
    if (!vendorName || !title || !expiryDate) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/dpas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: vendorName, title, expiry_date: expiryDate, document_url: documentUrl })
      });
      if (res.ok) {
        setShowForm(false);
        setVendorName('');
        setTitle('');
        setExpiryDate('');
        setDocumentUrl('');
        loadDpas();
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await authFetch(`/api/admin/dpas/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        loadDpas();
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'danger';
      case 'pending': return 'warning';
      default: return 'neutral';
    }
  };

  return (
    <div className="adm-workspace adm-fade-in">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Contract Manager (DPA)</h2>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Upload DPA
        </button>
      </div>
      <p className="adm-workspace-desc">
        Manage Data Processing Agreements with your vendors and track expiration dates.
      </p>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Add New DPA Agreement</h3>
          <form onSubmit={handleAddDPA} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Vendor Name</label>
                <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required className="adm-input" placeholder="e.g. Acme Corp" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Title/Description</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="adm-input" placeholder="e.g. Cloud Hosting DPA 2026" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Expiry Date</label>
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required className="adm-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Document URL (Optional)</label>
                <input type="url" value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} className="adm-input" placeholder="https://docs.google.com/..." />
              </div>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Adding...' : 'Save DPA'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading agreements...</p>
      ) : dpas.length === 0 ? (
        <div className="adm-empty-state">
          <FileText size={40} style={{ color: '#475569', marginBottom: 15 }} />
          <h3>No DPA Agreements Found</h3>
          <p>Upload your first DPA to start tracking.</p>
        </div>
      ) : (
        <div className="adm-grid">
          {dpas.map(dpa => (
            <div key={dpa.id} className="adm-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{dpa.title}</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Vendor: {dpa.vendor_name}</div>
                </div>
              </div>

              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
                  <strong>Expiry Date:</strong> {dpa.expiry_date ? new Date(dpa.expiry_date).toLocaleDateString() : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  <strong>Signed Date:</strong> {dpa.signed_at ? new Date(dpa.signed_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`adm-badge adm-badge-status ${dpa.status === 'active' ? 'active' : dpa.status === 'expired' ? 'inactive' : 'pending'}`}>
                  {dpa.status.toUpperCase()}
                </span>
                <select 
                  className="adm-select" 
                  value={dpa.status}
                  onChange={(e) => updateStatus(dpa.id, e.target.value)}
                  style={{ padding: '4px 24px 4px 8px', fontSize: '11px', width: 'auto' }}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
