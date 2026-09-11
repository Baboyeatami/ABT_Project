import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'

const TAX_RATE = 0.12

export default function Pos() {
  const { hotelId, hotelLoading } = useHotel()
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [tables, setTables] = useState([])
  const [stays, setStays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [cart, setCart] = useState([])
  const [orderType, setOrderType] = useState('dine_in')
  const [tableId, setTableId] = useState('')
  const [stayId, setStayId] = useState('')
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [itemRes, catRes, tableRes, stayRes] = await Promise.all([
        supabase
          .from('menu_items')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('available', true)
          .order('name'),
        supabase
          .from('menu_categories')
          .select('*')
          .eq('hotel_id', hotelId)
          .order('sort_order'),
        supabase.from('dining_tables').select('*').eq('hotel_id', hotelId).order('table_number'),
        supabase
          .from('stay_sessions')
          .select('id, rooms(room_number), guests(first_name, last_name)')
          .eq('hotel_id', hotelId)
          .eq('status', 'open'),
      ])
      if (itemRes.error) throw itemRes.error
      if (catRes.error) throw catRes.error
      if (tableRes.error) throw tableRes.error
      if (stayRes.error) throw stayRes.error
      setItems(itemRes.data)
      setCats(catRes.data)
      setTables(tableRes.data)
      setStays(stayRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    return cats.map((c) => ({
      category: c,
      items: items.filter((it) => it.category_id === c.id),
    }))
  }, [cats, items])

  const uncategorised = items.filter((it) => !it.category_id)

  const addItem = (it) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === it.id)
      if (existing) {
        return prev.map((l) =>
          l.menu_item_id === it.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...prev, { menu_item_id: it.id, name: it.name, price: Number(it.price), quantity: 1 }]
    })
  }

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.menu_item_id === id ? { ...l, quantity: l.quantity + delta } : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0)
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax

  const placeOrder = async () => {
    if (cart.length === 0) {
      alert('Add at least one item.')
      return
    }
    if (orderType === 'dine_in' && !tableId) {
      alert('Select a table for dine-in orders.')
      return
    }
    setPlacing(true)
    try {
      const linkedStay = stays.find((s) => s.id === stayId)
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          hotel_id: hotelId,
          table_id: orderType === 'dine_in' ? tableId || null : null,
          stay_session_id: stayId || null,
          guest_id: linkedStay?.guest_id || null,
          order_type: orderType,
          status: 'sent',
          subtotal,
          tax,
          total,
        })
        .select()
        .single()
      if (orderErr) throw orderErr

      const lines = cart.map((l) => ({
        hotel_id: hotelId,
        order_id: order.id,
        menu_item_id: l.menu_item_id,
        item_name: l.name,
        quantity: l.quantity,
        unit_price: l.price,
        line_total: l.price * l.quantity,
      }))
      const { error: lineErr } = await supabase.from('order_items').insert(lines)
      if (lineErr) throw lineErr

      if (orderType === 'dine_in' && tableId) {
        await supabase.from('dining_tables').update({ status: 'occupied' }).eq('id', tableId)
      }

      setCart([])
      setNotes('')
      setTableId('')
      setStayId('')
      alert(`Order #${order.id.slice(0, 8)} placed successfully.`)
    } catch (err) {
      alert(err.message)
    } finally {
      setPlacing(false)
    }
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader title="Point of Sale" subtitle="Place restaurant orders." />

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && (
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="d-flex gap-2 mb-3">
              <select
                className="form-select w-auto"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              >
                <option value="dine_in">Dine-in</option>
                <option value="takeaway">Takeaway</option>
              </select>
              {orderType === 'dine_in' && (
                <select
                  className="form-select"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                >
                  <option value="">— Select table —</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.table_number} ({t.status})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mb-3">
              <select
                className="form-select"
                value={stayId}
                onChange={(e) => setStayId(e.target.value)}
              >
                <option value="">Charge to room (optional)</option>
                {stays.map((s) => (
                  <option key={s.id} value={s.id}>
                    Room {s.rooms?.room_number || '?'} — {s.guests?.first_name}{' '}
                    {s.guests?.last_name || 'Guest'}
                  </option>
                ))}
              </select>
            </div>

            {grouped.map(({ category, items: catItems }) =>
              catItems.length === 0 ? null : (
                <div key={category.id} className="mb-3">
                  <h6 className="text-muted text-uppercase small mb-2">{category.name}</h6>
                  <div className="row g-2">
                    {catItems.map((it) => (
                      <div className="col-6 col-md-4" key={it.id}>
                        <button
                          className="btn btn-outline-primary w-100 h-100 text-start"
                          onClick={() => addItem(it)}
                        >
                          <div className="fw-semibold">{it.name}</div>
                          <div className="small text-muted">₱{Number(it.price).toLocaleString()}</div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}

            {uncategorised.length > 0 && (
              <div className="mb-3">
                <h6 className="text-muted text-uppercase small mb-2">Other</h6>
                <div className="row g-2">
                  {uncategorised.map((it) => (
                    <div className="col-6 col-md-4" key={it.id}>
                      <button
                        className="btn btn-outline-primary w-100 h-100 text-start"
                        onClick={() => addItem(it)}
                      >
                        <div className="fw-semibold">{it.name}</div>
                        <div className="small text-muted">₱{Number(it.price).toLocaleString()}</div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <p className="text-muted">No menu items available. Add items in Menu.</p>
            )}
          </div>

          <div className="col-lg-5">
            <div className="card">
              <div className="card-header fw-semibold">Current Order</div>
              <div className="card-body">
                {cart.length === 0 && (
                  <p className="text-muted small mb-0">Click items to add to the order.</p>
                )}
                {cart.map((l) => (
                  <div
                    key={l.menu_item_id}
                    className="d-flex justify-content-between align-items-center mb-2"
                  >
                    <div>
                      <div className="fw-semibold small">{l.name}</div>
                      <div className="text-muted small">
                        ₱{Number(l.price).toLocaleString()} × {l.quantity}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => changeQty(l.menu_item_id, -1)}
                      >
                        −
                      </button>
                      <span className="small">{l.quantity}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => changeQty(l.menu_item_id, 1)}
                      >
                        +
                      </button>
                      <span className="small fw-semibold">
                        ₱{(l.price * l.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <div className="d-flex justify-content-between small mb-1">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between small mb-1">
                  <span>Tax (12%)</span>
                  <span>₱{tax.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold mb-3">
                  <span>Total</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
                <input
                  className="form-control mb-2"
                  placeholder="Kitchen notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  className="btn btn-primary w-100"
                  disabled={placing || cart.length === 0}
                  onClick={placeOrder}
                >
                  {placing ? 'Placing…' : 'Place order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
