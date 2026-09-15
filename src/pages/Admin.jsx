import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const ROLES = ['owner', 'front_desk', 'kitchen', 'cashier']

const ROLE_BADGE = {
  platform_admin: 'dark',
  owner: 'primary',
  front_desk: 'info',
  kitchen: 'warning',
  cashier: 'success',
  disabled: 'secondary',
  unassigned: 'light',
}

function Badge({ role }) {
  const color = ROLE_BADGE[role] || 'light'
  return <span className={`badge text-bg-${color}`}>{role}</span>
}

const PERF_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const PERF_COLUMNS = [
  { key: 'hotel_name', label: 'Hotel' },
  { key: 'owner_email', label: 'Owner' },
  { key: 'occ', label: 'Occupancy' },
  { key: 'res', label: 'Reservations' },
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Restaurant sales' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'collected', label: 'Collected' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'col', label: 'Collection' },
  { key: 'actions', label: 'Activity' },
  { key: 'last', label: 'Last activity' },
]

function flattenPerf(p) {
  return {
    ...p,
    occ: p.rooms.occupancy_pct,
    res: p.reservations.total,
    orders: p.restaurant.orders,
    sales: p.restaurant.sales,
    invoiced: p.billing.invoiced,
    collected: p.billing.collected,
    outstanding: p.billing.outstanding,
    col: p.billing.collection_pct,
    actions: p.activity.actions,
    last: p.activity.last_activity,
  }
}

function PerformanceModal({ hotelId, days, onClose }) {
  const [perf, setPerf] = useState(null)
  const [series, setSeries] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setPerf(null)
    setError(null)
    api(`/admin/hotels/${hotelId}/performance?days=${days}`)
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setPerf(d.performance)
        setSeries(d.series || [])
      })
      .catch((err) => setError(err.message))
  }, [hotelId, days])

  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n || 0)
  const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—')
  const maxCount = Math.max(1, ...series.map((s) => s.count))

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Performance — {perf?.hotel_name || '…'}
              {perf?.owner_email && (
                <span className="text-muted small ms-2">{perf.owner_email}</span>
              )}
            </h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error && <p className="text-danger">Error: {error}</p>}
            {!error && !perf && <p className="text-muted">Loading…</p>}
            {perf && (
              <>
                <div className="row g-3 mb-3">
                  {[
                    ['Occupancy', `${perf.rooms.occupancy_pct}%`, `${perf.rooms.occupied}/${perf.rooms.total} rooms`],
                    ['Reservations', perf.reservations.total,
                      `pending ${perf.reservations.pending} · confirmed ${perf.reservations.confirmed} · in-house ${perf.reservations.checked_in} · done ${perf.reservations.checked_out} · cancelled ${perf.reservations.cancelled}`],
                    ['Open stays', perf.stays.open, `${perf.stays.closed} completed stays`],
                    ['Orders', perf.restaurant.orders, `avg ${fmt(perf.restaurant.avg_order)} per order`],
                  ].map(([label, value, sub]) => (
                    <div className="col-6 col-md-3" key={label}>
                      <div className="card h-100">
                        <div className="card-body">
                          <div className="fs-4 fw-semibold">{value}</div>
                          <div className="small text-muted">{label}</div>
                          <div className="small text-muted mt-1">{sub}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="fw-semibold mb-2">Billing</div>
                        <table className="table table-sm mb-0">
                          <tbody>
                            <tr><td>Invoiced</td><td className="text-end">{fmt(perf.billing.invoiced)}</td></tr>
                            <tr><td>Collected</td><td className="text-end">{fmt(perf.billing.collected)}</td></tr>
                            <tr><td>Outstanding</td><td className="text-end">{fmt(perf.billing.outstanding)}</td></tr>
                            <tr><td>Collection rate</td><td className="text-end">{perf.billing.collection_pct}%</td></tr>
                            <tr>
                              <td>By method</td>
                              <td className="text-end">
                                {Object.entries(perf.billing.by_method).map(([m, v]) => (
                                  <div key={m} className="small">{m}: {fmt(v)}</div>
                                ))}
                                {Object.keys(perf.billing.by_method).length === 0 && '—'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="fw-semibold mb-2">Restaurant sales</div>
                        <div className="fs-4 fw-semibold">{fmt(perf.restaurant.sales)}</div>
                        <div className="small text-muted mb-3">
                          {perf.restaurant.orders} orders in the selected period
                        </div>
                        <div className="fw-semibold mb-2">Last activity</div>
                        <div className="small text-muted">{when(perf.activity.last_activity)}</div>
                        <div className="small text-muted">{perf.activity.actions} actions in the selected period</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="fw-semibold mb-2">Daily activity (last 14 days)</div>
                <div className="d-flex align-items-end gap-1" style={{ height: 64 }}>
                  {series.map((s) => (
                    <div key={s.date} className="flex-fill text-center" title={`${s.date}: ${s.count} actions`}>
                      <div
                        className="bg-primary mx-auto"
                        style={{ height: `${(s.count / maxCount) * 48}px`, width: '70%', borderRadius: 2, minHeight: 2, opacity: s.count ? 1 : 0.25 }}
                      />
                      <div className="text-muted" style={{ fontSize: 9 }}>
                        {s.date.slice(8)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [hotels, setHotels] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Assign modal state
  const [assignUser, setAssignUser] = useState(null)
  const [assignHotel, setAssignHotel] = useState('')
  const [assignRole, setAssignRole] = useState('owner')

  // Create hotel modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createOwner, setCreateOwner] = useState('')

  // Performance tab state
  const [perfRange, setPerfRange] = useState('30')
  const [perfRows, setPerfRows] = useState([])
  const [perfSort, setPerfSort] = useState({ key: 'sales', dir: 'desc' })
  const [perfHotelId, setPerfHotelId] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)

  const loadPerformance = useCallback(async (range) => {
    setPerfLoading(true)
    try {
      const d = await api(`/admin/performance?days=${range}`)
      setPerfRows(d.performance)
    } catch (err) {
      setError(err.message)
    } finally {
      setPerfLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, h, u] = await Promise.all([
        api('/admin/stats'),
        api('/admin/hotels'),
        api('/admin/users'),
      ])
      setStats(s.stats)
      setHotels(h.hotels)
      setUsers(u.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (tab === 'performance') loadPerformance(perfRange)
  }, [tab, perfRange, loadPerformance])

  const sortedPerf = useMemo(() => {
    const rows = perfRows.map(flattenPerf)
    const { key, dir } = perfSort
    return rows.sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av || '').localeCompare(String(bv || ''))
      return dir === 'asc' ? cmp : -cmp
    })
  }, [perfRows, perfSort])

  const toggleSort = (key) => {
    setPerfSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  const openAssign = (user) => {
    setAssignUser(user)
    setAssignHotel(user.hotel_id || '')
    setAssignRole(user.role && ROLES.includes(user.role) ? user.role : 'owner')
  }

  const submitAssign = async () => {
    if (!assignUser) return
    try {
      await api(`/admin/users/${assignUser.id}/assign`, {
        method: 'POST',
        body: { hotelId: assignHotel || null, role: assignRole },
      })
      setAssignUser(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const toggleDisable = async (user) => {
    const disabling = user.role !== 'disabled'
    const ok = window.confirm(
      disabling
        ? `Disable ${user.email}? They will be prevented from signing in.`
        : `Enable ${user.email} again?`,
    )
    if (!ok) return
    try {
      await api(`/admin/users/${user.id}/${disabling ? 'disable' : 'enable'}`, {
        method: 'POST',
      })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const renameHotel = async (hotel) => {
    const name = window.prompt('Hotel name', hotel.hotel_name || hotel.name)
    if (!name || name === (hotel.hotel_name || hotel.name)) return
    try {
      await api(`/admin/hotels/${hotel.id}/name`, {
        method: 'POST',
        body: { name },
      })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const createHotel = async () => {
    try {
      await api('/admin/hotels', {
        method: 'POST',
        body: { name: createName, ownerUserId: createOwner || null },
      })
      setShowCreate(false)
      setCreateName('')
      setCreateOwner('')
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className="text-muted">Loading admin data…</p>
  if (error) return <p className="text-danger">Error: {error}</p>

  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n || 0)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Instructor Admin</h1>
        <button className="btn btn-sm btn-outline-primary" onClick={load}>
          Refresh
        </button>
      </div>

      <ul className="nav nav-tabs mb-3">
        {['overview', 'performance', 'hotels', 'students'].map((t) => (
          <li className="nav-item" key={t}>
            <button
              className={`nav-link ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'overview' && stats && (
        <div className="row g-3">
          {[
            ['Hotels', stats.hotels],
            ['Students', stats.users],
            ['Rooms', stats.rooms],
            ['Guests', stats.guests],
            ['Reservations', stats.reservations],
          ].map(([label, value]) => (
            <div className="col-6 col-md-4 col-lg-2" key={label}>
              <div className="card text-center h-100">
                <div className="card-body">
                  <div className="fs-3 fw-semibold">{value}</div>
                  <div className="text-muted small">{label}</div>
                </div>
              </div>
            </div>
          ))}
          <div className="col-6 col-md-4 col-lg-2">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="fs-3 fw-semibold">{fmt(stats.revenue)}</div>
                <div className="text-muted small">Total revenue</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <p className="small text-muted mb-0">
              How each student's hotel is operating. Click a column to sort, click a row for details.
            </p>
            <select
              className="form-select form-select-sm w-auto"
              value={perfRange}
              onChange={(e) => setPerfRange(e.target.value)}
            >
              {PERF_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {perfLoading && <p className="text-muted">Loading performance…</p>}
          {!perfLoading && (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    {PERF_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        role="button"
                        className="text-nowrap"
                        onClick={() => toggleSort(c.key)}
                      >
                        {c.label}
                        {perfSort.key === c.key && (
                          <span className="text-muted ms-1">{perfSort.dir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPerf.map((p) => (
                    <tr key={p.hotel_id} role="button" onClick={() => setPerfHotelId(p.hotel_id)}>
                      <td className="fw-semibold">{p.hotel_name}</td>
                      <td>{p.owner_email || '—'}</td>
                      <td>{p.occ}% <span className="text-muted small">({p.rooms.occupied}/{p.rooms.total})</span></td>
                      <td>{p.res}</td>
                      <td>{p.orders}</td>
                      <td>{fmt(p.sales)}</td>
                      <td>{fmt(p.invoiced)}</td>
                      <td>{fmt(p.collected)}</td>
                      <td className={p.outstanding > 0 ? 'text-danger' : ''}>{fmt(p.outstanding)}</td>
                      <td>{p.col}%</td>
                      <td>{p.actions}</td>
                      <td className="text-nowrap small">{p.last ? new Date(p.last).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {sortedPerf.length === 0 && (
                    <tr>
                      <td colSpan={PERF_COLUMNS.length} className="text-muted text-center">
                        No hotels yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'hotels' && (
        <>
          <div className="d-flex justify-content-end mb-2">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreate(true)}
            >
              + New hotel
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Owner</th>
                  <th>Rooms</th>
                  <th>Guests</th>
                  <th>Reservations</th>
                  <th>Occupancy</th>
                  <th>Revenue</th>
                  <th>Collection</th>
                  <th>Last activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => (
                  <tr key={h.id} role="button" onClick={() => setPerfHotelId(h.id)}>
                    <td className="fw-semibold">{h.hotel_name || h.name}</td>
                    <td>{h.owner_email || '—'}</td>
                    <td>{h.room_count}</td>
                    <td>{h.guest_count}</td>
                    <td>{h.reservation_count}</td>
                    <td>{h.rooms?.occupancy_pct || 0}%</td>
                    <td>{fmt(h.revenue)}</td>
                    <td>{h.billing?.collection_pct || 0}%</td>
                    <td className="text-nowrap small">
                      {h.activity?.last_activity
                        ? new Date(h.activity.last_activity).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          renameHotel(h)
                        }}
                      >
                        Rename
                      </button>
                    </td>
                  </tr>
                ))}
                {hotels.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-muted text-center">
                      No hotels yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'students' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Role</th>
                <th>Hotel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.display_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <Badge role={u.role} />
                  </td>
                  <td>{u.hotels?.name || '—'}</td>
                  <td className="text-end">
                    {u.hotel_id && (
                      <button
                        className="btn btn-sm btn-outline-info me-1"
                        onClick={() => setPerfHotelId(u.hotel_id)}
                      >
                        Perf
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => openAssign(u)}
                    >
                      Assign
                    </button>
                    <button
                      className={`btn btn-sm btn-outline-${u.role === 'disabled' ? 'success' : 'secondary'}`}
                      onClick={() => toggleDisable(u)}
                    >
                      {u.role === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted text-center">
                    No students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {assignUser && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign {assignUser.email}</h5>
                <button className="btn-close" onClick={() => setAssignUser(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Hotel</label>
                  <select
                    className="form-select"
                    value={assignHotel}
                    onChange={(e) => setAssignHotel(e.target.value)}
                  >
                    <option value="">— No hotel —</option>
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setAssignUser(null)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitAssign}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {perfHotelId && (
        <PerformanceModal
          hotelId={perfHotelId}
          days={perfRange}
          onClose={() => setPerfHotelId(null)}
        />
      )}

      {showCreate && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">New hotel</h5>
                <button className="btn-close" onClick={() => setShowCreate(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Hotel name</label>
                  <input
                    className="form-control"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Blue Horizon Hotel"
                  />
                </div>
                <div>
                  <label className="form-label">Assign owner (optional)</label>
                  <select
                    className="form-select"
                    value={createOwner}
                    onChange={(e) => setCreateOwner(e.target.value)}
                  >
                    <option value="">— No owner —</option>
                    {users
                      .filter((u) => u.role === 'owner' || u.role === 'unassigned')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={createHotel}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
