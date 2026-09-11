import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

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
  const { hotelId, hotelLoading } = useHotel()
  const [tab, setTab] = useState('folios')
  const [stays, setStays] = useState([])
  const [invoices, setInvoices] = useState([])
  const [folioCharges, setFolioCharges] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [stayFilter, setStayFilter] = useState('all')
  const [payInv, setPayInv] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payRef, setPayRef] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [stayRes, invRes, chargeRes, orderRes] = await Promise.all([
        supabase
          .from('stay_sessions')
          .select(
            '*, guests(first_name, last_name), rooms(room_number, rate, room_type_id, room_types(base_rate)), reservations(check_in, check_out)',
          )
          .eq('hotel_id', hotelId),
        supabase
          .from('invoices')
          .select(
            '*, stay_sessions(guests(first_name, last_name), rooms(room_number))',
          )
          .eq('hotel_id', hotelId)
          .order('created_at', { ascending: false }),
        supabase.from('folio_charges').select('*').eq('hotel_id', hotelId),
        supabase.from('orders').select('id, stay_session_id, total').eq('hotel_id', hotelId),
      ])
      if (stayRes.error) throw stayRes.error
      if (invRes.error) throw invRes.error
      if (chargeRes.error) throw chargeRes.error
      if (orderRes.error) throw orderRes.error
      setStays(stayRes.data)
      setInvoices(invRes.data)
      setFolioCharges(chargeRes.data)
      setOrders(orderRes.data)
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
      const rate = Number(room?.rate || room?.room_types?.base_rate || 0)
      const nights = res
        ? nightsBetween(res.check_in, res.check_out)
        : stay.check_out_at
          ? nightsBetween(stay.check_in_at, stay.check_out_at)
          : nightsBetween(stay.check_in_at, new Date())
      const roomCharge = rate * nights
      const restCharge = orders
        .filter((o) => o.stay_session_id === stay.id)
        .reduce((s, o) => s + Number(o.total || 0), 0)
      const manual = folioCharges
        .filter((c) => c.stay_session_id === stay.id)
        .reduce((s, c) => s + Number(c.amount || 0), 0)
      const subtotal = roomCharge + restCharge + manual
      const tax = subtotal * TAX_RATE
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
    () => new Set(invoices.map((i) => i.stay_session_id)),
    [invoices],
  )

  const createInvoice = async (stay) => {
    try {
      const t = stayTotals[stay.id]
      const now = new Date()
      if (!folioCharges.some((c) => c.stay_session_id === stay.id && c.source === 'room')) {
        await supabase.from('folio_charges').insert({
          hotel_id: hotelId,
          stay_session_id: stay.id,
          source: 'room',
          description: `Room charge (${t.nights} night${t.nights > 1 ? 's' : ''})`,
          amount: t.roomCharge,
        })
      }
      if (
        t.restCharge > 0 &&
        !folioCharges.some((c) => c.stay_session_id === stay.id && c.source === 'restaurant')
      ) {
        await supabase.from('folio_charges').insert({
          hotel_id: hotelId,
          stay_session_id: stay.id,
          source: 'restaurant',
          description: 'Restaurant charges',
          amount: t.restCharge,
        })
      }

      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          hotel_id: hotelId,
          stay_session_id: stay.id,
          invoice_number: `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${stay.id.slice(0, 6)}`,
          subtotal: t.subtotal,
          tax: t.tax,
          discount: 0,
          total: t.total,
          amount_paid: 0,
          status: 'unpaid',
        })
        .select()
        .single()
      if (invErr) throw invErr
      alert(`Invoice ${inv.invoice_number} created.`)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const openPay = (inv) => {
    setPayInv(inv)
    setPayAmount((Number(inv.total) - Number(inv.amount_paid)).toFixed(2))
    setPayMethod('cash')
    setPayRef('')
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
      await supabase.from('payments').insert({
        hotel_id: hotelId,
        invoice_id: payInv.id,
        amount,
        method: payMethod,
        reference: payRef || null,
      })
      const newPaid = Number(payInv.amount_paid) + amount
      const status = newPaid >= Number(payInv.total) ? 'paid' : 'partially_paid'
      await supabase.from('invoices').update({ amount_paid: newPaid, status }).eq('id', payInv.id)
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
    await supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id)
    load()
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
    </div>
  )
}
