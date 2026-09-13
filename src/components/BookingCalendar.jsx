import { useMemo, useState } from 'react'
import Modal from './Modal'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_COLOR = {
  pending: 'secondary',
  confirmed: 'info',
  checked_in: 'primary',
  checked_out: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

const dateKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
    x.getDate(),
  ).padStart(2, '0')}`
}

const isActive = (res, key) => res.check_in && res.check_out && key >= res.check_in && key < res.check_out

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

export default function BookingCalendar({ reservations }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() }
  })
  const [selected, setSelected] = useState(null)

  const todayKey = dateKey(new Date())

  const weeks = useMemo(() => {
    const { y, m } = month
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const grid = []
    const cur = new Date(start)
    while (cur <= last || cur.getDay() !== 0) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      grid.push(week)
      if (cur.getMonth() !== m && cur.getDay() === 0) break
    }
    return grid
  }, [month])

  const monthLabel = `${new Date(month.y, month.m, 1).toLocaleString('en-US', { month: 'long' })} ${month.y}`

  const nav = (delta) => {
    setMonth((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const monthKey = (y, m, day) => `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => nav(-1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <span className="fw-semibold">{monthLabel}</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => nav(1)}>
          <i className="bi bi-chevron-right" />
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered text-center mb-0">
            <thead>
              <tr>
                {DAY_NAMES.map((d) => (
                  <th key={d} className="py-2">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day) => {
                    const key = monthKey(day.getFullYear(), day.getMonth(), day.getDate())
                    const inMonth = day.getMonth() === month.m
                    const bookings = reservations.filter((r) => isActive(r, key))
                    const isToday = key === todayKey
                    return (
                      <td
                        key={key}
                        className="p-1 align-top"
                        style={{
                          height: 118,
                          width: '14.28%',
                          background: isToday ? '#eef3ff' : undefined,
                          opacity: inMonth ? 1 : 0.35,
                        }}
                      >
                        <div
                          className={`small fw-semibold ${isToday ? 'text-brand' : ''}`}
                        >
                          {day.getDate()}
                        </div>
                        {bookings.slice(0, 3).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className={`badge text-bg-${STATUS_COLOR[r.status] || 'secondary'} text-wrap w-100 mb-1 border-0`}
                            style={{ fontSize: '0.66rem', cursor: 'pointer' }}
                            title="View booking details"
                            onClick={() => setSelected(r)}
                          >
                            {r.rooms?.room_number} · {r.guests?.last_name || 'Guest'}
                          </button>
                        ))}
                        {bookings.length > 3 && (
                          <div className="text-muted" style={{ fontSize: '0.66rem' }}>
                            +{bookings.length - 3} more
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card-footer d-flex gap-3 flex-wrap">
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <span key={s} className="small">
            <span className={`badge text-bg-${c} me-1`}>{s}</span>
          </span>
        ))}
      </div>

      {selected && (
        <Modal title="Booking details" onClose={() => setSelected(null)}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="fw-semibold">
              {selected.rooms?.room_number} · {selected.guests?.first_name}{' '}
              {selected.guests?.last_name}
            </span>
            <span className={`badge text-bg-${STATUS_COLOR[selected.status] || 'secondary'}`}>
              {selected.status}
            </span>
          </div>

          <div className="row g-3">
            <div className="col-sm-6">
              <div className="text-muted small">Check-in</div>
              <div className="fw-semibold">{selected.check_in}</div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted small">Check-out</div>
              <div className="fw-semibold">{selected.check_out}</div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted small">Guests</div>
              <div className="fw-semibold">
                {selected.adults}A{selected.children > 0 ? ` / ${selected.children}C` : ''}
              </div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted small">Deposit</div>
              <div className="fw-semibold">{fmt(selected.deposit)}</div>
            </div>
            <div className="col-12">
              <div className="text-muted small">Room type</div>
              <div className="fw-semibold">
                {selected.rooms?.room_types?.name || '—'}{' '}
                {selected.rooms?.rate && <span className="text-muted">· {fmt(selected.rooms.rate)}/night</span>}
              </div>
            </div>
            {selected.rooms?.floor && (
              <div className="col-sm-6">
                <div className="text-muted small">Floor</div>
                <div className="fw-semibold">{selected.rooms.floor}</div>
              </div>
            )}
            {selected.guests?.email && (
              <div className="col-sm-6">
                <div className="text-muted small">Email</div>
                <div className="fw-semibold">{selected.guests.email}</div>
              </div>
            )}
            {selected.guests?.phone && (
              <div className="col-sm-6">
                <div className="text-muted small">Phone</div>
                <div className="fw-semibold">{selected.guests.phone}</div>
              </div>
            )}
            {selected.notes && (
              <div className="col-12">
                <div className="text-muted small">Notes</div>
                <div className="fw-semibold">{selected.notes}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
