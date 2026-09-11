import { useCallback, useEffect, useState } from 'react'
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
    const name = window.prompt('Hotel name', hotel.name)
    if (!name || name === hotel.name) return
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
        {['overview', 'hotels', 'students'].map((t) => (
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
                  <th>Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => (
                  <tr key={h.id}>
                    <td className="fw-semibold">{h.name}</td>
                    <td>{h.owner_email || '—'}</td>
                    <td>{h.room_count}</td>
                    <td>{h.guest_count}</td>
                    <td>{h.reservation_count}</td>
                    <td>{fmt(h.revenue)}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => renameHotel(h)}
                      >
                        Rename
                      </button>
                    </td>
                  </tr>
                ))}
                {hotels.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted text-center">
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
