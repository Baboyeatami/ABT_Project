import { useEffect, useState } from 'react'
import { supabase, getAppMeta } from './supabase'

// Provides the current user's hotel context (id, details, role flags).
// Owners and staff are scoped to a single hotel via RLS.
export function useHotel() {
  const meta = getAppMeta()
  const hotelId = meta.hotelId
  const role = meta.role

  const [hotel, setHotel] = useState(null)
  const [loading, setLoading] = useState(Boolean(hotelId))

  useEffect(() => {
    if (!hotelId) {
      setHotel(null)
      setLoading(false)
      return
    }
    let active = true
    const fetchHotel = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', hotelId)
        .maybeSingle()
      if (active && !error) setHotel(data)
      if (active) setLoading(false)
    }
    fetchHotel()
    return () => {
      active = false
    }
  }, [hotelId])

  return {
    hotelId,
    role,
    hotel,
    hotelLoading: loading,
    isOwner: role === 'owner',
    isStaff: ['front_desk', 'kitchen', 'cashier'].includes(role),
  }
}
