import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const emptyGuest = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_type: '',
  id_number: '',
  notes: '',
}

export default function Guests() {
  const { hotelId, hotelLoading } = useHotel()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const [show, setShow] = useState(false)
  const [guest, setGuest] = useState(emptyGuest)
  const [guestId, setGuestId] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('guests')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setGuests(data)
    setLoading(false)
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        ...guest,
      }
      if (guestId) {
        await supabase.from('guests').update(payload).eq('id', guestId)
      } else {
        await supabase.from('guests').insert(payload)
      }
      setShow(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const remove = async (g) => {
    if (!window.confirm(`Delete guest ${g.first_name} ${g.last_name}?`)) return
    await supabase.from('guests').delete().eq('id', g.id)
    load()
  }

  const filtered = guests.filter((g) => {
    const q = query.toLowerCase()
    return (
      !q ||
      `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) ||
      (g.email || '').toLowerCase().includes(q) ||
      (g.phone || '').toLowerCase().includes(q)
    )
  })

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Guests"
        subtitle="Guest registry."
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setGuestId(null)
              setGuest(emptyGuest)
              setShow(true)
            }}
          >
            + New guest
          </button>
        }
      />

      <div className="mb-3">
        <input
          className="form-control"
          placeholder="Search name, email, or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>ID</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td className="fw-semibold">
                    {g.first_name} {g.last_name}
                  </td>
                  <td>{g.email || '—'}</td>
                  <td>{g.phone || '—'}</td>
                  <td>
                    {g.id_type ? `${g.id_type}: ${g.id_number || ''}` : '—'}
                  </td>
                  <td>{g.notes || '—'}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-1"
                      onClick={() => {
                        setGuestId(g.id)
                        setGuest(g)
                        setShow(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => remove(g)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted text-center">
                    No guests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <Modal
          title={guestId ? 'Edit guest' : 'New guest'}
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
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">First name</label>
              <input
                className="form-control"
                value={guest.first_name}
                onChange={(e) => setGuest({ ...guest, first_name: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Last name</label>
              <input
                className="form-control"
                value={guest.last_name}
                onChange={(e) => setGuest({ ...guest, last_name: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                value={guest.email}
                onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                value={guest.phone}
                onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">ID type</label>
              <input
                className="form-control"
                value={guest.id_type}
                onChange={(e) => setGuest({ ...guest, id_type: e.target.value })}
                placeholder="e.g. Passport"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">ID number</label>
              <input
                className="form-control"
                value={guest.id_number}
                onChange={(e) => setGuest({ ...guest, id_number: e.target.value })}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows="2"
                value={guest.notes}
                onChange={(e) => setGuest({ ...guest, notes: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
