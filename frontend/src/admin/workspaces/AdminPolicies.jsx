import React, { useState, useEffect } from 'react';
import { Lock, Plus, Search, Loader2 } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminPolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '', content: '', version: '1.0'
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.data || []);
      } else {
        setError('Failed to load Security Policies');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: '', content: '', version: '1.0' });
        loadPolicies();
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
          <h2 className="adm-workspace-title">Security Policies (ISMS)</h2>
          <p className="adm-workspace-desc">Manage organizational security policies and track employee acknowledgments.</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Create Policy
        </button>
      </div>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Publish New Policy</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Policy Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="adm-input" placeholder="e.g. Acceptable Use Policy" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Version</label>
                <input type="text" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} required className="adm-input" placeholder="1.0" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Policy Content</label>
              <textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} required className="adm-input" placeholder="Markdown or plain text content..." rows={5} style={{ width: '100%', padding: '8px', background: '#0f1929', border: '1px solid #1e293b', color: '#fff', borderRadius: '4px' }}></textarea>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Publishing...' : 'Publish Policy'}
            </button>
          </form>
        </div>
      )}

      <div className="adm-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#0f1929', padding: '5px 10px', borderRadius: '4px', border: '1px solid #1e293b', width: '300px' }}>
            <Search size={14} style={{ color: '#64748b', marginRight: '10px' }} />
            <input type="text" placeholder="Search policies..." style={{ background: 'transparent', border: 'none', color: '#f8fafc', outline: 'none', width: '100%', fontSize: '13px' }} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>}

        {loading ? (
          <p>Loading policies...</p>
        ) : policies.length === 0 ? (
          <div className="adm-empty-state">
            <Lock size={40} style={{ color: '#475569', marginBottom: 15 }} />
            <h3>No Security Policies found</h3>
            <p>Publish your first Information Security Policy to track user acceptance.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '10px 8px' }}>Policy Title</th>
                  <th style={{ padding: '10px 8px' }}>Version</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Last Updated</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #0f1929' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{p.title}</td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>v{p.version}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ 
                        background: p.is_active ? '#22c55e22' : '#94a3b822', 
                        color: p.is_active ? '#22c55e' : '#94a3b8', 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' 
                      }}>
                        {p.is_active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{new Date(p.updated_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button className="adm-btn adm-btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }}>Edit</button>
                    </td>
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
