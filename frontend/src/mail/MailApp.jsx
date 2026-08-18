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

export default function MailApp() {
  const [ready, setReady] = useState(true)
  const [policies, setPolicies] = useState(null)

  useEffect(() => {
    let alive = true
    async function boot() {
      let token = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
      if (!token) {
        window.location.href = '/console/login'
        return
      }

      sessionStorage.setItem(STORAGE_KEY, token)
      localStorage.setItem(STORAGE_KEY, token)

      // Ensure user details populated
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const email = payload.email || payload.preferred_username || 'admin@caspmail.com'
        sessionStorage.setItem('caspmail_user_name', payload.name || payload.preferred_username || 'Enterprise Admin')
        sessionStorage.setItem('caspmail_user_email', email)
        localStorage.setItem('caspmail_user_email', email)
        sessionStorage.setItem('caspmail_user_role', 'Admin')
      } catch (e) {
        console.warn('Payload decode fallback', e)
      }

      // Background policy fetch
      try {
        const polRes = await fetchAuth('/api/me/policies')
        if (polRes && polRes.pending_policies && polRes.pending_policies.length > 0) {
          if (alive) setPolicies(polRes.pending_policies)
        }
      } catch(e) {
        console.warn('Failed to fetch policies', e)
      }
    }
    boot()
    return () => { alive = false }
  }, [])

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
