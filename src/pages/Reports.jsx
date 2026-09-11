import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'

const TAX_RATE = 0.12

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
    x.getDate(),
  ).padStart(2, '0')}`
}

export default function Reports() {
  const { hotelId, hotelLoading } = useHotel()
  const [rooms, setRooms] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [orders, setOrders] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [r, inv, pay, ord, resv] = await Promise.all([
        supabase.from('rooms').select('status').eq('hotel_id', hotelId),
        supabase.from('invoices').select('total, status').eq('hotel_id', hotelId),
        supabase.from('payments').select('amount, method, created_at').eq('hotel_id', hotelId),
        supabase.from('orders').select('total, status, created_at').eq('hotel_id', hotelId),
        supabase.from('reservations').select('status').eq('hotel_id', hotelId),
      ])
      if (r.error) throw r.error
      if (inv.error) throw inv.error
      if (pay.error) throw pay.error
      if (ord.error) throw ord.error
      if (resv.error) throw resv.error
      setRooms(r.data)
      setInvoices(inv.data)
      setPayments(pay.data)
      setOrders(ord.data)
      setReservations(resv.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const totalRooms = rooms.length
    const occupied = rooms.filter((x) => x.status === 'occupied').length
    const occupancy = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0

    const invoiced = invoices
      .filter((i) => i.status !== 'void')
      .reduce((s, i) => s + Number(i.total || 0), 0)
    const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

    const today = dayKey(new Date())
    const todaySales = orders
      .filter((o) => dayKey(o.created_at) === today && o.status !== 'cancelled')
      .reduce((s, o) => s + Number(o.total || 0), 0)

    const byMethod = payments.reduce((m, p) => {
      m[p.method] = (m[p.method] || 0) + Number(p.amount || 0)
      return m
    }, {})

    const byStatus = reservations.reduce((m, r) => {
      m[r.status] = (m[r.status] || 0) + 1
      return m
    }, {})

    return { occupancy, invoiced, collected, todaySales, byMethod, byStatus }
  }, [rooms, invoices, payments, orders, reservations])

  const last7 = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dayKey(d)
      days.push({
        key,
        label: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
        sales: orders
          .filter((o) => dayKey(o.created_at) === key && o.status !== 'cancelled')
          .reduce((s, o) => s + Number(o.total || 0), 0),
      })
    }
    return days
  }, [orders])

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Occupancy, sales, and revenue overview."
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
          <div className="row g-3 mb-4">
            {[
              ['Occupancy', `${metrics.occupancy}%`],
              ['Invoiced revenue', fmt(metrics.invoiced)],
              ['Collected', fmt(metrics.collected)],
              ['Today’s sales', fmt(metrics.todaySales)],
            ].map(([label, value]) => (
              <div className="col-6 col-md-3" key={label}>
                <div className="card text-center h-100">
                  <div className="card-body">
                    <div className="fs-3 fw-semibold">{value}</div>
                    <div className="text-muted small">{label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header fw-semibold">Last 7 days — restaurant sales</div>
                <div className="card-body">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th className="text-end">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last7.map((d) => (
                        <tr key={d.key}>
                          <td>{d.label}</td>
                          <td className="text-end">{fmt(d.sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header fw-semibold">Payments by method</div>
                <div className="card-body">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['cash', 'card', 'gcash'].map((m) => (
                        <tr key={m}>
                          <td className="text-capitalize">{m}</td>
                          <td className="text-end">{fmt(metrics.byMethod[m])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header fw-semibold">Reservations by status</div>
                <div className="card-body">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th className="text-end">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics.byStatus).map(([s, c]) => (
                        <tr key={s}>
                          <td>{s}</td>
                          <td className="text-end">{c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header fw-semibold">Room occupancy</div>
                <div className="card-body">
                  <div className="d-flex justify-content-between small mb-2">
                    <span>Occupied</span>
                    <span className="fw-semibold">
                      {rooms.filter((x) => x.status === 'occupied').length} / {rooms.length}
                    </span>
                  </div>
                  <div className="progress" style={{ height: 20 }}>
                    <div
                      className="progress-bar bg-primary"
                      style={{ width: `${metrics.occupancy}%` }}
                    >
                      {metrics.occupancy}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
