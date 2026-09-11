import { supabase, getAppMeta } from './supabase'

// Roles used across the app. Kept in one place so RLS and UI stay consistent.
export const ROLES = {
  ADMIN: 'platform_admin',
  OWNER: 'owner',
  FRONT_DESK: 'front_desk',
  KITCHEN: 'kitchen',
  CASHIER: 'cashier',
  UNASSIGNED: 'unassigned',
}

export function currentUser() {
  return supabase.auth.getSession()?.data?.session?.user || null
}

export function isAuthenticated() {
  return Boolean(currentUser())
}

export function hasRole(role) {
  return getAppMeta().role === role
}

// Instructor sees everything.
export function isAdmin() {
  return hasRole(ROLES.ADMIN)
}

// Owner + staff are assigned to a hotel.
export function hasHotel() {
  return Boolean(getAppMeta().hotelId)
}

// Any hotel-role user (owner or staff).
export function canUseHotel() {
  return ['owner', 'front_desk', 'kitchen', 'cashier'].includes(getAppMeta().role)
}

export function isOwner() {
  return hasRole(ROLES.OWNER)
}

export function isStaff() {
  return ['front_desk', 'kitchen', 'cashier'].includes(getAppMeta().role)
}

// Which hotel modules each role can access. `platform_admin` can access all.
export const MODULES = {
  rooms: ['owner', 'front_desk'],
  guests: ['owner', 'front_desk'],
  reservations: ['owner', 'front_desk'],
  menu: ['owner', 'kitchen'],
  tables: ['owner', 'kitchen'],
  pos: ['owner', 'cashier'],
  kitchen: ['owner', 'kitchen'],
  billing: ['owner', 'cashier'],
  reports: ['owner', 'cashier', 'front_desk'],
}

export function canAccess(module) {
  if (isAdmin()) return true
  return (MODULES[module] || []).includes(getAppMeta().role)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data
}
