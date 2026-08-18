import React, { useEffect, useState } from 'react'
import { ShieldAlert, Loader2 } from 'lucide-react'
import MailDashboard from './MailDashboard'
import { fetchAuth } from '../utils/api'

const STORAGE_KEY = 'caspmail_access_token'

function BootScreen({ error }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#060b14', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, color: '#7f8ea3', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>✉</div>
      {error ? (
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <strong style={{ color: '#fca5a5', display: 'block', marginBottom: 8 }}>Authentication error</strong>
          <span style={{ fontSize: '.82rem' }}>{error}</span>
          <button
            type="button"
            onClick={() => { sessionStorage.clear(); localStorage.clear(); window.location.href = '/console/login' }}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8,
              background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)',
              color: '#93c5fd', cursor: 'pointer', fontSize: '.84rem', display: 'block', margin: '16px auto 0',
            }}
          >Back to Login</button>
        </div>
      ) : (
        <span style={{ fontSize: '.84rem' }}>Authenticating…</span>
      )}
    </div>
  )
}

function PolicyGate({ policies, onAcknowledged }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(false)

  const policy = policies[currentIdx]

  async function handleAcknowledge() {
    setLoading(true)
    try {
      await fetchAuth(`/api/me/policies/${policy.id}/acknowledge`, { method: 'POST' })
      if (currentIdx + 1 < policies.length) {
        setCurrentIdx(currentIdx + 1)
      } else {
        onAcknowledged()
      }
    } catch (err) {
      alert('Failed to acknowledge: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #1e293b',
        borderRadius: 16, width: 600, maxWidth: '90%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: 12, borderRadius: '50%' }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>Action Required</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              You must acknowledge this security policy before continuing (ISO 27001 Compliance).
            </p>
          </div>
        </div>

        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: '1.1rem' }}>
            {policy.title} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>v{policy.version}</span>
          </h3>
          <div style={{
            background: '#0b1121', border: '1px solid #1e293b', borderRadius: 8,
            padding: 24, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6,
            whiteSpace: 'pre-wrap'
          }}>
            {policy.content}
          </div>
        </div>

        <div style={{
          padding: '20px 32px', borderTop: '1px solid #1e293b',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16,
          background: '#0b1121', borderBottomLeftRadius: 16, borderBottomRightRadius: 16
        }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {currentIdx + 1} of {policies.length}
          </span>
          <button 
            onClick={handleAcknowledge} 
            disabled={loading}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: 6, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem'
            }}
          >
            {loading ? <Loader2 size={16} className="soc-spinner" /> : null}
            I Acknowledge
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MailApp() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [policies, setPolicies] = useState(null)

  useEffect(() => {
    let alive = true
    async function boot() {
      try {
        if (window.location.search.includes('code=')) {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')
          const verifier = sessionStorage.getItem('mail_pkce_verifier')
          const issuer = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'

          const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: 'caspermail-web',
              code,
              redirect_uri: window.location.origin + '/console/',
              code_verifier: verifier,
            }),
          })
          if (!res.ok) throw new Error('Token exchange failed')
          const data = await res.json()
          sessionStorage.setItem(STORAGE_KEY, data.access_token)
          localStorage.setItem(STORAGE_KEY, data.access_token)
          if (data.id_token) sessionStorage.setItem('caspmail_id_token', data.id_token)
          if (data.refresh_token) sessionStorage.setItem('caspmail_refresh_token', data.refresh_token)
          sessionStorage.setItem('caspmail_client_id', 'caspermail-web')
          
          const payload = JSON.parse(atob(data.access_token.split('.')[1]))
          const email = payload.email || payload.preferred_username || ''
          sessionStorage.setItem('caspmail_user_name', payload.name || payload.preferred_username || 'User')
          sessionStorage.setItem('caspmail_user_email', email)
          if (email) localStorage.setItem('caspmail_user_email', email)
          const roles = payload?.realm_access?.roles || []
          const role = (roles.includes('admin') || roles.includes('casper_admin')) ? 'Admin'
            : roles.includes('soc_analyst') ? 'SOC Analyst'
            : roles.includes('soc_manager') ? 'SOC Manager'
            : 'User'
          sessionStorage.setItem('caspmail_user_role', role)
          window.history.replaceState({}, '', '/console/')
        }

        let token = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
        if (token) {
          sessionStorage.setItem(STORAGE_KEY, token)
          localStorage.setItem(STORAGE_KEY, token)
        }
        if (!token) {
          window.location.href = '/console/login'
          return
        }

        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            sessionStorage.removeItem(STORAGE_KEY)
            window.location.href = '/console/login'
            return
          }
          // Always ensure email and user info are populated on every boot
          const email = payload.email || payload.preferred_username || ''
          sessionStorage.setItem('caspmail_user_name', payload.name || payload.preferred_username || 'User')
          sessionStorage.setItem('caspmail_user_email', email)
          if (email) localStorage.setItem('caspmail_user_email', email)
          const roles = payload?.realm_access?.roles || []
          const role = (roles.includes('admin') || roles.includes('casper_admin')) ? 'Admin'
            : roles.includes('soc_analyst') ? 'SOC Analyst'
            : roles.includes('soc_manager') ? 'SOC Manager'
            : 'User'
          sessionStorage.setItem('caspmail_user_role', role)
        } catch {
          sessionStorage.removeItem(STORAGE_KEY)
          window.location.href = '/console/login'
          return
        }

        // Fetch pending policies
        try {
          const polRes = await fetchAuth('/api/me/policies')
          if (polRes && polRes.pending_policies && polRes.pending_policies.length > 0) {
            if (alive) setPolicies(polRes.pending_policies)
          }
        } catch(e) {
          console.warn('Failed to fetch policies', e)
        }
        if (alive) setReady(true);
      } catch (err) {
        console.error('[mail-auth]', err);
        if (alive) { setError(err.message || 'Auth Error'); setReady(false); }
      }
    }
    boot()
    return () => { alive = false }
  }, [])

  if (!ready) return <BootScreen error={error} />

  if (policies && policies.length > 0) {
    return (
      <>
        <PolicyGate policies={policies} onAcknowledged={() => setPolicies([])} />
        <div style={{ filter: 'blur(5px)', pointerEvents: 'none', height: '100vh', overflow: 'hidden' }}>
          <MailDashboard />
        </div>
      </>
    )
  }

  return <MailDashboard />
}

async function startLogin() {
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  sessionStorage.setItem('mail_pkce_verifier', verifier)

  const issuer = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'
  const url = new URL(`${issuer}/protocol/openid-connect/auth`)
  url.searchParams.set('client_id', 'caspermail-web')
  url.searchParams.set('redirect_uri', window.location.origin + '/console/')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', Math.random().toString(36).slice(2))
  window.location.href = url.toString()
}

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
