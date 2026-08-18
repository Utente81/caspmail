import React, { useEffect, useState } from 'react'
import SOCDashboard from './SOCDashboard'

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
      }}>🛡</div>
      {error ? (
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <strong style={{ color: '#fca5a5', display: 'block', marginBottom: 8 }}>SOC auth error</strong>
          <span style={{ fontSize: '.82rem' }}>{error}</span>
          <button
            type="button"
            onClick={() => { sessionStorage.clear(); window.location.href = '/console/login' }}
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

export default function SOCApp() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function boot() {
      try {
        if (window.location.search.includes('code=')) {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')
          const verifier = sessionStorage.getItem('soc_pkce_verifier')
          const issuer = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'

          const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: 'caspermail-soc',
              code,
              redirect_uri: window.location.origin + '/console/soc',
              code_verifier: verifier,
            }),
          })
          if (!res.ok) throw new Error('Token exchange failed')
          const data = await res.json()
          sessionStorage.setItem(STORAGE_KEY, data.access_token)
          if (data.id_token) sessionStorage.setItem('caspmail_id_token', data.id_token)
          if (data.refresh_token) sessionStorage.setItem('caspmail_refresh_token', data.refresh_token)
          sessionStorage.setItem('caspmail_client_id', 'caspermail-soc')
          const payload = JSON.parse(atob(data.access_token.split('.')[1]))
          sessionStorage.setItem('caspmail_user_name', payload.name || payload.preferred_username || 'Analyst')
          sessionStorage.setItem('caspmail_user_email', payload.email || payload.preferred_username || '')
          const roles = payload?.realm_access?.roles || []
          const role = roles.includes('soc_manager') ? 'SOC Manager'
            : roles.includes('soc_analyst') ? 'SOC Analyst'
            : roles.includes('admin') ? 'Admin'
            : 'SOC User'
          sessionStorage.setItem('caspmail_user_role', role)
          window.history.replaceState({}, '', '/console/soc')
        }

        let token = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
        if (token) {
          sessionStorage.setItem(STORAGE_KEY, token)
          localStorage.setItem(STORAGE_KEY, token)
        } else {
          window.location.href = '/console/login'
          return
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
          const roles = payload?.realm_access?.roles || []
          if (!roles.includes('soc_analyst') && !roles.includes('soc_manager') && !roles.includes('admin') && !roles.includes('casper_admin')) {
            throw new Error('Insufficient permissions — SOC role required')
          }
        } catch (e) {
          if (e.message.includes('Insufficient')) throw e
          sessionStorage.removeItem(STORAGE_KEY)
          window.location.href = '/console/login'
          return
        }

      } catch (err) {
        console.error('[soc-auth]', err)
      } finally {
        if (alive) setReady(true)
      }
    }
    boot()
    return () => { alive = false }
  }, [])

  if (!ready) return <BootScreen error={error} />
  return <SOCDashboard />
}
