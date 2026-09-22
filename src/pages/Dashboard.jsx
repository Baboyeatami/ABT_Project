import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import { isAdmin, canAccess } from '../lib/auth'
import InsightsPanel from '../components/InsightsPanel'

export default function Dashboard() {
  const { hotel, hotelId, role, hotelLoading } = useHotel()
  const [rooms, setRooms] = useState([])
  const [counts, setCounts] = useState({ guests: 0, open: 0, arrivals: 0, departures: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!hotelId) return
    let active = true
    const today = new Date().toLocaleDateString('en-CA')
    const reservations = () => supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId)
    async function load() {
      setLoading(true)
      setError('')
      try {
        const results = await Promise.all([
          canAccess('rooms') ? supabase.from('rooms').select('id, room_number, status').eq('hotel_id', hotelId).order('room_number') : { data: [] },
          canAccess('guests') ? supabase.from('guests').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId) : {},
          canAccess('reservations') ? reservations().in('status', ['pending', 'confirmed', 'checked_in']) : {},
          canAccess('reservations') ? reservations().eq('check_in', today).in('status', ['pending', 'confirmed']) : {},
          canAccess('reservations') ? reservations().eq('check_out', today).eq('status', 'checked_in') : {},
        ])
        if (results.some(r => r.error)) throw new Error('Could not load your overview. Please try again.')
        if (!active) return
        setRooms(results[0].data || [])
        setCounts({ guests: results[1].count || 0, open: results[2].count || 0, arrivals: results[3].count || 0, departures: results[4].count || 0 })
      } catch (err) { if (active) setError(err.message) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [hotelId, role, reload])

  if (isAdmin()) return <>
    <div className="dashboard-heading"><div><h1>Your classroom, at a glance</h1><p>Follow hotel performance and help your students take the next step.</p></div><Link className="btn btn-primary" to="/admin"><i className="bi bi-shield-check me-2" />Open administration</Link></div>
    <div className="dashboard-panel"><div className="panel-heading"><div><h2>Every hotel tells a story</h2><p>Turn operational activity into a learning opportunity.</p></div><i className="bi bi-buildings fs-2 text-brand" /></div><p className="insights-summary">Explore hotel occupancy, restaurant activity, and billing in the Performance tab. Open a hotel's performance details to generate an AI-assisted summary of its results.</p><Link className="btn btn-outline-primary" to="/admin">Explore hotel workspaces</Link></div>
  </>
  if (hotelLoading) return <p role="status">Loading your workspace…</p>
  if (!hotel) return <div className="empty-workspace">Your workspace is almost ready. Ask your instructor to assign you to a hotel.</div>
  const occupied = rooms.filter(r => r.status === 'occupied').length
  const cards = [
    ['Total rooms', rooms.length, '/rooms', 'bi-door-open', `${occupied} currently occupied`, 'rooms'],
    ['Guest directory', counts.guests, '/guests', 'bi-people', 'Guests in your workspace', 'guests'],
    ['Arrivals today', counts.arrivals, '/reservations', 'bi-box-arrow-in-right', 'Pending or confirmed check-ins', 'reservations'],
    ['Departures today', counts.departures, '/reservations', 'bi-box-arrow-right', 'In-house guests due to leave', 'reservations'],
  ].filter(([, , , , , module]) => canAccess(module))
  const actions = [
    ['/reservations', 'Front desk', `${counts.open} active reservations`, 'bi-front', 'reservations'],
    ['/pos', 'Take an order', 'Open your restaurant point of sale', 'bi-bag', 'pos'],
    ['/billing', 'Review billing', 'Invoices, payments and guest folios', 'bi-receipt', 'billing'],
    ['/kitchen', 'Kitchen queue', 'Prepare and track incoming orders', 'bi-fire', 'kitchen'],
    ['/reports', 'View reports', 'Explore your operational results', 'bi-bar-chart', 'reports'],
  ].filter(([, , , , module]) => canAccess(module))
  return <>
    <div className="dashboard-heading"><div><h1>A good day starts here.</h1><p>{hotel.name} — your daily operations overview.</p></div>{canAccess('reservations') && <Link to="/reservations" className="btn btn-primary"><i className="bi bi-plus-lg me-2" />Manage reservations</Link>}</div>
    {error && <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setReload(v => v + 1)}>Retry</button></div>}
    <div className="row g-3 mb-4">{cards.map(([label, value, to, icon, caption]) => <div className="col-6 col-xl-3" key={label}><Link to={to} className="dashboard-stat"><span className="stat-label">{label}<i className={`bi ${icon}`} /></span><strong>{loading || error ? '—' : value}</strong><small>{caption}</small></Link></div>)}</div>
    <div className="row g-4 mb-4">
      {canAccess('rooms') && <div className="col-xl-8"><section className="dashboard-panel"><div className="panel-heading"><div><h2>Room overview</h2><p>{loading || error ? 'Current room availability' : `${rooms.length ? Math.round(occupied / rooms.length * 100) : 0}% occupied right now`}</p></div><Link to="/rooms">Manage rooms</Link></div>
        {loading ? <p role="status">Loading rooms…</p> : error ? <p>Room data is unavailable.</p> : rooms.length ? <><div className="room-board">{rooms.slice(0, 24).map(room => <div key={room.id} className={`room-tile ${room.status}`}><strong>{room.room_number}</strong><span>{room.status}</span></div>)}</div>{rooms.length > 24 && <p className="insights-note mt-3">Showing 24 of {rooms.length} rooms. Open Rooms to see all.</p>}</> : <div className="empty-workspace">Add your first room to start preparing your hotel for guests.</div>}
        <div className="room-legend"><span>Available</span><span className="occupied">Occupied</span><span className="maintenance">Maintenance</span></div>
      </section></div>}
      <div className={canAccess('rooms') ? 'col-xl-4' : 'col-12'}><section className="dashboard-panel"><div className="panel-heading"><div><h2>Keep things moving</h2><p>Your everyday operations, one click away.</p></div></div>{actions.map(([to, label, description, icon]) => <Link className="operations-link" to={to} key={to}><i className={`bi ${icon}`} /><span><strong>{label}</strong><small>{description}</small></span></Link>)}</section></div>
    </div>
    {role === 'owner' && <InsightsPanel hotelId={hotelId} hotelName={hotel.name} />}
  </>
}
