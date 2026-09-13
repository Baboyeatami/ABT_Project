import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import BookingCalendar from '../components/BookingCalendar'

const RES_STATUS = {
  pending: 'secondary',
  confirmed: 'info',
  checked_in: 'primary',
  checked_out: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

function Badge({ status }) {
  return (
    <span className={`badge text-bg-${RES_STATUS[status] || 'secondary'}`}>{status}</span>
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const emptyRes = {
  guest_mode: 'existing',
  guest_id: '',
  new_first: '',
  new_last: '',
  room_id: '',
  check_in: today(),
  check_out: tomorrow(),
  adults: 1,
  children: 0,
  deposit: 0,
  notes: '',
}

export default function Reservations() {
  const { hotelId, hotelLoading } = useHotel()
  const [reservations, setReservations] = useState([])
  const [rooms, setRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('list')
  const [query, setQuery] = useState('')

  const [show, setShow] = useState(false)
  const [res, setRes] = useState(emptyRes)
  const [resId, setResId] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [resRes, roomRes, guestRes] = await Promise.all([
        supabase
          .from('reservations')
          .select(
            '*, rooms(room_number, floor, rate, status, room_types(name, base_rate)), guests(first_name, last_name, email, phone)',
          )
          .eq('hotel_id', hotelId)
          .order('check_in', { ascending: true }),
        supabase.from('rooms').select('*').eq('hotel_id', hotelId).order('room_number'),
        supabase.from('guests').select('*').eq('hotel_id', hotelId).order('last_name'),
      ])
      if (resRes.error) throw resRes.error
      if (roomRes.error) throw roomRes.error
      if (guestRes.error) throw guestRes.error
      setReservations(resRes.data)
      setRooms(roomRes.data)
      setGuests(guestRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    try {
      let guestId = res.guest_id
      if (res.guest_mode === 'new') {
        const { data, error: gerr } = await supabase
          .from('guests')
          .insert({
            hotel_id: hotelId,
            first_name: res.new_first,
            last_name: res.new_last,
          })
          .select()
          .single()
        if (gerr) throw gerr
        guestId = data.id
      }
      const payload = {
        hotel_id: hotelId,
        guest_id: guestId || null,
        room_id: res.room_id || null,
        check_in: res.check_in,
        check_out: res.check_out,
        adults: Number(res.adults),
        children: Number(res.children),
        deposit: Number(res.deposit || 0),
        notes: res.notes,
        status: res.status || 'pending',
      }
      if (resId) {
        await supabase.from('reservations').update(payload).eq('id', resId)
      } else {
        await supabase.from('reservations').insert(payload)
      }
      setShow(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const checkIn = async (r) => {
    try {
      await supabase.from('stay_sessions').insert({
        hotel_id: hotelId,
        reservation_id: r.id,
        guest_id: r.guest_id,
        room_id: r.room_id,
        status: 'open',
      })
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', r.room_id)
      await supabase.from('reservations').update({ status: 'checked_in' }).eq('id', r.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const checkOut = async (r) => {
    try {
      await supabase
        .from('stay_sessions')
        .update({ status: 'closed', check_out_at: new Date().toISOString() })
        .eq('reservation_id', r.id)
        .eq('status', 'open')
      await supabase.from('rooms').update({ status: 'available' }).eq('id', r.room_id)
      await supabase.from('reservations').update({ status: 'checked_out' }).eq('id', r.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const setStatus = async (r, status) => {
    await supabase.from('reservations').update({ status }).eq('id', r.id)
    load()
  }

  const availableRooms = rooms.filter((room) => room.status === 'available')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? reservations.filter((r) => {
        const guest = `${r.guests?.first_name || ''} ${r.guests?.last_name || ''}`.toLowerCase()
        return (
          guest.includes(q) ||
          (r.guests?.email || '').toLowerCase().includes(q) ||
          (r.rooms?.room_number || '').toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.check_in.includes(q) ||
          r.check_out.includes(q)
        )
      })
    : reservations

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Reservations, check-in and check-out."
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setResId(null)
              setRes(emptyRes)
              setShow(true)
            }}
          >
            + New reservation
          </button>
        }
      />

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="input-group mb-3">
            <span className="input-group-text bg-white">
              <i className="bi bi-search" />
            </span>
            <input
              className="form-control"
              placeholder="Search by guest, room, status, or date…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="btn btn-outline-secondary"
                onClick={() => setQuery('')}
                title="Clear search"
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>

          <ul className="nav nav-tabs mb-3">
            {['list', 'calendar'].map((t) => (
              <li className="nav-item" key={t}>
                <button
                  className={`nav-link ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  <i className={`bi ${t === 'list' ? 'bi-list-ul' : 'bi-calendar3'} me-1`} />
                  {t === 'list' ? 'List' : 'Calendar'}
                </button>
              </li>
            ))}
          </ul>

          {tab === 'calendar' ? (
            <BookingCalendar reservations={filtered} />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Guests</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-semibold">
                        {r.guests?.first_name} {r.guests?.last_name || '—'}
                      </td>
                      <td>{r.rooms?.room_number || '—'}</td>
                      <td>{r.check_in}</td>
                      <td>{r.check_out}</td>
                      <td>
                        {r.adults}A{r.children > 0 ? ` / ${r.children}C` : ''}
                      </td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td className="text-end">
                        {(r.status === 'pending' || r.status === 'confirmed') && (
                          <button
                            className="btn btn-sm btn-success me-1"
                            onClick={() => checkIn(r)}
                          >
                            Check-in
                          </button>
                        )}
                        {r.status === 'checked_in' && (
                          <button
                            className="btn btn-sm btn-warning me-1"
                            onClick={() => checkOut(r)}
                          >
                            Check-out
                          </button>
                        )}
                        <select
                          className="form-select form-select-sm d-inline-block w-auto"
                          value={r.status}
                          onChange={(e) => setStatus(r, e.target.value)}
                        >
                          {Object.keys(RES_STATUS).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-muted text-center">
                        No reservations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {show && (
        <Modal
          title={resId ? 'Edit reservation' : 'New reservation'}
          onClose={() => setShow(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Guest</label>
            <select
              className="form-select"
              value={res.guest_mode}
              onChange={(e) => setRes({ ...res, guest_mode: e.target.value })}
            >
              <option value="existing">Existing guest</option>
              <option value="new">New guest</option>
            </select>
          </div>
          {res.guest_mode === 'existing' ? (
            <div className="mb-3">
              <select
                className="form-select"
                value={res.guest_id}
                onChange={(e) => setRes({ ...res, guest_id: e.target.value })}
              >
                <option value="">— Select guest —</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="First name"
                  value={res.new_first}
                  onChange={(e) => setRes({ ...res, new_first: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Last name"
                  value={res.new_last}
                  onChange={(e) => setRes({ ...res, new_last: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="mb-3">
            <label className="form-label">Room</label>
            <select
              className="form-select"
              value={res.room_id}
              onChange={(e) => setRes({ ...res, room_id: e.target.value })}
            >
              <option value="">— Select room —</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number}
                </option>
              ))}
            </select>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Check-in</label>
              <input
                type="date"
                className="form-control"
                value={res.check_in}
                onChange={(e) => setRes({ ...res, check_in: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Check-out</label>
              <input
                type="date"
                className="form-control"
                value={res.check_out}
                onChange={(e) => setRes({ ...res, check_out: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Adults</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={res.adults}
                onChange={(e) => setRes({ ...res, adults: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Children</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={res.children}
                onChange={(e) => setRes({ ...res, children: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Deposit (PHP)</label>
              <input
                type="number"
                className="form-control"
                value={res.deposit}
                onChange={(e) => setRes({ ...res, deposit: e.target.value })}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows="2"
                value={res.notes}
                onChange={(e) => setRes({ ...res, notes: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
