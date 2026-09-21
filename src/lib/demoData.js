// Demo mode: an in-browser stand-in for Supabase so the whole platform can be
// inspected with `npm run dev` — no Docker or Supabase project needed.
//
// It provides:
//   - a seeded in-memory/localStorage data store (hotels, rooms, menu, guests,
//     reservations, orders, invoices, ...)
//   - a minimal Supabase-like client (`from()` query builder + `auth`)
//   - seeded login accounts (see DEMO_ACCOUNTS)
//   - a mock admin API for the instructor panel

export const DEMO_PASSWORD = 'demo1234'

export const DEMO_ACCOUNTS = [
  { email: 'instructor@abt.demo', password: DEMO_PASSWORD, profileId: 'user-instructor' },
  { email: 'owner@abt.demo', password: DEMO_PASSWORD, profileId: 'user-owner' },
  { email: 'frontdesk@abt.demo', password: DEMO_PASSWORD, profileId: 'user-frontdesk' },
  { email: 'kitchen@abt.demo', password: DEMO_PASSWORD, profileId: 'user-kitchen' },
  { email: 'cashier@abt.demo', password: DEMO_PASSWORD, profileId: 'user-cashier' },
]

// ---------------------------------------------------------------------------
// Store (localStorage-backed, falls back to in-memory)
// ---------------------------------------------------------------------------
const KEY = 'abt-demo-store-v2'
const hasLS = typeof localStorage !== 'undefined'

function seed() {
  const now = '2026-01-15T08:00:00Z'
  return {
    hotels: [
      {
        id: 'hotel-1',
        name: 'Blue Horizon Hotel',
        address: '123 Coastal Rd, Cebu City',
        currency: 'PHP',
        owner_user_id: 'user-owner',
        settings: {},
        created_at: now,
        updated_at: now,
      },
      {
        id: 'hotel-2',
        name: 'Sunset Inn',
        address: '45 Baywalk, Mactan',
        currency: 'PHP',
        owner_user_id: null,
        settings: {},
        created_at: now,
        updated_at: now,
      },
    ],
    profiles: [
      { id: 'user-instructor', role: 'platform_admin', hotel_id: null, display_name: 'Prof. Instructor', email: 'instructor@abt.demo', created_at: now },
      { id: 'user-owner', role: 'owner', hotel_id: 'hotel-1', display_name: 'Owner Student', email: 'owner@abt.demo', created_at: now },
      { id: 'user-frontdesk', role: 'front_desk', hotel_id: 'hotel-1', display_name: 'Front Desk Staff', email: 'frontdesk@abt.demo', created_at: now },
      { id: 'user-kitchen', role: 'kitchen', hotel_id: 'hotel-1', display_name: 'Kitchen Staff', email: 'kitchen@abt.demo', created_at: now },
      { id: 'user-cashier', role: 'cashier', hotel_id: 'hotel-1', display_name: 'Cashier Staff', email: 'cashier@abt.demo', created_at: now },
    ],
    room_types: [
      { id: 'rt-1', hotel_id: 'hotel-1', name: 'Standard', description: 'Cozy room with a single bed', capacity: 1, base_rate: 1500, created_at: now },
      { id: 'rt-2', hotel_id: 'hotel-1', name: 'Deluxe', description: 'Queen bed with city view', capacity: 2, base_rate: 2500, created_at: now },
      { id: 'rt-3', hotel_id: 'hotel-1', name: 'Family', description: 'Two beds for the family', capacity: 4, base_rate: 4000, created_at: now },
    ],
    rooms: [
      { id: 'room-101', hotel_id: 'hotel-1', room_type_id: 'rt-1', room_number: '101', floor: '1', rate: 1500, status: 'occupied', notes: '', created_at: now },
      { id: 'room-102', hotel_id: 'hotel-1', room_type_id: 'rt-1', room_number: '102', floor: '1', rate: 1500, status: 'available', notes: '', created_at: now },
      { id: 'room-201', hotel_id: 'hotel-1', room_type_id: 'rt-2', room_number: '201', floor: '2', rate: 2500, status: 'available', notes: '', created_at: now },
      { id: 'room-202', hotel_id: 'hotel-1', room_type_id: 'rt-2', room_number: '202', floor: '2', rate: 2500, status: 'available', notes: '', created_at: now },
      { id: 'room-301', hotel_id: 'hotel-1', room_type_id: 'rt-3', room_number: '301', floor: '3', rate: 4000, status: 'available', notes: '', created_at: now },
      { id: 'room-302', hotel_id: 'hotel-1', room_type_id: 'rt-3', room_number: '302', floor: '3', rate: 4000, status: 'maintenance', notes: '', created_at: now },
    ],
    menu_categories: [
      { id: 'cat-1', hotel_id: 'hotel-1', name: 'Breakfast', sort_order: 1, created_at: now },
      { id: 'cat-2', hotel_id: 'hotel-1', name: 'Mains', sort_order: 2, created_at: now },
      { id: 'cat-3', hotel_id: 'hotel-1', name: 'Drinks', sort_order: 3, created_at: now },
    ],
    menu_items: [
      { id: 'mi-1', hotel_id: 'hotel-1', category_id: 'cat-1', name: 'Filipino Breakfast', description: '', price: 180, available: true, created_at: now },
      { id: 'mi-2', hotel_id: 'hotel-1', category_id: 'cat-1', name: 'Pancakes & Syrup', description: '', price: 160, available: true, created_at: now },
      { id: 'mi-3', hotel_id: 'hotel-1', category_id: 'cat-2', name: 'Chicken Adobo', description: '', price: 220, available: true, created_at: now },
      { id: 'mi-4', hotel_id: 'hotel-1', category_id: 'cat-2', name: 'Sinigang na Baboy', description: '', price: 200, available: true, created_at: now },
      { id: 'mi-5', hotel_id: 'hotel-1', category_id: 'cat-2', name: 'Beef Steak', description: '', price: 320, available: true, created_at: now },
      { id: 'mi-6', hotel_id: 'hotel-1', category_id: 'cat-3', name: 'Fresh Mango Shake', description: '', price: 120, available: true, created_at: now },
      { id: 'mi-7', hotel_id: 'hotel-1', category_id: 'cat-3', name: 'Iced Tea', description: '', price: 60, available: true, created_at: now },
      { id: 'mi-8', hotel_id: 'hotel-1', category_id: 'cat-3', name: 'Barako Coffee', description: '', price: 90, available: true, created_at: now },
    ],
    dining_tables: [
      { id: 'tb-1', hotel_id: 'hotel-1', table_number: 'T1', capacity: 2, status: 'available', created_at: now },
      { id: 'tb-2', hotel_id: 'hotel-1', table_number: 'T2', capacity: 2, status: 'available', created_at: now },
      { id: 'tb-3', hotel_id: 'hotel-1', table_number: 'T3', capacity: 4, status: 'occupied', created_at: now },
      { id: 'tb-4', hotel_id: 'hotel-1', table_number: 'T4', capacity: 4, status: 'available', created_at: now },
      { id: 'tb-5', hotel_id: 'hotel-1', table_number: 'T5', capacity: 6, status: 'available', created_at: now },
    ],
    guests: [
      { id: 'guest-1', hotel_id: 'hotel-1', first_name: 'Maria', last_name: 'Santos', email: 'maria@example.com', phone: '0917 123 4567', id_type: 'Passport', id_number: 'P1234567', notes: 'Returning guest', created_at: now },
      { id: 'guest-2', hotel_id: 'hotel-1', first_name: 'John', last_name: 'Reyes', email: 'john@example.com', phone: '0918 999 0000', id_type: '', id_number: '', notes: '', created_at: now },
    ],
    reservations: [
      { id: 'res-1', hotel_id: 'hotel-1', guest_id: 'guest-1', room_id: 'room-101', check_in: '2026-09-12', check_out: '2026-09-15', adults: 1, children: 0, status: 'checked_in', deposit: 500, notes: '', created_at: now },
      { id: 'res-2', hotel_id: 'hotel-1', guest_id: 'guest-2', room_id: 'room-201', check_in: '2026-09-18', check_out: '2026-09-21', adults: 2, children: 0, status: 'confirmed', deposit: 0, notes: '', created_at: now },
    ],
    stay_sessions: [
      { id: 'stay-1', hotel_id: 'hotel-1', reservation_id: 'res-1', guest_id: 'guest-1', room_id: 'room-101', check_in_at: '2026-09-12T12:00:00Z', check_out_at: null, status: 'open', created_at: now },
      { id: 'stay-2', hotel_id: 'hotel-1', reservation_id: 'res-2', guest_id: 'guest-2', room_id: 'room-201', check_in_at: '2026-09-05T12:00:00Z', check_out_at: '2026-09-07T12:00:00Z', status: 'closed', created_at: now },
    ],
    orders: [
      { id: 'ord-1', hotel_id: 'hotel-1', table_id: 'tb-3', stay_session_id: 'stay-1', guest_id: 'guest-1', order_type: 'dine_in', status: 'served', subtotal: 400, tax: 48, total: 448, created_at: now },
      { id: 'ord-2', hotel_id: 'hotel-1', table_id: 'tb-1', stay_session_id: null, guest_id: null, order_type: 'takeaway', status: 'sent', subtotal: 90, tax: 10.8, total: 100.8, created_at: now },
    ],
    order_items: [
      { id: 'oi-1', hotel_id: 'hotel-1', order_id: 'ord-1', menu_item_id: 'mi-3', item_name: 'Chicken Adobo', quantity: 1, unit_price: 220, line_total: 220, created_at: now },
      { id: 'oi-2', hotel_id: 'hotel-1', order_id: 'ord-1', menu_item_id: 'mi-6', item_name: 'Fresh Mango Shake', quantity: 1, unit_price: 120, line_total: 120, created_at: now },
      { id: 'oi-3', hotel_id: 'hotel-1', order_id: 'ord-2', menu_item_id: 'mi-7', item_name: 'Iced Tea', quantity: 1, unit_price: 60, line_total: 60, created_at: now },
    ],
    folio_charges: [
      { id: 'fc-1', hotel_id: 'hotel-1', stay_session_id: 'stay-2', source: 'manual', description: 'Minibar', amount: 350, created_at: now },
    ],
    invoices: [
      { id: 'inv-1', hotel_id: 'hotel-1', stay_session_id: 'stay-2', invoice_number: 'INV-20260907-0001', subtotal: 5350, tax: 642, discount: 0, total: 5992, amount_paid: 5992, status: 'paid', created_at: now },
    ],
    payments: [
      { id: 'pay-1', hotel_id: 'hotel-1', invoice_id: 'inv-1', amount: 5992, method: 'cash', reference: null, created_at: now },
    ],
  }
}

let store = null
function getStore() {
  if (store) return store
  if (hasLS) {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        store = JSON.parse(raw)
        return store
      }
    } catch {
      /* ignore */
    }
  }
  store = seed()
  persist()
  return store
}
function persist() {
  if (hasLS) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store))
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Embedded relation helpers
// ---------------------------------------------------------------------------
const FK_MAP = {
  rooms: 'room_id',
  guests: 'guest_id',
  reservations: 'reservation_id',
  dining_tables: 'table_id',
  hotels: 'hotel_id',
  stay_sessions: 'stay_session_id',
  room_types: 'room_type_id',
  menu_categories: 'category_id',
  menu_items: 'menu_item_id',
  invoices: 'invoice_id',
}

function parseSelect(str) {
  const root = []
  const stack = [root]
  let buf = ''
  const flush = () => {
    const t = buf.trim()
    buf = ''
    if (t) stack[stack.length - 1].push({ name: t, children: null })
  }
  for (const ch of str || '') {
    if (ch === '(') {
      const name = buf.trim()
      buf = ''
      const children = []
      stack[stack.length - 1].push({ name, children })
      stack.push(children)
    } else if (ch === ')') {
      flush()
      stack.pop()
    } else if (ch === ',') {
      flush()
    } else {
      buf += ch
    }
  }
  flush()
  return root
}

function project(row, spec) {
  const out = {}
  for (const tok of spec) {
    if (tok.name === '*') {
      Object.assign(out, row)
    } else if (tok.children) {
      out[tok.name] = embed(row, tok.name, tok.children)
    } else {
      out[tok.name] = row[tok.name]
    }
  }
  return out
}

function embed(row, table, children) {
  const data = getStore()
  if (table === 'order_items') {
    return (data.order_items || []).filter((r) => r.order_id === row.id).map((r) => project(r, children))
  }
  const fk = FK_MAP[table]
  if (!fk) return null
  const id = row[fk]
  if (!id) return null
  const found = (data[table] || []).find((r) => r.id === id)
  return found ? project(found, children) : null
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function match(row, filters) {
  return filters.every(([op, col, val, operand]) => {
    const v = row[col]
    if (op === 'eq') return v === val
    if (op === 'neq') return v !== val
    if (op === 'in') return Array.isArray(val) && val.includes(v)
    if (op === 'not') {
      if (val === 'eq') return v !== operand
      return true
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Query builder (a small Supabase `.from()` stand-in)
// ---------------------------------------------------------------------------
function from(table) {
  let cols = null
  let selectCalled = false
  let countMode = false
  const filters = []
  let order = null
  let op = null
  let insertRows = null
  let updatePayload = null
  let singleMode = false
  let maybeSingle = false

  const builder = {
    select(c, o) {
      selectCalled = true
      cols = c
      if (o?.head) countMode = true
      return builder
    },
    eq(c, v) {
      filters.push(['eq', c, v])
      return builder
    },
    neq(c, v) {
      filters.push(['neq', c, v])
      return builder
    },
    in(c, arr) {
      filters.push(['in', c, arr])
      return builder
    },
    not(c, opc, v) {
      filters.push(['not', c, opc, v])
      return builder
    },
    order(c, o) {
      order = { col: c, asc: o?.ascending !== false }
      return builder
    },
    insert(rows) {
      op = 'insert'
      insertRows = Array.isArray(rows) ? rows : [rows]
      return builder
    },
    update(p) {
      op = 'update'
      updatePayload = p
      return builder
    },
    delete() {
      op = 'delete'
      return builder
    },
    single() {
      singleMode = true
      return builder
    },
    maybeSingle() {
      maybeSingle = true
      return builder
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => execute()).then(resolve, reject)
    },
  }

  function execute() {
    const data = getStore()
    if (!data[table]) data[table] = []

    if (op === 'insert') {
      const inserted = insertRows.map((r) => {
        const row = { created_at: new Date().toISOString(), ...r }
        if (row.id == null) row.id = uuid()
        data[table].push(row)
        return row
      })
      persist()
      if (!selectCalled) return { data: null, error: null, count: null }
      const projected = inserted.map((r) => project(r, parseSelect(cols || '*')))
      return {
        data: singleMode ? projected[0] : maybeSingle ? projected[0] || null : projected,
        error: null,
        count: null,
      }
    }

    if (op === 'update') {
      const matched = data[table].filter((r) => match(r, filters))
      for (const r of matched) Object.assign(r, updatePayload)
      persist()
      if (!selectCalled) return { data: null, error: null, count: null }
      const projected = matched.map((r) => project(r, parseSelect(cols || '*')))
      return {
        data: singleMode ? projected[0] : maybeSingle ? projected[0] || null : projected,
        error: null,
        count: null,
      }
    }

    if (op === 'delete') {
      data[table] = data[table].filter((r) => !match(r, filters))
      persist()
      return { data: null, error: null, count: null }
    }

    let arr = data[table].filter((r) => match(r, filters))
    if (order) {
      arr = [...arr].sort((a, b) => {
        const av = a[order.col]
        const bv = b[order.col]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return order.asc ? cmp : -cmp
      })
    }
    if (countMode) return { count: arr.length, data: null, error: null }

    const spec = parseSelect(cols || '*')
    const projected = arr.map((r) => project(r, spec))
    return {
      data: singleMode ? projected[0] : maybeSingle ? projected[0] || null : projected,
      error: null,
      count: null,
    }
  }

  return builder
}

// ---------------------------------------------------------------------------
// Demo auth
// ---------------------------------------------------------------------------
let session = null

function buildUser(profile) {
  return {
    id: profile.id,
    email: profile.email,
    app_metadata: { role: profile.role, hotel_id: profile.hotel_id },
    user_metadata: { full_name: profile.display_name },
  }
}

export function signIn(email, password) {
  const account = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  )
  if (!account || account.password !== password) {
    return { error: { message: 'Invalid email or password' } }
  }
  const profile = getStore().profiles.find((p) => p.id === account.profileId)
  if (!profile || profile.role === 'disabled') return { error: { message:'Account is disabled' } }
  const user = buildUser(profile)
  session = { user, access_token: 'demo-access-token', refresh_token: 'demo-refresh' }
  return { data: { session } }
}

const auth = {
  getSession() {
    return { data: { session }, error: null }
  },
  getUser() {
    return { data: { user: session?.user || null }, error: null }
  },
  signOut() {
    session = null
    return Promise.resolve({ error: null })
  },
  admin: {
    updateUserById: async () => ({ data: { user: null }, error: null }),
    banUser: async () => ({ data: null, error: null }),
    unbanUser: async () => ({ data: null, error: null }),
  },
}

// ---------------------------------------------------------------------------
// Mock admin API (used by api.js in demo mode)
// ---------------------------------------------------------------------------
const countBy = (rows, key) => {
  const m = {}
  for (const r of rows || []) m[r[key]] = (m[r[key]] || 0) + 1
  return m
}

const DAY_MS = 24 * 60 * 60 * 1000

function demoPerformance(data, days, hotelId = null) {
  const since = days === 'all' ? null : Date.now() - Number(days) * DAY_MS
  const inWindow = (iso) => !since || new Date(iso).getTime() >= since
  const num = (v) => Number(v || 0)

  const perf = new Map()
  for (const h of data.hotels) {
    if (hotelId && h.id !== hotelId) continue
    const owner = data.profiles.find((p) => p.id === h.owner_user_id)
    perf.set(h.id, {
      hotel_id: h.id,
      hotel_name: h.name,
      owner_email: owner?.email || null,
      room_count: 0,
      guest_count: 0,
      reservation_count: 0,
      revenue: 0,
      rooms: { total: 0, occupied: 0, available: 0, maintenance: 0, occupancy_pct: 0 },
      reservations: { total: 0, pending: 0, confirmed: 0, checked_in: 0, checked_out: 0, cancelled: 0 },
      stays: { open: 0, closed: 0 },
      restaurant: { orders: 0, sales: 0, avg_order: 0 },
      billing: { invoiced: 0, collected: 0, outstanding: 0, collection_pct: 0, by_method: {} },
      activity: { actions: 0, last_activity: null },
    })
  }

  for (const r of data.rooms) {
    const p = perf.get(r.hotel_id)
    if (!p) continue
    p.rooms.total++
    if (r.status === 'occupied') p.rooms.occupied++
    else if (r.status === 'maintenance') p.rooms.maintenance++
    else p.rooms.available++
  }
  for (const p of perf.values()) {
    p.rooms.occupancy_pct = p.rooms.total ? Math.round((p.rooms.occupied / p.rooms.total) * 100) : 0
    p.room_count = p.rooms.total
  }

  for (const g of data.guests) {
    const p = perf.get(g.hotel_id)
    if (p) p.guest_count++
  }

  for (const r of data.reservations) {
    const p = perf.get(r.hotel_id)
    if (!p) continue
    if (inWindow(r.created_at)) {
      p.reservations.total++
      if (r.status in p.reservations) p.reservations[r.status]++
      p.reservation_count = p.reservations.total
    }
    if (!p.activity.last_activity || r.created_at > p.activity.last_activity) {
      p.activity.last_activity = r.created_at
    }
  }

  for (const s of data.stay_sessions || []) {
    const p = perf.get(s.hotel_id)
    if (!p || !inWindow(s.created_at)) continue
    if (s.status === 'open') p.stays.open++
    else p.stays.closed++
  }

  for (const o of data.orders) {
    const p = perf.get(o.hotel_id)
    if (!p) continue
    if (!p.activity.last_activity || o.created_at > p.activity.last_activity) {
      p.activity.last_activity = o.created_at
    }
    if (o.status === 'cancelled' || !inWindow(o.created_at)) continue
    p.restaurant.orders++
    p.restaurant.sales += num(o.total)
  }
  for (const p of perf.values()) {
    p.restaurant.avg_order = p.restaurant.orders ? Math.round(p.restaurant.sales / p.restaurant.orders) : 0
  }

  for (const i of data.invoices) {
    const p = perf.get(i.hotel_id)
    if (!p) continue
    if (!p.activity.last_activity || i.created_at > p.activity.last_activity) {
      p.activity.last_activity = i.created_at
    }
    if (i.status === 'void' || !inWindow(i.created_at)) continue
    p.billing.invoiced += num(i.total)
    p.revenue = p.billing.invoiced
  }

  for (const pay of data.payments) {
    const p = perf.get(pay.hotel_id)
    if (!p) continue
    if (!p.activity.last_activity || pay.created_at > p.activity.last_activity) {
      p.activity.last_activity = pay.created_at
    }
    if (!inWindow(pay.created_at)) continue
    p.billing.collected += num(pay.amount)
    p.billing.by_method[pay.method] = (p.billing.by_method[pay.method] || 0) + num(pay.amount)
  }
  for (const p of perf.values()) {
    p.billing.outstanding = Math.max(0, p.billing.invoiced - p.billing.collected)
    p.billing.collection_pct = p.billing.invoiced ? Math.round((p.billing.collected / p.billing.invoiced) * 100) : 0
  }

  for (const f of data.folio_charges || []) {
    const p = perf.get(f.hotel_id)
    if (!p) continue
    if (!p.activity.last_activity || f.created_at > p.activity.last_activity) {
      p.activity.last_activity = f.created_at
    }
  }

  for (const p of perf.values()) {
    p.activity.actions = [
      ...(data.reservations || []),
      ...(data.stay_sessions || []),
      ...(data.orders || []),
      ...(data.invoices || []),
      ...(data.payments || []),
      ...(data.folio_charges || []),
    ].filter((r) => r.hotel_id === p.hotel_id && inWindow(r.created_at)).length
  }

  return perf
}

function demoActivitySeries(data, hotelId, length = 14) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = new Map()
  for (let i = length - 1; i >= 0; i--) {
    buckets.set(new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10), 0)
  }
  const actionRows = [
    ...(data.reservations || []),
    ...(data.stay_sessions || []),
    ...(data.orders || []),
    ...(data.invoices || []),
    ...(data.payments || []),
    ...(data.folio_charges || []),
  ].filter((r) => r.hotel_id === hotelId)
  for (const r of actionRows) {
    const key = (r.created_at || '').slice(0, 10)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }))
}

export async function demoInsights(hotelId, days) {
  const data = getStore()
  const hotel = data.hotels.find(h => h.id === hotelId)
  if (!hotel) throw new Error('Hotel not found')
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days + 1)
  const tomorrow = new Date(end)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const rows = table => (data[table] || []).filter(row => row.hotel_id === hotelId)
  const period = table => rows(table).filter(row => new Date(row.created_at) >= start && new Date(row.created_at) < tomorrow)
  const sum = (items, field) => items.reduce((total, row) => total + Number(row[field] || 0), 0)
  const metrics = {
    currency: hotel.currency || 'PHP', days,
    period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10),
    rooms_total: rows('rooms').length, rooms_occupied: rows('rooms').filter(r => r.status === 'occupied').length,
    rooms_maintenance: rows('rooms').filter(r => r.status === 'maintenance').length,
    reservations_created: period('reservations').length,
    restaurant_sales: sum(period('orders').filter(r => r.status !== 'cancelled'), 'total'),
    invoiced: sum(period('invoices').filter(r => r.status !== 'void'), 'total'),
    collected: sum(period('payments'), 'amount'),
    outstanding: rows('invoices').filter(r => r.status !== 'void').reduce((total, row) => total + Math.max(0, Number(row.total) - Number(row.amount_paid || 0)), 0),
  }
  return { demo: true, cached: false, generatedAt: new Date().toISOString(), metrics, insight: {
    summary: `Your workspace has ${metrics.rooms_occupied} occupied rooms out of ${metrics.rooms_total}. ${metrics.reservations_created} reservations were created during the selected period. Use these figures as a starting point for reviewing your hotel's operations.`,
    observations: [`${metrics.rooms_maintenance} rooms are currently marked for maintenance.`, metrics.outstanding > 0 ? 'There are outstanding invoice balances to review.' : 'There are no outstanding invoice balances recorded.', 'This snapshot does not establish a trend or explain the causes of performance.'],
    actions: ['Review upcoming arrivals and confirm room readiness at the front desk.', 'Reconcile guest folios and payments before completing checkout.', 'Discuss the selected period with your instructor and compare it with your operational records.'],
  } }
}

export async function demoAdminApi(path, { method = 'GET', body } = {}) {
  const data = getStore()
  const matchPath = (pattern) => {
    const parts = pattern.split('/')
    const given = path.split('/')
    if (parts.length !== given.length) return null
    const params = {}
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = given[i]
      else if (parts[i] !== given[i]) return null
    }
    return params
  }

  if (path === '/admin/stats' && method === 'GET') {
    const invoices = data.invoices.filter((i) => i.status !== 'void')
    return {
      stats: {
        hotels: data.hotels.length,
        users: data.profiles.length,
        rooms: data.rooms.length,
        guests: data.guests.length,
        reservations: data.reservations.length,
        revenue: invoices.reduce((s, i) => s + Number(i.total || 0), 0),
      },
    }
  }

  if (path === '/admin/hotels' && method === 'GET') {
    const ownerEmail = new Map(data.profiles.map((p) => [p.id, p.email || p.display_name]))
    const perf = demoPerformance(data, 'all')
    const hotels = data.hotels.map((h) => {
      const p = perf.get(h.id) || {}
      return {
        ...h,
        ...p,
        hotel_name: h.name,
        owner_email: ownerEmail.get(h.owner_user_id) || null,
        room_count: p.rooms?.total || 0,
        guest_count: (data.guests.filter((g) => g.hotel_id === h.id)).length,
        reservation_count: p.reservations?.total || 0,
        revenue: p.billing?.invoiced || 0,
      }
    })
    return { hotels }
  }

  if (path.split('?')[0] === '/admin/performance' && method === 'GET') {
    const days = new URLSearchParams(path.split('?')[1] || '').get('days') || 'all'
    const perf = demoPerformance(data, days)
    return { performance: [...perf.values()] }
  }

  const perfDetail = path.match(/^\/admin\/hotels\/([^/?]+)\/performance/)
  if (perfDetail && method === 'GET') {
    const days = new URLSearchParams(path.split('?')[1] || '').get('days') || 'all'
    const perf = demoPerformance(data, days, perfDetail[1])
    if (!perf.has(perfDetail[1])) return { error: 'Hotel not found' }
    return { performance: perf.get(perfDetail[1]), series: demoActivitySeries(data, perfDetail[1]) }
  }

  if (path === '/admin/users' && method === 'GET') {
    return { users: data.profiles.map((p) => ({ ...p, hotels: data.hotels.find((h) => h.id === p.hotel_id)?.name })) }
  }

  const assignParams = matchPath('/admin/users/:id/assign')
  if (assignParams && method === 'POST') {
    const p = data.profiles.find((x) => x.id === assignParams.id)
    if (p) {
      p.hotel_id = body.hotelId || null
      p.role = body.role
    }
    persist()
    return { profile: p }
  }

  const disableParams = matchPath('/admin/users/:id/disable')
  if (disableParams && method === 'POST') {
    const p = data.profiles.find((x) => x.id === disableParams.id)
    if (p) {
      p.role = 'disabled'
      p.hotel_id = null
    }
    persist()
    return { ok: true, disabled: true }
  }

  const enableParams = matchPath('/admin/users/:id/enable')
  if (enableParams && method === 'POST') {
    const p = data.profiles.find((x) => x.id === enableParams.id)
    if (p) p.role = 'owner'
    persist()
    return { ok: true, enabled: true }
  }

  if (path === '/admin/hotels' && method === 'POST') {
    const hotel = {
      id: uuid(),
      name: body.name,
      address: '',
      currency: body.currency || 'PHP',
      owner_user_id: body.ownerUserId || null,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    data.hotels.push(hotel)
    if (body.ownerUserId) {
      const p = data.profiles.find((x) => x.id === body.ownerUserId)
      if (p) {
        p.hotel_id = hotel.id
        p.role = 'owner'
      }
    }
    persist()
    return { hotel }
  }

  const nameParams = matchPath('/admin/hotels/:id/name')
  if (nameParams && method === 'POST') {
    const h = data.hotels.find((x) => x.id === nameParams.id)
    if (h) h.name = body.name
    persist()
    return { hotel: h }
  }

  throw new Error('Unknown demo API path: ' + path)
}

export async function demoOperation(name, args) {
  const data = getStore()
  const before = JSON.stringify(data)
  const requireRole = (hotelId, roles) => {
    const profile = data.profiles.find(p => p.id === session?.user.id)
    if (!profile || (profile.role !== 'platform_admin' && (profile.hotel_id !== hotelId || !roles.includes(profile.role)))) throw new Error('Not authorized')
  }
  const money = value => Math.round(Number(value) * 100) / 100
  try {
    let result = null
    if (name === 'change_stay') {
      const r = data.reservations.find(r => r.id === args.p_reservation)
      if (!r) throw new Error('Reservation not found')
      requireRole(r.hotel_id, ['owner','front_desk'])
      const room = data.rooms.find(room => room.id === r.room_id && room.hotel_id === r.hotel_id)
      if (!room) throw new Error('Room not found')
      if (args.p_action === 'check_in') {
        if (!['pending','confirmed'].includes(r.status) || room.status !== 'available' || data.stay_sessions.some(s => s.room_id === room.id && s.status === 'open')) throw new Error('Room or reservation is not available for check-in')
        data.stay_sessions.push({ id: uuid(), hotel_id:r.hotel_id, reservation_id:r.id, guest_id:r.guest_id, room_id:room.id, check_in_at:new Date().toISOString(), status:'open' })
        room.status='occupied'; r.status='checked_in'
      } else if (args.p_action === 'check_out') {
        const stay = data.stay_sessions.find(s => s.reservation_id === r.id && s.status === 'open')
        if (r.status !== 'checked_in' || !stay) throw new Error('No active stay')
        stay.status='closed'; stay.check_out_at=new Date().toISOString()
        room.status='available'; r.status='checked_out'
      } else throw new Error('Unknown stay action')
    } else if (name === 'issue_invoice') {
      const s = data.stay_sessions.find(s => s.id === args.p_stay)
      if (!s) throw new Error('Stay not found')
      requireRole(s.hotel_id,['owner','cashier'])
      result = data.invoices.find(i => i.stay_session_id === s.id && i.status !== 'void')
      if (!result) {
        const r = data.reservations.find(r => r.id === s.reservation_id)
        const room = data.rooms.find(r => r.id === s.room_id)
        const type = data.room_types.find(t => t.id === room?.room_type_id)
        const nights = Math.max(1,Math.ceil((new Date(r?.check_out || s.check_out_at || Date.now())-new Date(r?.check_in || s.check_in_at))/86400000))
        const linked = data.orders.filter(o => o.stay_session_id === s.id && o.status !== 'cancelled')
        const manual = data.folio_charges.filter(c => c.stay_session_id === s.id && c.source === 'manual')
        const roomAmount = money(nights * Number(room?.rate ?? type?.base_rate ?? 0))
        const lines = [{description:`Room (${nights} nights)`,source:'room',amount:roomAmount}, ...linked.map(o => ({description:`Restaurant order ${o.id}`,source:'restaurant',amount:Number(o.subtotal)})), ...manual.map(c => ({description:c.description,source:'manual',amount:Number(c.amount)}))]
        const subtotal = money(lines.reduce((sum,l) => sum+l.amount,0))
        const tax = money((roomAmount+manual.reduce((sum,c)=>sum+Number(c.amount),0))*0.12+linked.reduce((sum,o)=>sum+Number(o.tax),0))
        result = {id:uuid(),hotel_id:s.hotel_id,stay_session_id:s.id,invoice_number:`INV-${uuid()}`,created_at:new Date().toISOString(),line_items:lines,subtotal,tax,discount:0,total:money(subtotal+tax),amount_paid:0,status:'unpaid'}
        data.invoices.push(result)
      }
    } else {
      const inv = data.invoices.find(i => i.id === args.p_invoice)
      if (!inv) throw new Error('Invoice not found')
      requireRole(inv.hotel_id,['owner','cashier'])
      if (name === 'record_payment') {
        const amount = Number(args.p_amount)
        if (!Number.isFinite(amount) || amount<=0 || money(amount)!==amount || amount>money(inv.total-inv.amount_paid) || ['void','paid'].includes(inv.status) || !['cash','card','gcash'].includes(args.p_method)) throw new Error('Invalid payment or amount exceeds balance')
        data.payments.push({id:uuid(),hotel_id:inv.hotel_id,invoice_id:inv.id,amount,method:args.p_method,reference:args.p_reference,created_at:new Date().toISOString()})
        inv.amount_paid=money(inv.amount_paid+amount)
        inv.status=inv.amount_paid===inv.total?'paid':'partially_paid'
      } else if (name === 'void_invoice') {
        if (inv.amount_paid>0) throw new Error('Paid invoices require a refund workflow')
        inv.status='void'
      } else throw new Error('Unknown operation')
    }
    persist()
    return {data:result,error:null}
  } catch (error) {
    store=JSON.parse(before)
    return {data:null,error}
  }
}

export const demoClient = { from, auth, signIn }
