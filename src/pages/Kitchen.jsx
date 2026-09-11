import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'

const NEXT_STATUS = {
  sent: 'preparing',
  preparing: 'served',
}

const STATUS_LABEL = {
  sent: 'To prepare',
  preparing: 'Preparing',
  served: 'Ready to serve',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_COLOR = {
  sent: 'warning',
  preparing: 'info',
  served: 'success',
}

export default function Kitchen() {
  const { hotelId, hotelLoading } = useHotel()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, order_items(*), dining_tables(table_number)')
      .eq('hotel_id', hotelId)
      .in('status', ['sent', 'preparing', 'served'])
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setOrders(data)
    setLoading(false)
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const advance = async (order) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    load()
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Kitchen"
        subtitle="Incoming orders and preparation status."
        actions={
          <button className="btn btn-sm btn-outline-primary" onClick={load}>
            Refresh
          </button>
        }
      />

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && (
        <>
          {orders.length === 0 && <p className="text-muted">No active orders.</p>}
          <div className="row g-3">
            {orders.map((o) => (
              <div className="col-12 col-md-6 col-xl-4" key={o.id}>
                <div className="card h-100">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div>
                      <span className="fw-semibold">
                        #{o.id.slice(0, 8)}
                      </span>
                      <span className="text-muted small ms-2">
                        {o.order_type === 'dine_in' ? `Table ${o.dining_tables?.table_number || ''}` : 'Takeaway'}
                      </span>
                    </div>
                    <span className={`badge text-bg-${STATUS_COLOR[o.status] || 'secondary'}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <div className="card-body">
                    <ul className="list-unstyled mb-0">
                      {o.order_items.map((it) => (
                        <li key={it.id} className="d-flex justify-content-between">
                          <span>
                            {it.quantity} × {it.item_name}
                          </span>
                          <span className="text-muted small">
                            ₱{(it.quantity * it.unit_price).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {NEXT_STATUS[o.status] && (
                    <div className="card-footer">
                      <button
                        className="btn btn-primary w-100 btn-sm"
                        onClick={() => advance(o)}
                      >
                        Mark as {STATUS_LABEL[NEXT_STATUS[o.status]]}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
