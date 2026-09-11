import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import { isAdmin, canUseHotel, canAccess } from '../lib/auth'

export default function Dashboard() {
  const { hotel, hotelId, role, hotelLoading } = useHotel()
  const [counts, setCounts] = useState({ rooms: 0, guests: 0, open: 0, occupied: 0 })

  useEffect(() => {
    if (!hotelId) return
    let active = true
    const load = async () => {
      const [rooms, guests, openRes, occupied] = await Promise.all([
        supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
        supabase.from('guests').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', hotelId)
          .in('status', ['pending', 'confirmed', 'checked_in']),
        supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', hotelId)
          .eq('status', 'occupied'),
      ])
      if (!active) return
      setCounts({
        rooms: rooms.count || 0,
        guests: guests.count || 0,
        open: openRes.count || 0,
        occupied: occupied.count || 0,
      })
    }
    load()
    return () => {
      active = false
    }
  }, [hotelId])

  if (isAdmin()) {
    return (
      <div>
        <h1 className="h3 mb-3">Instructor Dashboard</h1>
        <p className="text-muted">
          You're the platform admin. Manage all hotels and students from the Admin panel.
        </p>
        <Link className="btn btn-primary" to="/admin">
          Open Admin panel
        </Link>
      </div>
    )
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  if (!hotel) {
    return (
      <div className="alert alert-warning">
        You are not assigned to a hotel yet. Please wait for your instructor to assign
        you, or contact them.
      </div>
    )
  }

  const cards = [
    ['Rooms', counts.rooms, '/rooms', 'rooms'],
    ['Guests', counts.guests, '/guests', 'guests'],
    ['Active reservations', counts.open, '/reservations', 'reservations'],
    ['Rooms occupied', counts.occupied, '/rooms', 'rooms'],
  ].filter(([, , , mod]) => canAccess(mod))

  return (
    <div>
      <h1 className="h3 mb-1">{hotel.name}</h1>
      <p className="text-muted">
        {hotel.address || 'No address set'} · Currency {hotel.currency} · Role {role}
      </p>
      <div className="row g-3 mt-1">
        {cards.map(([label, value, to]) => (
          <div className="col-6 col-md-3" key={label}>
            <Link to={to} className="text-decoration-none">
              <div className="card text-center h-100">
                <div className="card-body">
                  <div className="fs-2 fw-semibold">{value}</div>
                  <div className="text-muted small">{label}</div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
