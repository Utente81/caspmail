import React, { useState, useEffect, useCallback } from 'react'
import { Building2, Users, Globe, AlertTriangle, RefreshCw } from 'lucide-react'

function api(path) {
  const token = sessionStorage.getItem('caspmail_access_token')
  return fetch(`/api/admin${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

function KPICard({ label, value, icon: Icon, color, loading }) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi-icon" style={{ '--kpi-color': color }}>
        <Icon size={18} />
      </div>
      <div className="adm-kpi-body">
        <p className="adm-kpi-label">{label}</p>
        {loading ? (
          <div className="adm-skeleton adm-skeleton-kpi" />
        ) : (
          <p className="adm-kpi-value">{value ?? '—'}</p>
        )}
      </div>
    </div>
  )
}

export default function AdminOverview({ onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [resSum, resMet] = await Promise.all([
        api('/summary'),
        api('/metrics')
      ])
      if (!resSum.ok) throw new Error(`Summary: ${resSum.status}`)
      if (!resMet.ok) throw new Error(`Metrics: ${resMet.status}`)
      
      setSummary(await resSum.json())
      const metData = await resMet.json()
      setMetrics(metData.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Platform Overview</h2>
        <button className="adm-btn adm-btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'adm-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="adm-alert adm-alert-error">
          <AlertTriangle size={15} />
          {error}
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      <h3 className="adm-section-title" style={{ marginTop: '10px' }}>Global Summary</h3>
      <div className="adm-kpi-grid">
        <KPICard label="Active Tenants"    value={summary?.active_tenants}  icon={Building2}      color="var(--violet)" loading={loading} />
        <KPICard label="Total Users"       value={summary?.total_users}     icon={Users}          color="var(--blue)"   loading={loading} />
        <KPICard label="Verified Domains"  value={summary?.verified_domains} icon={Globe}         color="var(--green)"  loading={loading} />
        <KPICard label="Open SOC Alerts"   value={summary?.open_alerts}     icon={AlertTriangle}  color="var(--amber)"  loading={loading} />
      </div>

      <h3 className="adm-section-title" style={{ marginTop: '24px' }}>E2EE Usage Metrics</h3>
      <div className="adm-kpi-grid">
        <KPICard label="Encrypted Messages" value={metrics?.total_messages} icon={Users} color="var(--violet)" loading={loading} />
        <KPICard label="Storage Used"       value={metrics ? formatBytes(metrics.storage_used_bytes) : null} icon={Building2} color="var(--amber)" loading={loading} />
        <KPICard label="Users with PGP Keys" value={metrics?.users_with_keys} icon={Globe} color="var(--green)" loading={loading} />
      </div>

      <div className="adm-quick-actions">
        <h3 className="adm-section-title">Quick Actions</h3>
        <div className="adm-quick-grid">
          <QuickAction onClick={() => onNavigate && onNavigate('tenants')} label="Add Tenant" desc="Onboard a new organisation" icon="🏢" />
          <QuickAction onClick={() => onNavigate && onNavigate('users')}   label="Add User"   desc="Provision a new account"   icon="👤" />
          <QuickAction onClick={() => onNavigate && onNavigate('domains')} label="Add Domain" desc="Register a mail domain"     icon="🌐" />
          <QuickAction onClick={() => onNavigate && onNavigate('audit')}   label="Audit Log"  desc="Review platform activity"   icon="📋" />
        </div>
      </div>
    </div>
  )
}

function QuickAction({ onClick, label, desc, icon }) {
  return (
    <div onClick={onClick} className="adm-quick-card" style={{ cursor: 'pointer' }}>
      <span className="adm-quick-icon">{icon}</span>
      <div>
        <p className="adm-quick-label">{label}</p>
        <p className="adm-quick-desc">{desc}</p>
      </div>
    </div>
  )
}
