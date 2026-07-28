import React, { useState } from 'react'
import { ShieldCheck, Info } from 'lucide-react'

const ROLES = [
  {
    name: 'admin',
    label: 'Platform Admin',
    color: 'violet',
    permissions: [
      'Manage all tenants, users, and domains',
      'Full access to audit logs',
      'Manage permissions and roles',
      'Access SOC dashboard',
      'View all mail activity',
    ],
  },
  {
    name: 'soc_manager',
    label: 'SOC Manager',
    color: 'blue',
    permissions: [
      'Full SOC dashboard access',
      'Manage SOC cases and alerts',
      'Configure detection rules',
      'Manage threat intel feeds',
      'View audit log (SOC scope)',
    ],
  },
  {
    name: 'soc_analyst',
    label: 'SOC Analyst',
    color: 'cyan',
    permissions: [
      'Read-only SOC dashboard',
      'Acknowledge and comment on alerts',
      'View SOC cases',
      'Cannot modify detection rules',
    ],
  },
  {
    name: 'user',
    label: 'Mail User',
    color: 'slate',
    permissions: [
      'Access own mailbox only',
      'Send and receive email',
      'Manage own E2EE keys',
      'No access to admin or SOC',
    ],
  },
]

const COLOR_MAP = {
  violet: { bg: 'rgba(139,92,246,.12)', border: 'rgba(139,92,246,.25)', text: '#c4b5fd' },
  blue:   { bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.25)',  text: '#93c5fd' },
  cyan:   { bg: 'rgba(34,211,238,.12)',  border: 'rgba(34,211,238,.25)',  text: '#67e8f9' },
  slate:  { bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.25)', text: '#94a3b8' },
}

export default function AdminPermissions() {
  const [selected, setSelected] = useState('admin')
  const role = ROLES.find(r => r.name === selected)
  const c = COLOR_MAP[role.color]

  return (
    <div className="adm-workspace">
      <div className="adm-workspace-header">
        <h2 className="adm-workspace-title">Permissions & Roles</h2>
      </div>

      <div className="adm-alert adm-alert-info">
        <Info size={14} />
        Roles are managed in Keycloak. This view shows the effective permissions per role in CaspMail.
        To assign roles, use the Keycloak admin console at <code>/auth/admin</code>.
      </div>

      <div className="adm-perm-layout">
        <div className="adm-perm-sidebar">
          {ROLES.map(r => {
            const c2 = COLOR_MAP[r.color]
            return (
              <button
                key={r.name}
                className={`adm-perm-role-btn${selected === r.name ? ' active' : ''}`}
                style={selected === r.name ? { borderColor: c2.border, background: c2.bg } : {}}
                onClick={() => setSelected(r.name)}
              >
                <ShieldCheck size={14} style={{ color: c2.text }} />
                <div>
                  <p className="adm-perm-role-name" style={selected === r.name ? { color: c2.text } : {}}>
                    {r.label}
                  </p>
                  <p className="adm-perm-role-key"><code>{r.name}</code></p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="adm-perm-detail" style={{ borderColor: c.border }}>
          <div className="adm-perm-detail-header" style={{ background: c.bg }}>
            <ShieldCheck size={18} style={{ color: c.text }} />
            <div>
              <h3 style={{ color: c.text, margin: 0 }}>{role.label}</h3>
              <code style={{ fontSize: '.75rem', opacity: .7 }}>{role.name}</code>
            </div>
          </div>
          <ul className="adm-perm-list">
            {role.permissions.map((p, i) => (
              <li key={i} className="adm-perm-item">
                <span className="adm-perm-dot" style={{ background: c.text }} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="adm-alert adm-alert-info" style={{ marginTop: '1.5rem' }}>
        <Info size={14} />
        E2EE key operations are always performed client-side. No role can access another user's private key.
      </div>
    </div>
  )
}
