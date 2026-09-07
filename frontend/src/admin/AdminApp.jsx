import React, { useEffect, useState } from 'react'
import AdminDashboard from './AdminDashboard'

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
        background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>⚙</div>
      {error ? (
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <strong style={{ color: '#fca5a5', display: 'block', marginBottom: 8 }}>Admin auth error</strong>
          <span style={{ fontSize: '.82rem' }}>{error}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8,
              background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)',
              color: '#c4b5fd', cursor: 'pointer', fontSize: '.84rem', display: 'block', margin: '16px auto 0',
            }}
          >Retry</button>
        </div>
      ) : (
        <span style={{ fontSize: '.84rem' }}>Authenticating…</span>
      )}
    </div>
  )
}

export default function AdminApp() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function boot() {
      try {
        // Handle OIDC callback
        if (window.location.search.includes('code=')) {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')
          const verifier = window.memoryStorage.getItem('admin_pkce_verifier')
          const clientId = 'caspermail-admin'
          const redirectUri = window.location.origin + '/console/admin'
          const issuer = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'

          const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier }),
          })
          if (!res.ok) throw new Error('Token exchange failed')
          const data = await res.json()
          window.memoryStorage.setItem(STORAGE_KEY, data.access_token)
          if (data.id_token) window.memoryStorage.setItem('caspmail_id_token', data.id_token)
          if (data.refresh_token) window.memoryStorage.setItem('caspmail_refresh_token', data.refresh_token)
          window.memoryStorage.setItem('caspmail_client_id', 'caspermail-admin')
          const payload = JSON.parse(atob(data.access_token.split('.')[1]))
          window.memoryStorage.setItem('caspmail_user_name', payload.name || payload.preferred_username || 'Admin')
          window.memoryStorage.setItem('caspmail_user_role', 'Platform Admin')
          window.history.replaceState({}, '', '/console/admin')
        }

        let token = window.memoryStorage.getItem(STORAGE_KEY) || window.memoryStorage.getItem(STORAGE_KEY)
        if (token) {
          window.memoryStorage.setItem(STORAGE_KEY, token)
          window.memoryStorage.setItem(STORAGE_KEY, token)
        } else {
          window.location.href = '/console/login'
          return
        }

        // Check token expiry
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            window.memoryStorage.removeItem(STORAGE_KEY)
            await startLogin()
            return
          }
          // Verify admin role
          const roles = payload?.realm_access?.roles || []
          if (!roles.includes('admin') && !roles.includes('casper_admin')) {
            throw new Error('Insufficient permissions — admin role required')
          }
        } catch (e) {
          if (e.message.includes('Insufficient')) throw e
          window.memoryStorage.removeItem(STORAGE_KEY)
          await startLogin()
          return
        }

        if (alive) setReady(true);
      } catch (err) {
        console.error('[admin-auth]', err);
        if (alive) { setError(err.message || 'Auth Error'); setReady(false); }
      }
    }

    boot()
    return () => { alive = false }
  }, [])

  if (!ready) return <BootScreen error={error} />
  return <AdminDashboard />
}

async function startLogin() {
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  window.memoryStorage.setItem('admin_pkce_verifier', verifier)

  const issuer = window.__CASPERMAIL_CONFIG__?.keycloakIssuer || 'https://auth.caspmail.com/realms/caspermail'
  const clientId = 'caspermail-admin'
  const redirectUri = window.location.origin + '/console/admin'
  const state = Math.random().toString(36).slice(2)

  const url = new URL(`${issuer}/protocol/openid-connect/auth`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
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
