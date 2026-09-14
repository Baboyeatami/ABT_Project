import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import InvoicePrint from '../components/InvoicePrint'
import { operation } from '../lib/operations'

const TAX_RATE = 0.12

const INV_STATUS = {
  unpaid: 'danger',
  partially_paid: 'warning',
  paid: 'success',
  void: 'secondary',
}

function Badge({ status }) {
  return (
    <span className={`badge text-bg-${INV_STATUS[status] || 'secondary'}`}>{status}</span>
  )
}

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

function nightsBetween(a, b) {
  const d = Math.ceil((new Date(b) - new Date(a)) / 86400000)
  return Math.max(d, 1)
}

export default function Billing() {
  const { hotelId, hotel, hotelLoading } = useHotel()
  const [tab, setTab] = useState('folios')
  const [stays, setStays] = useState([])
  const [invoices, setInvoices] = useState([])
  const [folioCharges, setFolioCharges] = useState([])
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [stayFilter, setStayFilter] = useState('all')
  const [payInv, setPayInv] = useState(null)
  const [viewInv, setViewInv] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payRef, setPayRef] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [stayRes, invRes, chargeRes, orderRes, payRes] = await Promise.all([
        supabase
          .from('stay_sessions')
          .select(
            '*, guests(first_name, last_name), rooms(room_number, rate, room_type_id, room_types(base_rate)), reservations(check_in, check_out)',
          )
          .eq('hotel_id', hotelId),
        supabase
          .from('invoices')
          .select(
            '*, stay_sessions(check_in_at, check_out_at, guests(first_name, last_name, email, phone), rooms(room_number, floor, rate, room_types(name)))',
          )
          .eq('hotel_id', hotelId)
          .order('created_at', { ascending: false }),
        supabase.from('folio_charges').select('*').eq('hotel_id', hotelId),
        supabase.from('orders').select('id, stay_session_id, subtotal, tax, total, status').eq('hotel_id', hotelId),
        supabase.from('payments').select('*').eq('hotel_id', hotelId),
      ])
      if (stayRes.error) throw stayRes.error
      if (invRes.error) throw invRes.error
      if (chargeRes.error) throw chargeRes.error
      if (orderRes.error) throw orderRes.error
      if (payRes.error) throw payRes.error
      setStays(stayRes.data)
      setInvoices(invRes.data)
      setFolioCharges(chargeRes.data)
      setOrders(orderRes.data)
      setPayments(payRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const stayTotals = useMemo(() => {
    const map = {}
    for (const stay of stays) {
      const res = stay.reservations
      const room = stay.rooms
      const rate = Number(room?.rate ?? room?.room_types?.base_rate ?? 0)
      const nights = res
        ? nightsBetween(res.check_in, res.check_out)
        : stay.check_out_at
          ? nightsBetween(stay.check_in_at, stay.check_out_at)
          : nightsBetween(stay.check_in_at, new Date())
      const roomCharge = rate * nights
      const restCharge = orders
        .filter((o) => o.stay_session_id === stay.id && o.status !== 'cancelled')
        .reduce((s, o) => s + Number(o.subtotal || 0), 0)
      const manual = folioCharges
        .filter((c) => c.stay_session_id === stay.id && c.source === 'manual')
        .reduce((s, c) => s + Number(c.amount || 0), 0)
      const subtotal = roomCharge + restCharge + manual
      const tax = Math.round(((roomCharge + manual) * TAX_RATE + orders.filter(o => o.stay_session_id === stay.id && o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.tax || 0), 0)) * 100) / 100
      map[stay.id] = {
        roomCharge,
        restCharge,
        manual,
        nights,
        rate,
        subtotal,
        tax,
        total: subtotal + tax,
      }
    }
    return map
  }, [stays, orders, folioCharges])

  const alreadyInvoiced = useMemo(
    () => new Set(invoices.filter(i => i.status !== 'void').map((i) => i.stay_session_id)),
    [invoices],
  )

  const createInvoice = async (stay) => {
    if (busy) return
    setBusy(true)
    try {
      const inv = await operation('issue_invoice', { p_stay: stay.id })
      alert(`Invoice ${inv.invoice_number} created.`)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const openPay = (inv) => {
    setPayInv(inv)
    setPayAmount((Number(inv.total) - Number(inv.amount_paid)).toFixed(2))
    setPayMethod('cash')
    setPayRef('')
  }

  const printInvoice = () => {
    const el = document.getElementById('invoice-print')
    if (!el) return
    const styles = [
      'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;margin:0;padding:24px}',
      '.p-3{padding:1rem}.pb-3{padding-bottom:1rem}.pt-3{padding-top:1rem}',
      '.mb-1{margin-bottom:.25rem}.mb-3{margin-bottom:1rem}.mt-1{margin-top:.25rem}.mt-3{margin-top:1rem}',
      '.me-1{margin-right:.25rem}.me-2{margin-right:.5rem}',
      '.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}',
      '.small{font-size:.875rem}.fw-bold{font-weight:700}.fw-semibold{font-weight:600}',
      '.text-brand{color:#2c6fdb}.text-muted{color:#6b7280}',
      '.text-uppercase{text-transform:uppercase}.text-end{text-align:right}.text-center{text-align:center}.text-capitalize{text-transform:capitalize}',
      '.d-flex{display:flex}.justify-content-between{justify-content:space-between}.align-items-center{align-items:center}',
      '.border-bottom{border-bottom:1px solid #e5e7eb}.border-top{border-top:1px solid #e5e7eb}',
      '.h4{font-size:1.5rem;font-weight:700}.h5{font-size:1.25rem;font-weight:700}',
      '.row{display:flex;flex-wrap:wrap;margin-left:-12px;margin-right:-12px}.g-3{margin:0 -0.75rem}',
      '.col-sm-6,.col-lg-5{padding-left:12px;padding-right:12px}.col-sm-6{flex:0 0 50%;max-width:50%}.col-lg-5{flex:0 0 41.6667%;max-width:41.6667%}',
      '.table{width:100%;border-collapse:collapse;font-size:.9rem;margin:0}.table-sm{font-size:.85rem}',
      '.table th,.table td{padding:.5rem;border-bottom:1px solid #eef0f4;text-align:left;vertical-align:middle}',
      '.table thead th{font-size:.7rem;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}',
      '.table .text-end{text-align:right}',
      '.badge{display:inline-block;padding:.3em .55em;font-size:.75rem;font-weight:600;border-radius:4px}',
      '.text-bg-success{background:#198754;color:#fff}.text-bg-secondary{background:#6c757d;color:#fff}.text-bg-warning{background:#ffc107;color:#000}.text-bg-danger{background:#dc3545;color:#fff}',
    ].join('\n')
    const win = window.open('', '_blank', 'width=820,height=900')
    if (!win) {
      alert('Please allow pop-ups to print the invoice.')
      return
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Invoice</title><style>${styles}</style></head><body>${el.outerHTML}</body></html>`,
    )
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 350)
  }

  const recordPayment = async () => {
    if (!payInv) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      alert('Enter a valid amount.')
      return
    }
    setBusy(true)
    try {
      await operation('record_payment', { p_invoice: payInv.id, p_amount: amount, p_method: payMethod, p_reference: payRef || null })
      setPayInv(null)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const voidInvoice = async (inv) => {
    if (!window.confirm(`Void invoice ${inv.invoice_number}?`)) return
    try {
      await operation('void_invoice', { p_invoice: inv.id })
      load()
    } catch (err) { alert(err.message) }
  }

  const visibleStays = stays.filter(
    (s) => stayFilter === 'all' || s.status === stayFilter,
  )

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader title="Billing" subtitle="Guest folios, invoices, and payments." />

      <ul className="nav nav-tabs mb-3">
        {['folios', 'invoices'].map((t) => (
          <li className="nav-item" key={t}>
            <button
              className={`nav-link ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'folios' ? 'Guest Folios' : 'Invoices'}
            </button>
          </li>
        ))}
      </ul>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && tab === 'folios' && (
        <>
          <div className="mb-3">
            <select
              className="form-select w-auto"
              value={stayFilter}
              onChange={(e) => setStayFilter(e.target.value)}
            >
              <option value="all">All stays</option>
              <option value="open">Currently checked in</option>
              <option value="closed">Checked out</option>
            </select>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Nights</th>
                  <th>Room</th>
                  <th>Restaurant</th>
                  <th>Manual</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleStays.map((s) => {
                  const t = stayTotals[s.id]
                  return (
                    <tr key={s.id}>
                      <td className="fw-semibold">
                        {s.guests?.first_name} {s.guests?.last_name || '—'}
                      </td>
                      <td>{s.rooms?.room_number || '—'}</td>
                      <td>{t.nights}</td>
                      <td>{fmt(t.roomCharge)}</td>
                      <td>{fmt(t.restCharge)}</td>
                      <td>{fmt(t.manual)}</td>
                      <td className="fw-bold">{fmt(t.total)}</td>
                      <td className="text-end">
                        {alreadyInvoiced.has(s.id) ? (
                          <span className="text-muted small">Invoiced</span>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => createInvoice(s)}
                          >
                            Create invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {visibleStays.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-muted text-center">
                      No stays yet. Check in guests from Front Desk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && tab === 'invoices' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const stay = inv.stay_sessions
                return (
                  <tr key={inv.id}>
                    <td className="fw-semibold">{inv.invoice_number}</td>
                    <td>
                      {stay?.guests?.first_name} {stay?.guests?.last_name || '—'}
                    </td>
                    <td>{stay?.rooms?.room_number || '—'}</td>
                    <td>{fmt(inv.total)}</td>
                    <td>{fmt(inv.amount_paid)}</td>
                    <td>
                      <Badge status={inv.status} />
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => setViewInv(inv)}
                      >
                        <i className="bi bi-printer me-1" />
                        View / Print
                      </button>
                      {inv.status !== 'void' && inv.status !== 'paid' && (
                        <button
                          className="btn btn-sm btn-success me-1"
                          onClick={() => openPay(inv)}
                        >
                          Record payment
                        </button>
                      )}
                      {inv.status !== 'void' && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => voidInvoice(inv)}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted text-center">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {payInv && (
        <Modal
          title={`Record payment — ${payInv.invoice_number}`}
          onClose={() => setPayInv(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPayInv(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={recordPayment}>
                {busy ? 'Saving…' : 'Save payment'}
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Amount (PHP)</label>
            <input
              type="number"
              className="form-control"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Method</label>
            <select
              className="form-select"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="gcash">GCash</option>
            </select>
          </div>
          <div>
            <label className="form-label">Reference (optional)</label>
            <input
              className="form-control"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. GCash ref #"
            />
          </div>
        </Modal>
      )}

      {viewInv && (
        <Modal
          title="Invoice"
          onClose={() => setViewInv(null)}
          footer={
            <button className="btn btn-primary no-print" onClick={printInvoice}>
              <i className="bi bi-printer me-1" />
              Print invoice
            </button>
          }
        >
          <InvoicePrint
            invoice={viewInv}
            charges={folioCharges.filter((c) => c.stay_session_id === viewInv.stay_session_id)}
            payments={payments.filter((p) => p.invoice_id === viewInv.id)}
            hotel={hotel}
          />
        </Modal>
      )}
    </div>
  )
}
