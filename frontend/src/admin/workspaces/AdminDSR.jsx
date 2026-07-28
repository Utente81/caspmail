import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Loader2 } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminDSR() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    user_email: '', request_type: 'erasure', details: ''
  });

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/dsr');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      } else {
        setError('Failed to load DSR requests');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      const res = await authFetch(`/api/admin/dsr/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        loadRequests();
      } else {
        const data = await res.json();
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_email) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/dsr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ user_email: '', request_type: 'erasure', details: '' });
        loadRequests();
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return { bg: '#fef08a22', color: '#eab308' }; // warning
      case 'in_progress': return { bg: '#3b82f622', color: '#3b82f6' }; // primary
      case 'completed': return { bg: '#22c55e22', color: '#22c55e' }; // success
      case 'rejected': return { bg: '#ef444422', color: '#ef4444' }; // danger
      default: return { bg: '#94a3b822', color: '#94a3b8' }; // neutral
    }
  };

  return (
    <div className="adm-workspace adm-fade-in">
      <div className="adm-workspace-header">
        <div>
          <h2 className="adm-workspace-title">Data Subject Requests (DSR)</h2>
          <p className="adm-workspace-desc">Manage privacy requests (access, erasure, portability).</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Log Request
        </button>
      </div>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Log Data Subject Request</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>User Email</label>
                <input type="email" value={formData.user_email} onChange={e => setFormData({...formData, user_email: e.target.value})} required className="adm-input" placeholder="user@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Request Type</label>
                <select value={formData.request_type} onChange={e => setFormData({...formData, request_type: e.target.value})} className="adm-input" style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }}>
                  <option value="access">Right of Access</option>
                  <option value="erasure">Right to Erasure (Forget)</option>
                  <option value="portability">Data Portability</option>
                  <option value="rectification">Rectification</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Details / Reason</label>
              <textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="adm-input" placeholder="Additional details provided by the data subject..." rows={3} style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }}></textarea>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      <div className="adm-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#0f1929', padding: '5px 10px', borderRadius: '4px', border: '1px solid #1e293b', width: '300px' }}>
            <Search size={14} style={{ color: '#64748b', marginRight: '10px' }} />
            <input type="text" placeholder="Search requests..." style={{ background: 'transparent', border: 'none', color: '#f8fafc', outline: 'none', width: '100%', fontSize: '13px' }} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>}

        {loading ? (
          <p>Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="adm-empty-state">
            <FileText size={40} style={{ color: '#475569', marginBottom: 15 }} />
            <h3>No Data Subject Requests found</h3>
            <p>User requests for data deletion or export will appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '10px 8px' }}>Request ID</th>
                  <th style={{ padding: '10px 8px' }}>User Email</th>
                  <th style={{ padding: '10px 8px' }}>Type</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Submitted</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, index) => {
                  const sColor = getStatusColor(r.status);
                  const reqAlias = 'REQ-' + String(requests.length - index).padStart(3, '0');
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #0f1929' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: '#94a3b8' }}>
                        <span title={`UUID: ${r.id}`}>{reqAlias}</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: '500' }}>{r.user_email}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ textTransform: 'uppercase', background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                          {r.request_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: sColor.bg, color: sColor.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {r.status === 'pending' && (
                          <button className="adm-btn adm-btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: '#3b82f6' }} onClick={() => updateStatus(r.id, 'in_progress')}>Start</button>
                        )}
                        {r.status === 'in_progress' && (
                          <button className="adm-btn adm-btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: '#22c55e' }} onClick={() => updateStatus(r.id, 'completed')}>Complete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
