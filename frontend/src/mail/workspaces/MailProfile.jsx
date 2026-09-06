import React, { useState, useEffect } from 'react'
import { User, Mail, Shield, HardDrive, AlertCircle } from 'lucide-react'

function apiFetch(path) {
  const token = (window.memoryStorage.getItem('caspmail_access_token') || window.memoryStorage.getItem('caspmail_access_token'))
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(async r => {
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
    return data
  })
}

function Badge({ children, variant = 'default' }) {
  return <span className={`mail-badge mail-badge-${variant}`}>{children}</span>
}

export default function MailProfile() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/api/me/dashboard')
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mail-profile">
        <div className="mail-profile-card">
          <div className="mail-skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 20 }} />
          <div className="mail-skeleton" style={{ height: 24, width: '60%', marginBottom: 10 }} />
          <div className="mail-skeleton" style={{ height: 16, width: '40%' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mail-profile">
        <div className="mail-alert-error"><AlertCircle size={14} /> {error}</div>
      </div>
    )
  }

  const { user, inbox, has_keys, key_fingerprint, storage } = data || {}

  const roleVariant = {
    admin: 'violet',
    casper_admin: 'violet',
    soc_analyst: 'blue',
    soc_manager: 'cyan',
    user: 'slate',
  }[user?.role] || 'slate'

  return (
    <div className="mail-profile">
      <div className="mail-profile-card">
        <div className="mail-profile-top">
          <div className="mail-profile-avatar">
            <User size={28} />
          </div>
          <div className="mail-profile-info">
            <h2 className="mail-profile-name">{user?.name || '—'}</h2>
            <p className="mail-profile-email">{user?.email}</p>
            <div style={{ marginTop: 8 }}>
              <Badge variant={roleVariant}>{user?.role?.replace('_', ' ')}</Badge>
            </div>
          </div>
        </div>

        <div className="mail-profile-stats">
          <div className="mail-stat-card">
            <Mail size={18} className="mail-stat-icon blue" />
            <div className="mail-stat-val">{inbox?.total || 0}</div>
            <div className="mail-stat-label">Total Messages</div>
          </div>
          <div className="mail-stat-card">
            <Mail size={18} className="mail-stat-icon amber" />
            <div className="mail-stat-val">{inbox?.unread || 0}</div>
            <div className="mail-stat-label">Unread</div>
          </div>
          <div className="mail-stat-card">
            <HardDrive size={18} className={`mail-stat-icon ${(storage?.used_pct || 0) >= 90 ? 'amber' : 'green'}`} />
            <div className="mail-stat-val">{storage?.used_mb ?? 0} MB</div>
            <div className="mail-stat-label">Used / {storage?.quota_mb ?? user?.quota_mb ?? 0} MB</div>
          </div>
          <div className="mail-stat-card">
            <Shield size={18} className={`mail-stat-icon ${has_keys ? 'green' : 'amber'}`} />
            <div className="mail-stat-val">{has_keys ? 'Active' : 'None'}</div>
            <div className="mail-stat-label">E2EE Keys</div>
          </div>
        </div>

        <div className="mail-profile-detail">
          <div className="mail-detail-row">
            <span className="mail-detail-label">Tenant</span>
            <code>{user?.tenant_id}</code>
          </div>
          <div className="mail-detail-row">
            <span className="mail-detail-label">Account Status</span>
            <Badge variant={user?.status === 'active' ? 'green' : 'slate'}>{user?.status}</Badge>
          </div>
          <div className="mail-detail-row">
            <span className="mail-detail-label">Member Since</span>
            <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
          </div>
          {storage && (
            <div className="mail-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <span className="mail-detail-label">Storage Quota</span>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', marginBottom: 4 }}>
                  <span style={{ color: storage.used_pct >= 90 ? '#f59e0b' : '#22c55e' }}>
                    {storage.used_mb} MB used
                  </span>
                  <span style={{ color: '#7f8ea3' }}>{storage.quota_mb} MB total</span>
                </div>
                <div style={{ height: 6, background: '#1a2535', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, transition: 'width .4s',
                    width: `${storage.used_pct}%`,
                    background: storage.used_pct >= 90 ? '#f59e0b' : storage.used_pct >= 70 ? '#3b82f6' : '#22c55e',
                  }} />
                </div>
                <div style={{ fontSize: '.72rem', color: '#7f8ea3', marginTop: 4 }}>
                  {storage.used_pct}% of quota used
                </div>
              </div>
            </div>
          )}
          {key_fingerprint && (
            <div className="mail-detail-row">
              <span className="mail-detail-label">Key Fingerprint</span>
              <code className="mail-fingerprint">{key_fingerprint}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
