import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React, { useState, useEffect } from 'react'
import { Mail, ShieldCheck, Settings } from 'lucide-react'
import ParticleNetwork from './ParticleNetwork';

const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer
  || 'https://auth.secure.internal/realms/caspermail'

const APPS = [
  {
    id: 'mail',
    label: 'Mail Console',
    desc: 'Access your secure mailbox.',
    icon: Mail,
    clientId: 'caspermail-web',
    redirectPath: '/console/',
    color: '#0ea5e9',
    colorDim: 'rgba(14, 165, 233, 0.15)'
  },
  {
    id: 'soc',
    label: 'SOC Dashboard',
    desc: 'Monitor threats & security status.',
    icon: ShieldCheck,
    clientId: 'caspermail-soc',
    redirectPath: '/console/soc',
    color: '#a855f7',
    colorDim: 'rgba(168, 85, 247, 0.15)'
  },
  {
    id: 'admin',
    label: 'Admin Dashboard',
    desc: 'Manage users, settings, and systems.',
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

export default function LoginApp() {
  const [loading, setLoading] = useState(null)

  async function handleAppClick(app) {
    setLoading(app.id)

    const storageKey = `${app.id}_pkce_verifier`
    const verifier = generateVerifier()
    const challenge = await generateChallenge(verifier)
    sessionStorage.setItem(storageKey, verifier)

    const redirectUri = window.location.origin + app.redirectPath
    const url = new URL(`${ISSUER}/protocol/openid-connect/auth`)
    url.searchParams.set('client_id', app.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid profile email')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('state', Math.random().toString(36).slice(2))
    
    // Redirecting to Keycloak
    window.location.href = url.toString()
  }

  return (
    <div className="login-shell">
      {/* Particle Network Background */}
      <ParticleNetwork />
      
      {/* Stars Layer */}
      <div className="stars-layer">
        {Array.from({ length: 40 }).map((_, i) => {
          const size = Math.random() * 3 + 2; // 2–5px
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
      
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <p className="login-sub-title">WELCOME BACK</p>
          <h1 className="login-title">Welcome To Security Casp Workspace</h1>
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
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
