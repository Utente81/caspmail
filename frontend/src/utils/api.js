import { ensureFreshToken } from '../auth/tokenRefresh.js'

export async function fetchAuth(url, options = {}) {
  const token = await ensureFreshToken()
  
  const headers = {
    ...(options.headers || {}),
  }

  // Only set Content-Type if we are actually sending a body
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...options,
    headers
  })

  if (!res.ok) {
    let msg = 'API Error'
    try {
      const data = await res.json()
      msg = data.error || data.message || msg
    } catch (e) {
      msg = `Status ${res.status}`
    }
    throw new Error(msg)
  }

  // Not all endpoints return JSON, but most do. Try parsing, if not return text.
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return res.json()
  }
  return res.text()
}
