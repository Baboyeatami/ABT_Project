import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createInsightsRouter } from './_lib/insights-router.js'
import { generateInsight, insightKey } from './_lib/ai-insights.js'

const hotelId = '11111111-1111-4111-8111-111111111111'
const otherHotel = '22222222-2222-4222-8222-222222222222'
const insight = { summary: 'Two rooms are occupied.', observations: ['There are four rooms.'], actions: ['Check arrivals.', 'Review folios.', 'Prepare rooms.'] }

test('AI route authenticates, isolates hotels, reuses cache, and stops at quota', async t => {
  let profile = { role: 'owner', hotel_id: hotelId }
  let claim = { status: 'claimed', request_id: 'request-1' }
  let calls = 0
  let configured = true
  let snapshotCalls = 0
  let metricsArgs
  const chain = { select() { return this }, eq() { return this }, update() { return this }, delete() { return this }, maybeSingle: async () => ({ data: profile }) }
  const client = { auth: { getUser: async token => token === 'valid' ? { data: { user: { id: 'owner-id' } } } : { error: true } }, from: () => chain, rpc: async (name, args) => {
    if (name === 'ai_hotel_snapshot') { snapshotCalls++; metricsArgs = args; return { data: { rooms_total: 4, rooms_occupied: 2 } } }
    return { data: claim }
  } }
  const app = express()
  app.use(express.json())
  app.use('/api/insights', createInsightsRouter({ client: () => client, generate: async () => { calls++; return insight }, config: () => ({ enabled: configured, key: 'test-key', model: 'test-model' }) }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const request = (body = { hotelId, days: 7 }, token = 'valid') => fetch(`http://127.0.0.1:${server.address().port}/api/insights`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  assert.equal((await request(undefined, '')).status, 401)
  assert.equal((await request(undefined, 'expired')).status, 401)
  assert.equal((await request({ hotelId: otherHotel, days: 7 })).status, 403)
  for (const role of ['disabled', 'front_desk', 'cashier', 'kitchen', 'unassigned']) {
    profile = { role, hotel_id: hotelId }
    assert.equal((await request()).status, 403)
  }
  assert.equal(snapshotCalls, 0)
  profile = { role: 'owner', hotel_id: hotelId }
  assert.equal((await request({ hotelId, days: '7' })).status, 400)
  configured = false
  assert.equal((await request()).status, 503)
  configured = true
  const fresh = await request()
  assert.equal(fresh.status, 200)
  assert.deepEqual((await fresh.json()).insight, insight)
  assert.equal(metricsArgs.p_hotel_id, hotelId)
  assert.equal(calls, 1)
  claim = { status: 'cached', response: { insight } }
  assert.equal((await (await request()).json()).cached, true)
  assert.equal(calls, 1)
  for (const status of ['busy', 'daily_limit', 'minute_limit']) {
    claim = { status }
    const limited = await request()
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('Retry-After')) > 0)
  }
  assert.equal(calls, 1)
  profile = { role: 'platform_admin' }
  claim = { status: 'claimed', request_id: 'request-2' }
  assert.equal((await request({ hotelId: otherHotel, days: 30 })).status, 200)
  assert.equal(metricsArgs.p_hotel_id, otherHotel)
})

test('model adapter bounds requests and rejects invalid, truncated, and quota responses', async () => {
  const config = { key: 'test-key', model: 'test-model' }
  const result = await generateInsight({ rooms_total: 4 }, config, async (url, init) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com')
    assert.ok(init.signal)
    assert.equal(init.headers['x-goog-api-key'], 'test-key')
    assert.equal(JSON.parse(init.body).generationConfig.maxOutputTokens, 1600)
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(insight) }] } }] })
  })
  assert.deepEqual(result, insight)
  await assert.rejects(generateInsight({}, config, async () => new Response('', { status: 429 })), { status: 429 })
  await assert.rejects(generateInsight({}, config, async () => Response.json({ candidates: [] })))
  await assert.rejects(generateInsight({}, config, async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"summary":' }] } }] })))
  assert.notEqual(insightKey(hotelId, { rooms_total: 4 }, 'a'), insightKey(otherHotel, { rooms_total: 4 }, 'a'))
  assert.notEqual(insightKey(hotelId, { rooms_total: 4 }, 'a'), insightKey(hotelId, { rooms_total: 5 }, 'a'))
})
