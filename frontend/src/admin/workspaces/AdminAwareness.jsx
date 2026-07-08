import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, CheckCircle, ShieldAlert, BookOpen } from 'lucide-react';
import { authFetch } from '../../auth/tokenRefresh.js';

export default function AdminAwareness() {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [userEmail, setUserEmail] = useState('');
  const [courseName, setCourseName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTrainings();
  }, []);

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/trainings');
      if (res.ok) {
        const json = await res.json();
        setTrainings(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!userEmail || !courseName) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: userEmail, course_name: courseName })
      });
      if (res.ok) {
        setShowForm(false);
        setUserEmail('');
        setCourseName('');
        loadTrainings();
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await authFetch(`/api/admin/trainings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, score: newStatus === 'completed' ? 100 : null })
      });
      if (res.ok) {
        loadTrainings();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="adm-workspace adm-fade-in">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Security Training Tracker</h2>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Assign Course
        </button>
      </div>
      <p className="adm-workspace-desc">
        Track employee completion of mandatory cyber security training (NIS2 / ISO 27001).
      </p>

      {showForm && (
        <div className="adm-panel" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3>Assign New Course</h3>
          <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Employee Email</label>
                <input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} required className="adm-input" placeholder="user@caspermail.it" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Course Name</label>
                <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} required className="adm-input" placeholder="e.g. Cyber Hygiene 101" />
              </div>
            </div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Assigning...' : 'Assign Training'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading records...</p>
      ) : trainings.length === 0 ? (
        <div className="adm-empty-state">
          <GraduationCap size={40} style={{ color: '#475569', marginBottom: 15 }} />
          <h3>No Training Records Found</h3>
          <p>Assign your first training course to an employee.</p>
        </div>
      ) : (
        <div className="adm-grid">
          {trainings.map(t => (
            <div key={t.id} className="adm-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{t.course_name}</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.user_email}</div>
                </div>
              </div>
              
              <div style={{ background: '#0f1929', padding: '15px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}><BookOpen size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/>Course Status</div>
                  {t.status === 'completed' ? (
                    <div style={{ color: '#22c55e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={14}/> Completed (Score: {t.score}%)</div>
                  ) : (
                    <div style={{ color: '#eab308', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldAlert size={14}/> Pending Completion</div>
                  )}
                </div>
                {t.status !== 'completed' && (
                  <button className="adm-btn adm-btn-ghost" onClick={() => handleUpdateStatus(t.id, 'completed')} style={{ padding: '4px 8px', fontSize: '11px' }}>Mark as Completed</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
