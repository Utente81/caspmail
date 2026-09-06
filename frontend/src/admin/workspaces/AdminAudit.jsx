import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle, Search } from 'lucide-react'

function api(path) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

const ACTION_COLORS = {
  create: '#4ade80',
  update: '#60a5fa',
  delete: '#f87171',
  verify: '#a78bfa',
}

export default function AdminAudit() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [tenants, setTenants] = useState([])
  const [selectedTenant, setSelectedTenant] = useState('')

  useEffect(() => {
    // Try to load tenants (only casper_admin has access)
    api('/tenants').then(res => {
      if (res.ok) return res.json();
      return { data: [] };
    }).then(data => {
      if (data.data?.length > 0) {
        setTenants(data.data);
        setSelectedTenant(data.data[0].id);
      }
    }).catch(() => {});
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api('/audit?limit=100' + (selectedTenant ? '&tenant_id=' + selectedTenant : ''))
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setRows(data.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (tenants.length > 0 && !selectedTenant) return; load() }, [load, selectedTenant, tenants.length])

  const filtered = rows.filter(r =>
    !filter ||
    r.action?.includes(filter) ||
    r.resource?.includes(filter) ||
    r.actor?.toLowerCase().includes(filter.toLowerCase()) ||
    r.tenant_id?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Audit Log</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="adm-btn adm-btn-primary" onClick={async () => {
            const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
            try {
              const res = await fetch(`/api/admin/audit/export`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (!res.ok) throw new Error('Export failed');
              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'audit_export.csv';
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
            } catch (err) {
              console.error(err);
            }
          }}>Export CSV</button>
          <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error">
          <AlertTriangle size={15} />{error}
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="adm-filter-bar">
        {tenants.length > 0 && (
          <select 
            className="adm-input" 
            value={selectedTenant} 
            onChange={e => setSelectedTenant(e.target.value)}
            style={{ width: 200, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9' }}
          >
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="adm-search">
          <Search size={14} className="adm-search-icon" />
          <input className="adm-search-input" placeholder="Filter by actor, action, resource…"
            value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Tenant</th><th>IP</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 6 }, (_, j) => <td key={j}><div className="adm-skeleton adm-skeleton-row" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="adm-empty">No audit entries found.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td className="adm-td-date">{new Date(r.created_at).toLocaleString()}</td>
                <td className="adm-td-name">{r.actor || '—'}</td>
                <td>
                  <span className="adm-action-badge" style={{ color: ACTION_COLORS[r.action] || '#94a3b8' }}>
                    {r.action}
                  </span>
                </td>
                <td>{r.resource}</td>
                <td><code className="adm-code">{r.tenant_id}</code></td>
                <td className="adm-muted">{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
