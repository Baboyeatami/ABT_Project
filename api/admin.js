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

// ---- List all hotels with owner email + counts ----
router.get('/hotels', requireAdmin, async (req, res) => {
  try {
    const admin = adminClient()
    const { data: hotels, error } = await admin
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, display_name')
    const ownerEmail = new Map(
      (profiles || []).map((p) => [p.id, p.email || p.display_name]),
    )

    const [rooms, guests, reservations, invoices] = await Promise.all([
      admin.from('rooms').select('hotel_id'),
      admin.from('guests').select('hotel_id'),
      admin.from('reservations').select('hotel_id'),
      admin.from('invoices').select('hotel_id, total').not('status', 'eq', 'void'),
    ])

    const countBy = (rows, key) => {
      const map = {}
      for (const r of rows || []) map[r[key]] = (map[r[key]] || 0) + 1
      return map
    }
    const revenueBy = {}
    for (const r of invoices.data || []) {
      revenueBy[r.hotel_id] = (revenueBy[r.hotel_id] || 0) + Number(r.total || 0)
    }
    const roomsBy = countBy(rooms.data, 'hotel_id')
    const guestsBy = countBy(guests.data, 'hotel_id')
    const resvBy = countBy(reservations.data, 'hotel_id')

    const enriched = hotels.map((h) => ({
      ...h,
      owner_email: ownerEmail.get(h.owner_user_id) || null,
      room_count: roomsBy[h.id] || 0,
      guest_count: guestsBy[h.id] || 0,
      reservation_count: resvBy[h.id] || 0,
      revenue: revenueBy[h.id] || 0,
    }))

    res.json({ hotels: enriched })
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
