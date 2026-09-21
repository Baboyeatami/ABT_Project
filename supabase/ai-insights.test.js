import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('AI migration enforces private RPCs, metric scope, cache claims and persistent limits', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.hotels(id uuid primary key, currency text);
    create table public.rooms(hotel_id uuid, status text);
    create table public.reservations(hotel_id uuid, created_at timestamptz);
    create table public.orders(hotel_id uuid, status text, total numeric, created_at timestamptz);
    create table public.invoices(hotel_id uuid, status text, total numeric, amount_paid numeric, created_at timestamptz);
    create table public.payments(hotel_id uuid, amount numeric, created_at timestamptz);
    grant usage on schema public to anon, authenticated, service_role;
    grant select on all tables in schema public to service_role;
  `)
  await db.exec(await readFile(new URL('./migrations/0004_ai_insights.sql', import.meta.url), 'utf8'))
  const h = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  await db.exec(`
    insert into hotels values ('${h}', 'PHP'), ('${other}', 'USD');
    insert into rooms values ('${h}', 'occupied'), ('${h}', 'available'), ('${other}', 'occupied');
    insert into invoices values ('${h}', 'unpaid', 100, 20, now()), ('${h}', 'void', 900, 0, now()), ('${h}', 'partial', 50, 10, now() - interval '90 days'), ('${other}', 'unpaid', 800, 0, now());
    insert into payments values ('${h}', 20, now()), ('${other}', 800, now());
    insert into orders values ('${h}', 'sent', 150, now()), ('${h}', 'cancelled', 300, now());
  `)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query('select public.ai_hotel_snapshot($1, 7)', [h]), /permission denied/)
    await assert.rejects(db.query('select public.ai_claim_request($1, $1, $2)', [h, 'key']), /permission denied/)
    await assert.rejects(db.query('select * from public.ai_insight_cache'), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  const snapshot = (await db.query('select public.ai_hotel_snapshot($1, 7) as result', [h])).rows[0].result
  assert.equal(snapshot.rooms_total, 2)
  assert.equal(snapshot.rooms_occupied, 1)
  assert.equal(snapshot.invoiced, 100)
  assert.equal(snapshot.outstanding, 120)
  assert.equal(snapshot.collected, 20)
  assert.equal(snapshot.restaurant_sales, 150)
  await assert.rejects(db.query('select public.ai_hotel_snapshot($1, 365)', [h]), /Invalid reporting period/)
  const claim = async (key, user = h) => (await db.query('select public.ai_claim_request($1, $2, $3) as result', [user, h, key])).rows[0].result
  const first = await claim('first')
  assert.equal(first.status, 'claimed')
  assert.equal((await claim('first')).status, 'busy')
  await db.query("update ai_insight_cache set response = '{\"insight\":\"sample\"}', expires_at = now() + interval '15 minutes' where cache_key = 'first'")
  assert.equal((await claim('first')).status, 'cached')
  assert.equal((await claim('second')).status, 'claimed')
  assert.equal((await claim('third')).status, 'minute_limit')
  await db.exec("update ai_usage set minute_start = now() - interval '2 minutes'")
  assert.equal((await claim('third')).status, 'claimed')
  assert.equal((await claim('fourth')).status, 'claimed')
  await db.exec("update ai_usage set minute_start = now() - interval '2 minutes'")
  assert.equal((await claim('fifth')).status, 'claimed')
  assert.equal((await claim('sixth')).status, 'daily_limit')
  assert.equal((await claim('first')).status, 'cached')
  await db.exec("update ai_usage set requests = 30 where bucket = 'global'")
  assert.equal((await claim('other-user', other)).status, 'daily_limit')
  await db.exec("update ai_usage set usage_day = usage_day - 1; update ai_insight_cache set expires_at = now() - interval '1 second' where cache_key = 'second'")
  assert.equal((await claim('second')).status, 'claimed')
})
