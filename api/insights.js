import { Router } from 'express'
import { adminClient } from './_lib/supabase-admin.js'
import { authorizeInsights, generateInsight, insightKey } from './_lib/ai-insights.js'

export function createInsightsRouter({ client = adminClient, generate = generateInsight, config = () => ({ enabled: process.env.AI_ENABLED === '1', key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL }) } = {}) {
  const router = Router()
  router.post('/', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    let admin, cacheKey, requestId
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
      if (!token) return res.status(401).json({ error: 'Sign in to generate insights.' })
      admin = client()
      const { data: auth, error: authError } = await admin.auth.getUser(token)
      if (authError || !auth?.user) return res.status(401).json({ error: 'Your session expired. Sign in again.' })
      const { data: profile, error: profileError } = await admin.from('profiles').select('role, hotel_id').eq('id', auth.user.id).maybeSingle()
      if (profileError) throw profileError
      const hotelId = authorizeInsights(profile, req.body?.hotelId)
      if (!hotelId) return res.status(403).json({ error: 'Only hotel owners and instructors can request these insights for authorized hotels.' })
      const days = req.body?.days ?? 7
      if (![7, 30].includes(days) || typeof hotelId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hotelId)) return res.status(400).json({ error: 'Choose a valid hotel and a 7- or 30-day period.' })
      const settings = config()
      if (!settings.enabled || !settings.key || !settings.model) return res.status(503).json({ error: 'AI insights are not configured yet. Ask your instructor to enable a free-tier model.' })
      const { data: metrics, error: metricsError } = await admin.rpc('ai_hotel_snapshot', { p_hotel_id: hotelId, p_days: days })
      if (metricsError) throw metricsError
      if (!metrics) return res.status(404).json({ error: 'Hotel not found.' })
      cacheKey = insightKey(hotelId, metrics, settings.model)
      const { data: claim, error: claimError } = await admin.rpc('ai_claim_request', { p_user_id: auth.user.id, p_hotel_id: hotelId, p_cache_key: cacheKey })
      if (claimError) throw claimError
      if (claim?.status === 'cached') return res.json({ ...claim.response, cached: true })
      if (claim?.status !== 'claimed') {
        const daily = claim?.status === 'daily_limit'
        res.set('Retry-After', daily ? String(Math.ceil((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1) - Date.now()) / 1000)) : '90')
        return res.status(429).json({ error: daily ? 'The daily AI allowance has been used. It resets at midnight UTC.' : 'Another summary is being generated or the shared request limit was reached. Please wait 90 seconds.' })
      }
      requestId = claim.request_id
      const insight = await generate(metrics, settings)
      const result = { insight, metrics, generatedAt: new Date().toISOString(), model: settings.model, demo: false, cached: false }
      const { error: saveError } = await admin.from('ai_insight_cache').update({ response: result, expires_at: new Date(Date.now() + 15 * 60000).toISOString() }).eq('cache_key', cacheKey).eq('request_id', requestId)
      if (saveError) throw saveError
      return res.json(result)
    } catch (error) {
      if (admin && cacheKey && requestId) {
        try { await admin.from('ai_insight_cache').delete().eq('cache_key', cacheKey).eq('request_id', requestId) } catch {}
      }
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name)
      const status = timeout ? 504 : [429, 503].includes(error.status) ? error.status : 503
      return res.status(status).json({ error: timeout ? 'AI generation timed out. Please try again later.' : error.status ? error.message : 'AI insights are temporarily unavailable. Check the AI migration and provider setup.' })
    }
  })
  return router
}

export default createInsightsRouter()
