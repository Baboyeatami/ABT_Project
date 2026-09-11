import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project keys.',
  )
}

// Fallback placeholders so the app doesn't crash before Supabase is configured.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder-anon-key',
)

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
