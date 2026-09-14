import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import { isAdmin, canUseHotel, canAccess } from '../lib/auth'

const CARD_META = {
  rooms: { icon: 'bi-door-open', color: '#2c6fdb' },
  guests: { icon: 'bi-people', color: '#0f766e' },
  reservations: { icon: 'bi-front', color: '#7c3aed' },
}

function StatCard({ label, value, to, icon, color }) {
  return (
    <Link to={to} className="text-decoration-none">
      <div className="stat-card p-3 h-100 d-flex align-items-center gap-3">
        <div
          className="stat-icon text-white"
          style={{ background: color || 'linear-gradient(135deg,#2c6fdb,#6a3bd8)' }}
        >
          <i className={`bi ${icon || 'bi-stats'}`} />
        </div>
        <div>
          <div className="fs-3 fw-bold lh-1">{value}</div>
          <div className="page-subtitle small">{label}</div>
        </div>
      </div>
    </Link>
  )
}

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
        <h1 className="h3 fw-bold mb-1">Instructor Dashboard</h1>
        <p className="page-subtitle mb-4">
          You're the platform admin. Manage all hotels and students from the Admin panel.
        </p>
        <Link className="btn btn-primary btn-lg" to="/admin">
          <i className="bi bi-shield-lock me-2" />
          Open Admin panel
        </Link>
      </div>
    )
  }

  if (hotelLoading) return <p className="page-subtitle">Loading hotel…</p>

  if (!hotel) {
    return (
      <div className="alert alert-warning rounded-14">
        You are not assigned to a hotel yet. Please wait for your instructor to assign
        you, or contact them.
      </div>
    )
  }

  const cards = [
    ['Rooms', counts.rooms, '/rooms', CARD_META.rooms],
    ['Guests', counts.guests, '/guests', CARD_META.guests],
    ['Active reservations', counts.open, '/reservations', CARD_META.reservations],
    ['Rooms occupied', counts.occupied, '/rooms', { icon: 'bi-door-closed', color: '#d97706' }],
  ].filter(([, , path]) => canAccess(path.slice(1)))

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">
          <i className="bi bi-buildings me-2 text-brand" />
          {hotel.name}
        </h1>
        <p className="page-subtitle mb-0">
          {hotel.address || 'No address set'} · Currency {hotel.currency} · Role {role}
        </p>
      </div>
      <div className="row g-3">
        {cards.map(([label, value, to, meta]) => (
          <div className="col-6 col-md-3" key={label}>
            <StatCard label={label} value={value} to={to} icon={meta.icon} color={meta.color} />
          </div>
        ))}
      </div>
    </div>
  )
}
