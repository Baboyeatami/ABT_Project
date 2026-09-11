import { createClient } from '@supabase/supabase-js'
import { demoClient } from './demoData'

export const DEMO = import.meta.env.VITE_DEMO_MODE === '1'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Demo mode runs entirely in the browser against seeded data — no Supabase
// project needed. Flip VITE_DEMO_MODE off and set real keys to go live.
export const supabase = DEMO
  ? demoClient
  : createClient(
      supabaseUrl || 'http://localhost:54321',
      supabaseAnonKey || 'placeholder-anon-key',
    )

if (!DEMO && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project keys.',
  )
}

// Current user's role/hotel id, read from the JWT app_metadata.
// These are set by the backend (/api) when a profile is provisioned.
export function getAppMeta() {
  const session = supabase.auth.getSession()
  const claims = session?.data?.session?.user?.app_metadata || {}
  return {
    hotelId: claims.hotel_id || null,
    role: claims.role || 'unassigned',
  }
}
