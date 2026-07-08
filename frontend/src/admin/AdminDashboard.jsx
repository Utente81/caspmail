import React, { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Building2,
  Users,
  Globe,
  KeyRound,
  ClipboardList,
  Settings,
  ChevronDown,
  LogOut,
  Shield,
  ShieldCheck,
  User,
  Bell,
  FileText,
  Database,
  Lock
} from 'lucide-react'
import AdminOverview from './workspaces/AdminOverview'
import AdminTenants from './workspaces/AdminTenants'
import AdminUsers from './workspaces/AdminUsers'
import AdminDomains from './workspaces/AdminDomains'
import AdminPermissions from './workspaces/AdminPermissions'
import AdminAudit from './workspaces/AdminAudit'
import AdminAliases from './workspaces/AdminAliases'
import AdminRoPA from './workspaces/AdminRoPA'
import AdminDSR from './workspaces/AdminDSR'
import AdminPolicies from './workspaces/AdminPolicies'
import AdminVendors from './workspaces/AdminVendors'
import AdminDPA from './workspaces/AdminDPA'
import AdminAwareness from './workspaces/AdminAwareness'

const NAV = [
  {
    group: 'Platform',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    group: 'GRC & Compliance',
    items: [
      { id: 'ropa', label: 'Processing Activities', icon: Database },
      { id: 'dsr', label: 'Data Subject Requests', icon: FileText },
      { id: 'dpas', label: 'Contract Manager', icon: FileText },
      { id: 'vendors', label: 'Vendor Risk', icon: Building2 },
      { id: 'policies', label: 'Security Policies', icon: Lock },
      { id: 'awareness', label: 'Security Training', icon: Users },
    ],
  },
  {
    group: 'Management',
    items: [
      { id: 'tenants', label: 'Tenants', icon: Building2 },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'domains', label: 'Domains', icon: Globe },
      { id: 'aliases', label: 'Groups & Aliases', icon: Users },
    ],
  },
  {
    group: 'Security',
    items: [
      { id: 'permissions', label: 'Permissions & Roles', icon: KeyRound },
      { id: 'audit', label: 'Audit Log', icon: ClipboardList },
    ],
  },
]

function Placeholder({ label }) {
  return (
    <div className="adm-placeholder">
      <Settings size={40} className="adm-placeholder-icon" />
      <p className="adm-placeholder-label">{label}</p>
      <p className="adm-placeholder-sub">This workspace is under construction.</p>
    </div>
  )
}

function renderWorkspace(active, setActive) {
  switch (active) {
    case 'overview': return <AdminOverview onNavigate={setActive} />
    case 'ropa': return <AdminRoPA />
    case 'dsr': return <AdminDSR />
    case 'dpas': return <AdminDPA />
    case 'vendors': return <AdminVendors />
    case 'policies': return <AdminPolicies />
    case 'awareness': return <AdminAwareness />
    case 'tenants': return <AdminTenants />
    case 'users': return <AdminUsers />
    case 'domains': return <AdminDomains />
    case 'aliases': return <AdminAliases />
    case 'permissions': return <AdminPermissions />
    case 'audit': return <AdminAudit />
    default: {
      const label = NAV.flatMap(g => g.items).find(i => i.id === active)?.label || active
      return <Placeholder label={label} />
    }
  }
}

export default function AdminDashboard() {
  const [active, setActive] = useState('overview')
  const [userOpen, setUserOpen] = useState(false)
  const dropRef = useRef(null)

  const userName = sessionStorage.getItem('caspmail_user_name') || 'Admin'

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

      function handleLogout() {
    const idToken = sessionStorage.getItem('caspmail_id_token')
    const clientId = sessionStorage.getItem('caspmail_client_id') || 'caspermail-web'
    sessionStorage.clear()
    const params = new URLSearchParams({ client_id: clientId, post_logout_redirect_uri: window.location.origin + '/console/login' })
    if (idToken && idToken !== 'null' && idToken !== 'undefined') params.set('id_token_hint', idToken)
    const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.secure.internal/realms/caspermail'
    window.location.href = `${ISSUER}/protocol/openid-connect/logout?${params.toString()}`
  }

  return (
    <div className="adm-shell">
      {/* Sidebar */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <ShieldCheck size={20} className="adm-brand-icon" />
          <span className="adm-brand-name">CaspMail Admin</span>
        </div>

        <nav className="adm-nav">
          {NAV.map(group => (
            <div key={group.group} className="adm-nav-group">
              <span className="adm-nav-group-label">{group.group}</span>
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={`adm-nav-item${active === item.id ? ' active' : ''}`}
                    onClick={() => setActive(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="adm-sidebar-footer">
          <a href="/console/soc" className="adm-sidebar-link">
            <Shield size={14} />
            SOC Dashboard
          </a>
          <a href="/console" className="adm-sidebar-link">
            <Bell size={14} />
            Mail Console
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <h1 className="adm-topbar-title">
              {NAV.flatMap(g => g.items).find(i => i.id === active)?.label || 'Admin'}
            </h1>
          </div>
          <div className="adm-topbar-right">
            <div className="adm-user-menu" ref={dropRef}>
              <button className="adm-user-btn" onClick={() => setUserOpen(v => !v)}>
                <div className="adm-avatar"><User size={14} /></div>
                <span className="adm-user-name">{userName}</span>
                <ChevronDown size={14} className={`adm-chevron${userOpen ? ' open' : ''}`} />
              </button>
              {userOpen && (
                <div className="adm-dropdown">
                  <div className="adm-dropdown-header">
                    <p className="adm-dropdown-name">{userName}</p>
                    <p className="adm-dropdown-role">Platform Admin</p>
                  </div>
                  <div className="adm-dropdown-divider" />
                  <button className="adm-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="adm-content">
          {renderWorkspace(active, setActive)}
        </main>
      </div>
    </div>
  )
}
