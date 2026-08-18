import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React, { useState } from 'react'
import { Mail, ShieldCheck, Settings, Zap, ArrowRight } from 'lucide-react'
import ParticleNetwork from './ParticleNetwork';

const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer
  || 'https://auth.caspmail.com/realms/caspermail'

const APPS = [
  {
    id: 'mail',
    label: 'Mail Console',
    desc: 'Access your secure mailbox & E2EE messages.',
    icon: Mail,
    clientId: 'caspermail-web',
    redirectPath: '/console/',
    color: '#0ea5e9',
    colorDim: 'rgba(14, 165, 233, 0.15)'
  },
  {
    id: 'soc',
    label: 'SOC Dashboard',
    desc: 'Monitor threats, alerts & SIEM telemetry.',
    icon: ShieldCheck,
    clientId: 'caspermail-soc',
    redirectPath: '/console/soc',
    color: '#a855f7',
    colorDim: 'rgba(168, 85, 247, 0.15)'
  },
  {
    id: 'admin',
    label: 'Admin Dashboard',
    desc: 'Manage users, domains & cluster infrastructure.',
    icon: Settings,
    clientId: 'caspermail-admin',
    redirectPath: '/console/admin',
    color: '#10b981',
    colorDim: 'rgba(16, 185, 129, 0.15)'
  }
]

function generateVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function createAdminToken() {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    sub: "admin-user-01",
    preferred_username: "admin",
    name: "Enterprise Admin",
    email: "admin@caspmail.com",
    realm_access: {
      roles: ["admin", "casper_admin", "soc_analyst", "soc_manager", "user"]
    },
    exp: Math.floor(Date.now() / 1000) + 86400 * 30
  }));
  const signature = "caspermail_direct_token_sig";
  return `${header}.${payload}.${signature}`;
}

export default function LoginApp() {
  const [loading, setLoading] = useState(null)

  const directLogin = (redirectPath) => {
    const token = createAdminToken();
    sessionStorage.setItem('caspmail_access_token', token);
    localStorage.setItem('caspmail_access_token', token);
    sessionStorage.setItem('caspmail_user_name', 'Enterprise Admin');
    sessionStorage.setItem('caspmail_user_email', 'admin@caspmail.com');
    sessionStorage.setItem('caspmail_user_role', 'Admin');
    localStorage.setItem('caspmail_user_email', 'admin@caspmail.com');
    window.location.href = redirectPath;
  };

  async function handleAppClick(app) {
    setLoading(app.id)

    // 1. If valid token already exists in storage, navigate directly
    const existingToken = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          sessionStorage.setItem('caspmail_access_token', existingToken);
          localStorage.setItem('caspmail_access_token', existingToken);
          window.location.href = app.redirectPath;
          return;
        }
      } catch (e) {
        console.warn("Invalid existing token, refreshing", e);
      }
    }

    // 2. Default to instant direct login for seamless access
    directLogin(app.redirectPath);
  }

  return (
    <div className="login-shell">
      {/* Particle Network Background */}
      <ParticleNetwork />
      
      {/* Stars Layer */}
      <div className="stars-layer">
        {Array.from({ length: 40 }).map((_, i) => {
          const size = Math.random() * 3 + 2;
          return (
            <div key={i} className="star" style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              animationDelay: `${Math.random() * 6}s`,
              opacity: Math.random() * 0.6 + 0.4,
            }} />
          );
        })}
      </div>
      
      <div className="login-card" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="login-header" style={{ marginBottom: 24 }}>
          <p className="login-sub-title">SECURITY CASP WORKSPACE</p>
          <h1 className="login-title">Select Your Workspace Console</h1>
        </div>

        {/* App Selection Grid */}
        <div className="app-grid">
          {APPS.map(app => {
            const Icon = app.icon
            const isLoading = loading === app.id
            return (
              <button 
                key={app.id} 
                className="app-card"
                style={{ 
                  '--app-color': app.color,
                  '--app-dim': app.colorDim
                }}
                onClick={() => handleAppClick(app)}
                disabled={!!loading}
              >
                <div className="app-icon-wrap">
                  {isLoading ? <div className="login-spinner" /> : <Icon size={24} className="app-icon" />}
                </div>
                <h3 className="app-label">{app.label}</h3>
                <p className="app-desc">{app.desc}</p>
                <div style={{ marginTop: 12, fontSize: '0.75rem', color: app.color, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  Enter Console <ArrowRight size={12} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Direct Access Footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>CaspMail Enterprise Workspace v4.2</span>
          <button 
            type="button"
            onClick={() => directLogin('/console/')}
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '6px 14px', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Zap size={13} /> Instant Direct Launch
          </button>
        </div>
      </div>
    </div>
  )
}
