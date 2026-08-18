/**
 * Shared token refresh utility for all CaspMail apps.
 * Exchanges the stored refresh_token with Keycloak and updates sessionStorage.
 *
 * Usage: call ensureFreshToken() before any authenticated API request.
 * Each app must store 'caspmail_client_id' in sessionStorage at login time.
 */

const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer
  || 'https://auth.caspmail.com/realms/caspermail'

let refreshPromise = null // deduplicate concurrent refresh calls

export async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('caspmail_refresh_token')
  const clientId = sessionStorage.getItem('caspmail_client_id')

  if (!refreshToken || !clientId) throw new Error('No refresh token available')

  const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    sessionStorage.removeItem('caspmail_access_token')
    sessionStorage.removeItem('caspmail_refresh_token')
    throw new Error('Refresh failed — please log in again')
  }

  const data = await res.json()
  sessionStorage.setItem('caspmail_access_token', data.access_token)
  if (data.refresh_token) sessionStorage.setItem('caspmail_refresh_token', data.refresh_token)
  return data.access_token
}

/**
 * Returns a valid access token, refreshing automatically if it expires within 60s.
 * Concurrent callers share a single refresh request.
 */
export async function ensureFreshToken() {
  const token = sessionStorage.getItem('caspmail_access_token')

  if (token) {
    try {
      const { exp } = JSON.parse(atob(token.split('.')[1]))
      if (!exp || exp * 1000 > Date.now() + 60_000) return token // still fresh
    } catch { /* malformed token — fall through to refresh */ }
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

/**
 * Authenticated fetch wrapper — auto-refreshes token and retries once on 401.
 */
export async function authFetch(url, opts = {}) {
  let token = await ensureFreshToken()
  const doFetch = (t) => fetch(url, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${t}` },
  })

  let res = await doFetch(token)

  if (res.status === 401) {
    // Force refresh and retry once
    token = await refreshAccessToken()
    res = await doFetch(token)
  }

  return res
}
