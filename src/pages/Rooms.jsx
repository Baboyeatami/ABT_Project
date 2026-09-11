import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const ROOM_STATUS = {
  available: 'success',
  occupied: 'primary',
  maintenance: 'warning',
}

function StatusBadge({ status }) {
  return (
    <span className={`badge text-bg-${ROOM_STATUS[status] || 'secondary'}`}>
      {status}
    </span>
  )
}

const emptyRoom = { room_type_id: '', room_number: '', floor: '', rate: '', status: 'available' }
const emptyType = { name: '', capacity: 1, base_rate: '', description: '' }

export default function Rooms() {
  const { hotelId, hotelLoading } = useHotel()
  const [tab, setTab] = useState('rooms')
  const [rooms, setRooms] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showRoom, setShowRoom] = useState(false)
  const [room, setRoom] = useState(emptyRoom)
  const [roomId, setRoomId] = useState(null)

  const [showType, setShowType] = useState(false)
  const [type, setType] = useState(emptyType)
  const [typeId, setTypeId] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [roomsRes, typesRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('hotel_id', hotelId).order('room_number'),
        supabase.from('room_types').select('*').eq('hotel_id', hotelId).order('name'),
      ])
      if (roomsRes.error) throw roomsRes.error
      if (typesRes.error) throw typesRes.error
      setRooms(roomsRes.data)
      setTypes(typesRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const typeName = (id) => types.find((t) => t.id === id)?.name || '—'

  const saveRoom = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        room_type_id: room.room_type_id || null,
        room_number: room.room_number,
        floor: room.floor,
        rate: room.rate ? Number(room.rate) : null,
        status: room.status,
      }
      if (roomId) {
        await supabase.from('rooms').update(payload).eq('id', roomId)
      } else {
        await supabase.from('rooms').insert(payload)
      }
      setShowRoom(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const openRoom = (r) => {
    setRoomId(r?.id || null)
    setRoom(
      r || {
        room_type_id: '',
        room_number: '',
        floor: '',
        rate: '',
        status: 'available',
      },
    )
    setShowRoom(true)
  }

  const setStatus = async (r, status) => {
    await supabase.from('rooms').update({ status }).eq('id', r.id)
    load()
  }

  const saveType = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        name: type.name,
        capacity: Number(type.capacity),
        base_rate: Number(type.base_rate || 0),
        description: type.description,
      }
      if (typeId) {
        await supabase.from('room_types').update(payload).eq('id', typeId)
      } else {
        await supabase.from('room_types').insert(payload)
      }
      setShowType(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle="Manage room types and room availability."
        actions={
          tab === 'rooms' ? (
            <button className="btn btn-primary btn-sm" onClick={() => openRoom(null)}>
              + Add room
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setTypeId(null)
                setType(emptyType)
                setShowType(true)
              }}
            >
              + Add room type
            </button>
          )
        }
      />

      <ul className="nav nav-tabs mb-3">
        {['rooms', 'types'].map((t) => (
          <li className="nav-item" key={t}>
            <button
              className={`nav-link ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'rooms' ? 'Rooms' : 'Room Types'}
            </button>
          </li>
        ))}
      </ul>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && tab === 'rooms' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Floor</th>
                <th>Rate</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.room_number}</td>
                  <td>{typeName(r.room_type_id)}</td>
                  <td>{r.floor || '—'}</td>
                  <td>{r.rate ? `₱${Number(r.rate).toLocaleString()}` : '—'}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-end">
                    <select
                      className="form-select form-select-sm d-inline-block w-auto"
                      value={r.status}
                      onChange={(e) => setStatus(r, e.target.value)}
                    >
                      {Object.keys(ROOM_STATUS).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm btn-outline-secondary ms-1"
                      onClick={() => openRoom(r)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted text-center">
                    No rooms yet. Add your first room.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'types' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Capacity</th>
                <th>Base rate</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td className="fw-semibold">{t.name}</td>
                  <td>{t.capacity}</td>
                  <td>₱{Number(t.base_rate).toLocaleString()}</td>
                  <td>{t.description || '—'}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setTypeId(t.id)
                        setType(t)
                        setShowType(true)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted text-center">
                    No room types yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRoom && (
        <Modal
          title={roomId ? 'Edit room' : 'Add room'}
          onClose={() => setShowRoom(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowRoom(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveRoom}>
                Save
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Room number</label>
            <input
              className="form-control"
              value={room.room_number}
              onChange={(e) => setRoom({ ...room, room_number: e.target.value })}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={room.room_type_id}
                onChange={(e) => setRoom({ ...room, room_type_id: e.target.value })}
              >
                <option value="">— None —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Floor</label>
              <input
                className="form-control"
                value={room.floor}
                onChange={(e) => setRoom({ ...room, floor: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Rate (PHP)</label>
              <input
                className="form-control"
                type="number"
                value={room.rate}
                onChange={(e) => setRoom({ ...room, rate: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={room.status}
                onChange={(e) => setRoom({ ...room, status: e.target.value })}
              >
                {Object.keys(ROOM_STATUS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {showType && (
        <Modal
          title={typeId ? 'Edit room type' : 'Add room type'}
          onClose={() => setShowType(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowType(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveType}>
                Save
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={type.name}
              onChange={(e) => setType({ ...type, name: e.target.value })}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Capacity</label>
              <input
                className="form-control"
                type="number"
                value={type.capacity}
                onChange={(e) => setType({ ...type, capacity: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Base rate (PHP)</label>
              <input
                className="form-control"
                type="number"
                value={type.base_rate}
                onChange={(e) => setType({ ...type, base_rate: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows="2"
              value={type.description}
              onChange={(e) => setType({ ...type, description: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
