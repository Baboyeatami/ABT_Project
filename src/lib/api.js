import { supabase, DEMO } from './supabase'
import { demoAdminApi } from './demoData'

// Thin wrapper around the Express API (/api). Attaches the current session
// token so the backend can verify the caller. Used for admin operations that
// require the service role (e.g. assigning roles, cross-tenant reports).
// In demo mode it delegates to the in-browser mock admin API.
export async function api(path, { method = 'GET', body } = {}) {
  if (DEMO) {
    return demoAdminApi(path, { method, body })
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('You must be signed in')

  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.error || `Request failed (${res.status})`)
  }
  return payload
}
