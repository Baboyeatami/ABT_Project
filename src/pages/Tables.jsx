import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const TABLE_STATUS = {
  available: 'success',
  occupied: 'primary',
  reserved: 'warning',
}

const emptyTable = { table_number: '', capacity: 2, status: 'available' }

export default function Tables() {
  const { hotelId, hotelLoading } = useHotel()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [show, setShow] = useState(false)
  const [table, setTable] = useState(emptyTable)
  const [tableId, setTableId] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('dining_tables')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('table_number')
    if (err) setError(err.message)
    else setTables(data)
    setLoading(false)
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        table_number: table.table_number,
        capacity: Number(table.capacity),
        status: table.status,
      }
      if (tableId) await supabase.from('dining_tables').update(payload).eq('id', tableId)
      else await supabase.from('dining_tables').insert(payload)
      setShow(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const setStatus = async (t, status) => {
    await supabase.from('dining_tables').update({ status }).eq('id', t.id)
    load()
  }

  const remove = async (t) => {
    if (!window.confirm(`Delete table ${t.table_number}?`)) return
    await supabase.from('dining_tables').delete().eq('id', t.id)
    load()
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Dining Tables"
        subtitle="Manage restaurant tables and availability."
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setTableId(null)
              setTable(emptyTable)
              setShow(true)
            }}
          >
            + New table
          </button>
        }
      />

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && (
        <div className="row g-3">
          {tables.map((t) => (
            <div className="col-6 col-md-4 col-lg-3" key={t.id}>
              <div className="card text-center h-100">
                <div className="card-body">
                  <div className="fs-4 fw-semibold">{t.table_number}</div>
                  <div className="text-muted small mb-2">Capacity {t.capacity}</div>
                  <span
                    className={`badge text-bg-${TABLE_STATUS[t.status] || 'secondary'}`}
                  >
                    {t.status}
                  </span>
                </div>
                <div className="card-footer d-flex gap-2 justify-content-center">
                  <select
                    className="form-select form-select-sm w-auto"
                    value={t.status}
                    onChange={(e) => setStatus(t, e.target.value)}
                  >
                    {Object.keys(TABLE_STATUS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setTableId(t.id)
                      setTable(t)
                      setShow(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remove(t)}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <p className="text-muted">No tables yet. Add your first table.</p>
          )}
        </div>
      )}

      {show && (
        <Modal
          title={tableId ? 'Edit table' : 'New table'}
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
            <label className="form-label">Table number</label>
            <input
              className="form-control"
              value={table.table_number}
              onChange={(e) => setTable({ ...table, table_number: e.target.value })}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Capacity</label>
              <input
                type="number"
                className="form-control"
                value={table.capacity}
                onChange={(e) => setTable({ ...table, capacity: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={table.status}
                onChange={(e) => setTable({ ...table, status: e.target.value })}
              >
                {Object.keys(TABLE_STATUS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
