import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Map,
  Bell,
  Database,
  Users,
  FolderOpen,
  Zap,
  ShieldCheck,
  ClipboardList,
  ChevronDown,
  LogOut,
  Mail,
  Circle,
  User,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react'
import SOCOverview from './workspaces/SOCOverview'
import SOCAlerts from './workspaces/SOCAlerts'
import SOCCases from './workspaces/SOCCases'
import SOCSiem from './workspaces/SOCSiem'
import SOCUeba from './workspaces/SOCUeba'
import SOCThreatMap from './workspaces/SOCThreatMap'
import SOCCompliance from './workspaces/SOCCompliance'
import SOCAuditLog from './workspaces/SOCAuditLog'
import SOCSOAR from './workspaces/SOCSOAR'
import SOCPhishing from './workspaces/SOCPhishing'
import { ensureFreshToken } from '../auth/tokenRefresh.js'

const NAV = [
  {
    group: 'Command',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'threat-map', label: 'Threat Map', icon: Map },
    ],
  },
  {
    group: 'Detect',
    items: [
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'siem', label: 'SIEM', icon: Database },
      { id: 'ueba', label: 'UEBA', icon: Users },
    ],
  },
  {
    group: 'Respond',
    items: [
      { id: 'cases', label: 'Cases', icon: FolderOpen },
      { id: 'soar', label: 'SOAR', icon: Zap },
    ],
  },
  {
    group: 'Governance',
    items: [
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
      { id: 'audit-log', label: 'Audit Log', icon: ClipboardList },
      { id: 'phishing', label: 'Phishing Drill', icon: Mail },
    ],
  },
]

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="soc-clock">
      {time.toUTCString().replace(' GMT', ' UTC')}
    </span>
  )
}

function Placeholder({ label }) {
  return (
    <div className="soc-placeholder">
      <ShieldCheck size={40} className="soc-placeholder-icon" />
      <p className="soc-placeholder-label">{label}</p>
      <p className="soc-placeholder-sub">This workspace is under construction.</p>
    </div>
  )
}

const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e', info: '#3b82f6' }

function AlertTicker({ alerts }) {
  if (!alerts.length) return null
  return (
    <div style={{
      background: '#0b1220', borderBottom: '1px solid #1a2535',
      padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12,
      overflow: 'hidden',
    }}>
      <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#7f8ea3', flexShrink: 0, letterSpacing: '.06em' }}>
        LIVE
      </span>
      <div style={{ display: 'flex', gap: 20, overflow: 'hidden', flex: 1 }}>
        {alerts.slice(0, 5).map(a => (
          <span key={a.id} style={{ fontSize: '.75rem', flexShrink: 0, color: SEV_COLOR[a.severity] || '#94a3b8' }}>
            [{a.severity?.toUpperCase()}] {a.message}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function SOCDashboard() {
  const [active, setActive] = useState('overview')
  const [userOpen, setUserOpen] = useState(false)
  const [liveAlerts, setLiveAlerts] = useState([])
  const [sseStatus, setSseStatus] = useState('connecting')
  const [newAlertCount, setNewAlertCount] = useState(0)
  const dropRef = useRef(null)
  const esRef = useRef(null)

  const userName = sessionStorage.getItem('caspmail_user_name') || 'Analyst'
  const userRole = sessionStorage.getItem('caspmail_user_role') || 'SOC Analyst'

  const connectSSE = useCallback(async () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setSseStatus('connecting')
    try {
      const token = await ensureFreshToken()
      const es = new EventSource(`/api/soc/stream?token=${encodeURIComponent(token)}`)
      esRef.current = es

      es.addEventListener('connected', () => setSseStatus('live'))
      es.addEventListener('heartbeat', () => {})
      es.addEventListener('alert', (e) => {
        try {
          const alert = JSON.parse(e.data)
          setLiveAlerts(prev => {
            const updated = [alert, ...prev].slice(0, 50)
            return updated
          })
          setNewAlertCount(n => n + 1)
        } catch {}
      })
      es.onerror = () => {
        setSseStatus('error')
        es.close()
        esRef.current = null
        // Reconnect after 10s
        setTimeout(connectSSE, 10000)
      }
    } catch {
      setSseStatus('error')
      setTimeout(connectSSE, 10000)
    }
  }, [])

  useEffect(() => {
    connectSSE()
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null }
    }
  }, [connectSSE])

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setUserOpen(false)
      }
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

  function handleNavClick(id) {
    setActive(id)
    if (id === 'alerts') setNewAlertCount(0)
  }

  function renderWorkspace(id) {
    switch (id) {
      case 'overview':   return <SOCOverview />
      case 'alerts':     return <SOCAlerts />
      case 'cases':      return <SOCCases />
      case 'siem':       return <SOCSiem />
      case 'ueba':       return <SOCUeba />
      case 'threat-map': return <SOCThreatMap />
      case 'soar':       return <SOCSOAR />
      case 'compliance': return <SOCCompliance />
      case 'audit-log':  return <SOCAuditLog />
      case 'phishing':   return <SOCPhishing />
      default: {
        const label = NAV.flatMap(g => g.items).find(i => i.id === id)?.label || id
        return <Placeholder label={label} />
      }
    }
  }

  return (
    <div className="soc-shell">
      {/* Sidebar */}
      <aside className="soc-sidebar">
        <div className="soc-brand">
          <ShieldCheck size={20} className="soc-brand-icon" />
          <span className="soc-brand-name">CaspMail SOC</span>
        </div>

        <nav className="soc-nav">
          {NAV.map(group => (
            <div key={group.group} className="soc-nav-group">
              <span className="soc-nav-group-label">{group.group}</span>
              {group.items.map(item => {
                const Icon = item.icon
                const isAlerts = item.id === 'alerts'
                return (
                  <button
                    key={item.id}
                    className={`soc-nav-item${active === item.id ? ' active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    {isAlerts && newAlertCount > 0 && (
                      <span style={{
                        marginLeft: 'auto', background: '#ef4444', color: '#fff',
                        fontSize: '.65rem', fontWeight: 700, padding: '1px 6px',
                        borderRadius: 10, minWidth: 18, textAlign: 'center',
                      }}>
                        {newAlertCount > 99 ? '99+' : newAlertCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="soc-sidebar-footer">
          <a href="/console/admin" className="soc-sidebar-link">
            <Settings size={14} />
            Admin Dashboard
          </a>
          <a href="/console" className="soc-sidebar-link">
            <Mail size={14} />
            Mail Console
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="soc-main">
        {/* Topbar */}
        <header className="soc-topbar">
          <div className="soc-topbar-left">
            <h1 className="soc-topbar-title">SOC Command Center</h1>
            <div className="soc-status-dot-wrap">
              <Circle size={8} className="soc-status-dot" fill="currentColor" />
              <span className="soc-status-label">Live</span>
            </div>
          </div>
          <div className="soc-topbar-right">
            {/* SSE status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {sseStatus === 'live'
                ? <Wifi size={13} style={{ color: '#22c55e' }} />
                : <WifiOff size={13} style={{ color: sseStatus === 'connecting' ? '#f59e0b' : '#ef4444' }} />
              }
              <span style={{ fontSize: '.72rem', color: sseStatus === 'live' ? '#22c55e' : sseStatus === 'connecting' ? '#f59e0b' : '#ef4444' }}>
                {sseStatus === 'live' ? 'Stream live' : sseStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
              </span>
            </div>
            <Clock />
            <div className="soc-user-menu" ref={dropRef}>
              <button className="soc-user-btn" onClick={() => setUserOpen(v => !v)}>
                <div className="soc-avatar">
                  <User size={14} />
                </div>
                <span className="soc-user-name">{userName}</span>
                <ChevronDown size={14} className={`soc-chevron${userOpen ? ' open' : ''}`} />
              </button>
              {userOpen && (
                <div className="soc-dropdown">
                  <div className="soc-dropdown-header">
                    <p className="soc-dropdown-name">{userName}</p>
                    <p className="soc-dropdown-role">{userRole}</p>
                  </div>
                  <div className="soc-dropdown-divider" />
                  <a href="/console/admin" className="soc-dropdown-item">
                    <Settings size={14} />
                    Admin
                  </a>
                  <a href="/console" className="soc-dropdown-item">
                    <Mail size={14} />
                    Mail Console
                  </a>
                  <button className="soc-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Alert ticker */}
        <AlertTicker alerts={liveAlerts} />

        {/* Content */}
        <main className="soc-content">
          {renderWorkspace(active)}
        </main>
      </div>
    </div>
  )
}
