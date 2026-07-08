import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Loader2 } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminRoPA() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    process_name: '', data_categories: '', data_subjects: '', legal_basis: 'Consent', retention_period: ''
  });

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/ropa');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      } else {
        setError('Failed to load RoPA records');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.process_name || !formData.data_categories) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/ropa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ process_name: '', data_categories: '', data_subjects: '', legal_basis: 'Consent', retention_period: '' });
        loadRecords();
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  return (
    <div className="adm-workspace adm-fade-in">
      <div className="adm-workspace-header">
        <div>
          <h2 className="adm-workspace-title">Record of Processing Activities (RoPA)</h2>
          <p className="adm-workspace-desc">Manage Article 30 GDPR data processing records.</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> New Record
        </button>
      </div>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Register Processing Activity</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Process Name</label>
                <input type="text" value={formData.process_name} onChange={e => setFormData({...formData, process_name: e.target.value})} required className="adm-input" placeholder="e.g. Payroll Processing" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Data Categories</label>
                <input type="text" value={formData.data_categories} onChange={e => setFormData({...formData, data_categories: e.target.value})} required className="adm-input" placeholder="e.g. Name, Salary, SSN" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Data Subjects</label>
                <input type="text" value={formData.data_subjects} onChange={e => setFormData({...formData, data_subjects: e.target.value})} required className="adm-input" placeholder="e.g. Employees" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Legal Basis</label>
                <select value={formData.legal_basis} onChange={e => setFormData({...formData, legal_basis: e.target.value})} className="adm-input" style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }}>
                  <option value="Consent">Consent</option>
                  <option value="Contract">Contract</option>
                  <option value="Legal Obligation">Legal Obligation</option>
                  <option value="Legitimate Interest">Legitimate Interest</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Retention Period</label>
                <input type="text" value={formData.retention_period} onChange={e => setFormData({...formData, retention_period: e.target.value})} required className="adm-input" placeholder="e.g. 10 Years" />
              </div>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Saving...' : 'Save Record'}
            </button>
          </form>
        </div>
      )}

      <div className="adm-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#0f1929', padding: '5px 10px', borderRadius: '4px', border: '1px solid #1e293b', width: '300px' }}>
            <Search size={14} style={{ color: '#64748b', marginRight: '10px' }} />
            <input type="text" placeholder="Search processes..." style={{ background: 'transparent', border: 'none', color: '#f8fafc', outline: 'none', width: '100%', fontSize: '13px' }} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>}

        {loading ? (
          <p>Loading records...</p>
        ) : records.length === 0 ? (
          <div className="adm-empty-state">
            <Database size={40} style={{ color: '#475569', marginBottom: 15 }} />
            <h3>No RoPA records found</h3>
            <p>Start mapping your data processing activities for GDPR compliance.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '10px 8px' }}>Process Name</th>
                  <th style={{ padding: '10px 8px' }}>Data Categories</th>
                  <th style={{ padding: '10px 8px' }}>Data Subjects</th>
                  <th style={{ padding: '10px 8px' }}>Legal Basis</th>
                  <th style={{ padding: '10px 8px' }}>Retention</th>
                  <th style={{ padding: '10px 8px' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #0f1929' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{r.process_name}</td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>{r.data_categories}</td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>{r.data_subjects}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#94a3b8' }}>
                        {r.legal_basis}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>{r.retention_period}</td>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{new Date(r.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
