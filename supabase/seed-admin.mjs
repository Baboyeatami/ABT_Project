// Seed the platform admin login.
// Usage: node supabase/seed-admin.mjs [email] [password]
// Defaults to the credentials below. Safe to re-run.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const ADMIN_EMAIL = process.argv[2] || 'admin@abt.dev'
const ADMIN_PASSWORD = process.argv[3] || 'AbtAdmin#2026'

// Load .env (no dotenv dependency needed)
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// 1. Make sure the email is in platform_settings.admin_emails so the
//    on_auth_user_created trigger assigns role = 'platform_admin'.
const { data: settings } = await admin.from('platform_settings').select('admin_emails').eq('id', 1).single()
const emails = new Set(settings?.admin_emails || [])
const wasListed = emails.has(ADMIN_EMAIL)
emails.add(ADMIN_EMAIL)
const { error: settingsErr } = await admin
  .from('platform_settings')
  .update({ admin_emails: [...emails] })
  .eq('id', 1)
if (settingsErr) throw settingsErr
console.log(wasListed ? `admin_emails already contains ${ADMIN_EMAIL}` : `added ${ADMIN_EMAIL} to admin_emails`)

// 2. Create the auth user if it doesn't exist yet (trigger provisions the profile).
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listErr) throw listErr
let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

if (user) {
  console.log(`auth user already exists: ${user.id}`)
  // Keep role/hotel_id app_metadata correct even if the email was added later.
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: 'platform_admin', hotel_id: null },
  })
  if (error) throw error
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'platform_admin', hotel_id: null },
  })
  if (error) throw error
  user = data.user
  console.log(`created auth user: ${user.id}`)
}

// 3. Verify the profile row got the platform_admin role.
const { data: profile } = await admin
  .from('profiles')
  .select('id, email, role, hotel_id')
  .eq('id', user.id)
  .single()

if (!profile || profile.role !== 'platform_admin') {
  // Trigger may not have fired (e.g. user created before the email was listed) — fix directly.
  const { error } = await admin
    .from('profiles')
    .update({ role: 'platform_admin', hotel_id: null })
    .eq('id', user.id)
  if (error) throw error
  console.log('profile role corrected to platform_admin')
} else {
  console.log(`profile ok: role=${profile.role}`)
}

console.log(`\nAdmin login ready:\n  email:    ${ADMIN_EMAIL}\n  password: ${ADMIN_PASSWORD}`)
