import { Router } from 'express'
import { adminClient } from './_lib/supabase-admin.js'
import { logAction } from './_lib/audit.js'

const router = Router()

// Reuse the same admin verification as /api/admin.
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
      .select('role, hotel_id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' })
    }

    req.user = data.user
    req.admin = admin
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ---- List activity logs (admin only; RLS also enforces hotel isolation) ----
router.get('/', requireAdmin, async (req, res) => {
  try {
    const admin = req.admin
    const {
      hotel_id, user_id, action, entity_type, from, to, limit: lim, offset,
    } = req.query

    let query = admin
      .from('activity_logs')
      .select('*, profiles(email), hotels(name)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (hotel_id) query = query.eq('hotel_id', hotel_id)
    if (user_id) query = query.eq('user_id', user_id)
    if (action) query = query.eq('action', action)
    if (entity_type) query = query.eq('entity_type', entity_type)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const page = Number(lim) || 50
    const pageOffset = Number(offset) || 0
    query = query.range(pageOffset, pageOffset + page - 1)

    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })

    const logs = (data || []).map((l) => ({
      ...l,
      user_email: l.profiles?.email || null,
      hotel_name: l.hotels?.name || null,
    }))
    res.json({ logs, total: count || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Logs for one hotel ----
router.get('/hotels/:id', requireAdmin, async (req, res) => {
  try {
    const admin = req.admin
    const { id } = req.params
    const { limit: lim, offset } = req.query

    let query = admin
      .from('activity_logs')
      .select('*, profiles(email), hotels(name)', { count: 'exact' })
      .eq('hotel_id', id)
      .order('created_at', { ascending: false })

    const page = Number(lim) || 50
    const pageOffset = Number(offset) || 0
    query = query.range(pageOffset, pageOffset + page - 1)

    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })

    const logs = (data || []).map((l) => ({
      ...l,
      user_email: l.profiles?.email || null,
      hotel_name: l.hotels?.name || null,
    }))
    res.json({ logs, total: count || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Internal write endpoint: other routers call this to record an action ----
router.post('/', requireAdmin, async (req, res) => {
  try {
    const admin = req.admin
    const { hotelId, userId, action, entityType, entityId, before, after } = req.body
    if (!action || !entityType) {
      return res.status(400).json({ error: 'action and entityType are required' })
    }

    const { data, error } = await logAction(admin, {
      hotelId,
      userId: userId || req.user.id,
      action,
      entityType,
      entityId,
      before,
      after,
      req,
    })
    if (error) return res.status(400).json({ error: error.message })

    res.json({ ok: true, log: data?.[0] || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
