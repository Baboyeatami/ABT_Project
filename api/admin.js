import { Router } from 'express'
import { adminClient } from './_lib/supabase-admin.js'

const router = Router()

// Verify the caller is a signed-in platform_admin (instructor).
async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const admin = adminClient()
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' })
    }

    req.user = data.user
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ---- Per-hotel performance metrics (instructor monitoring) ----
const DAY_MS = 24 * 60 * 60 * 1000

async function fetchPerformanceData(admin) {
  const [rooms, guests, reservations, stays, orders, invoices, payments, folios, hotels, profiles] =
    await Promise.all([
      admin.from('rooms').select('hotel_id, status'),
      admin.from('guests').select('hotel_id, created_at'),
      admin.from('reservations').select('hotel_id, status, created_at'),
      admin.from('stay_sessions').select('hotel_id, status, created_at'),
      admin.from('orders').select('hotel_id, status, total, created_at'),
      admin.from('invoices').select('hotel_id, status, total, created_at'),
      admin.from('payments').select('hotel_id, amount, method, created_at'),
      admin.from('folio_charges').select('hotel_id, created_at'),
      admin.from('hotels').select('id, name, owner_user_id'),
      admin.from('profiles').select('id, email, display_name'),
    ])
  for (const r of [rooms, guests, reservations, stays, orders, invoices, payments, folios, hotels, profiles]) {
    if (r.error) throw r.error
  }
  return {
    rooms: rooms.data || [],
    guests: guests.data || [],
    reservations: reservations.data || [],
    stays: stays.data || [],
    orders: orders.data || [],
    invoices: invoices.data || [],
    payments: payments.data || [],
    folios: folios.data || [],
    hotels: hotels.data || [],
    profiles: profiles.data || [],
  }
}

function computePerformance(data, days, hotelId = null) {
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
    if (!p) continue
    p.guest_count++
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

  for (const s of data.stays) {
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
    p.restaurant.avg_order = p.restaurant.orders
      ? Math.round(p.restaurant.sales / p.restaurant.orders)
      : 0
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
    p.billing.collection_pct = p.billing.invoiced
      ? Math.round((p.billing.collected / p.billing.invoiced) * 100)
      : 0
  }

  for (const f of data.folios) {
    const p = perf.get(f.hotel_id)
    if (!p) continue
    if (!p.activity.last_activity || f.created_at > p.activity.last_activity) {
      p.activity.last_activity = f.created_at
    }
  }

  for (const p of perf.values()) {
    p.activity.actions = [data.reservations, data.stays, data.orders, data.invoices, data.payments, data.folios]
      .flatMap((rows) => rows)
      .filter((r) => r.hotel_id === p.hotel_id && inWindow(r.created_at)).length
  }

  return perf
}

function buildActivitySeries(data, hotelId, length = 14) {
  const series = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = new Map()
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10)
    buckets.set(d, 0)
    series.push({ date: d, count: 0 })
  }
  const actionRows = [data.reservations, data.stays, data.orders, data.invoices, data.payments, data.folios]
    .flatMap((rows) => rows)
    .filter((r) => r.hotel_id === hotelId)
  for (const r of actionRows) {
    const key = (r.created_at || '').slice(0, 10)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
  }
  return series.map((s) => ({ ...s, count: buckets.get(s.date) }))
}

// ---- Aggregate stats across all hotels ----
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const [hotels, users, rooms, guests, reservations, invoices] = await Promise.all([
      admin.from('hotels').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('rooms').select('id', { count: 'exact', head: true }),
      admin.from('guests').select('id', { count: 'exact', head: true }),
      admin.from('reservations').select('id', { count: 'exact', head: true }),
      admin.from('invoices').select('total').not('status', 'eq', 'void'),
    ])

    for (const result of [hotels, users, rooms, guests, reservations, invoices]) if (result.error) throw result.error
    const revenue = invoices.data.reduce((sum, i) => sum + Number(i.total || 0), 0)

    res.json({
      stats: {
        hotels: hotels.count || 0,
        users: users.count || 0,
        rooms: rooms.count || 0,
        guests: guests.count || 0,
        reservations: reservations.count || 0,
        revenue,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- List all hotels with owner email + performance summary ----
router.get('/hotels', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const data = await fetchPerformanceData(admin)
    const perf = computePerformance(data, 'all')
    res.json({ hotels: [...perf.values()] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Compare performance across all hotels (optionally time-windowed) ----
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    const days = ['7', '30', 'all'].includes(String(req.query.days)) ? String(req.query.days) : 'all'
    const admin = adminClient()
    const data = await fetchPerformanceData(admin)
    res.json({ performance: [...computePerformance(data, days).values()] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Full performance dashboard for one hotel ----
router.get('/hotels/:id/performance', requireAdmin, async (req, res) => {
  try {
    const days = ['7', '30', 'all'].includes(String(req.query.days)) ? String(req.query.days) : 'all'
    const admin = adminClient()
    const data = await fetchPerformanceData(admin)
    const perf = computePerformance(data, days, req.params.id)
    if (!perf.has(req.params.id)) return res.status(404).json({ error: 'Hotel not found' })
    res.json({ performance: perf.get(req.params.id), series: buildActivitySeries(data, req.params.id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- List all students/profiles with their hotel ----
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, display_name, role, hotel_id, created_at, hotels(name)')
      .order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ users: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Assign a user to a hotel + role, update JWT app_metadata ----
router.post('/users/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { hotelId, role } = req.body
    if (!['owner','front_desk','kitchen','cashier','unassigned'].includes(role) || (role !== 'unassigned' && !hotelId) || id === req.user.id) return res.status(400).json({ error: 'Select a valid student role and hotel' })

    const admin = adminClient()

    const { error } = await admin.auth.admin.updateUserById(id, {
      app_metadata: { hotel_id: hotelId || null, role },
    })
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Disable / enable a user account ----
router.post('/users/:id/disable', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { id } = req.params
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot disable yourself' })
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
      app_metadata: { hotel_id: null, role: 'disabled' },
    })
    if (error) throw error
    res.json({ ok: true, disabled: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/enable', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { id } = req.params
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: 'none',
      app_metadata: { role: 'unassigned', hotel_id: null },
    })
    if (error) throw error
    res.json({ ok: true, enabled: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Create a new hotel (optionally assign an owner) ----
router.post('/hotels', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { name, ownerUserId, currency } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const { data: hotel, error } = await admin
      .from('hotels')
      .insert({ name, owner_user_id: ownerUserId || null, currency: currency || 'PHP' })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })

    if (ownerUserId) {
      await admin
        .from('profiles')
        .update({ hotel_id: hotel.id, role: 'owner' })
        .eq('id', ownerUserId)
      await admin.auth.admin.updateUserById(ownerUserId, {
        app_metadata: { hotel_id: hotel.id, role: 'owner' },
      })
    }

    res.json({ hotel })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Rename a hotel ----
router.post('/hotels/:id/name', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { id } = req.params
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const { data, error } = await admin
      .from('hotels')
      .update({ name })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json({ hotel: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
