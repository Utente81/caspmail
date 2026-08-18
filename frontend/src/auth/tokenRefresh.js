const ISSUER = window.__CASPERMAIL_CONFIG__?.keycloakIssuer
  || 'https://auth.caspmail.com/realms/caspermail'

let refreshPromise = null

export async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('caspmail_refresh_token') || localStorage.getItem('caspmail_refresh_token')
  const clientId = sessionStorage.getItem('caspmail_client_id') || localStorage.getItem('caspmail_client_id') || 'caspermail-web'

  if (!refreshToken) {
    const existing = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
    if (existing) return existing
    throw new Error('No refresh token available')
  }

  try {
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
      const existing = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
      if (existing) return existing
      throw new Error('Refresh failed — please log in again')
    }

    const data = await res.json()
    sessionStorage.setItem('caspmail_access_token', data.access_token)
    localStorage.setItem('caspmail_access_token', data.access_token)
    if (data.refresh_token) {
      sessionStorage.setItem('caspmail_refresh_token', data.refresh_token)
      localStorage.setItem('caspmail_refresh_token', data.refresh_token)
    }
    return data.access_token
  } catch (err) {
    console.warn("Network issue during refresh, returning stored access token", err)
    const existing = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
    if (existing) return existing
    throw err
  }
}

export async function ensureFreshToken() {
  const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')

  if (token) {
    sessionStorage.setItem('caspmail_access_token', token)
    localStorage.setItem('caspmail_access_token', token)
    try {
      const { exp } = JSON.parse(atob(token.split('.')[1]))
      if (!exp || exp * 1000 > Date.now() + 60_000) return token
    } catch {
      return token
    }
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().catch(err => {
      const existing = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token')
      if (existing) return existing
      throw err
    }).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function authFetch(url, opts = {}) {
  let token = await ensureFreshToken()
  const doFetch = (t) => fetch(url, {
    ...opts,
    headers: { ...opts.headers, ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })

  try {
    let res = await doFetch(token)
    if (res.status === 401) {
      token = await refreshAccessToken().catch(() => token)
      res = await doFetch(token)
    }
    return res
  } catch(err) {
    console.warn("authFetch error", err)
    throw err
  }
}
