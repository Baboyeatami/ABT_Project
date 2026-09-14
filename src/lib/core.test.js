import test from 'node:test'
import assert from 'node:assert/strict'
import { demoClient, signIn, demoOperation } from './demoData.js'

test('invoice snapshot, single taxation, payment validation, and role checks', async () => {
  signIn('owner@abt.demo','demo1234')
  const first = await demoOperation('issue_invoice',{p_stay:'stay-1'})
  assert.equal(first.error,null)
  assert.equal(first.data.subtotal,4900)
  assert.equal(first.data.tax,588)
  assert.equal(first.data.total,5488)
  const second = await demoOperation('issue_invoice',{p_stay:'stay-1'})
  assert.equal(second.data.id,first.data.id)
  assert.equal(first.data.line_items.reduce((s,l)=>s+l.amount,0),first.data.subtotal)
  const payment = {p_invoice:first.data.id,p_amount:6000,p_method:'cash',p_reference:null}
  assert.ok((await demoOperation('record_payment',payment)).error)
  payment.p_amount=1000
  assert.equal((await demoOperation('record_payment',payment)).error,null)
  const invoice = await demoClient.from('invoices').select().eq('id',first.data.id).single()
  assert.equal(invoice.data.amount_paid,1000)
  assert.equal(invoice.data.status,'partially_paid')
  assert.ok((await demoOperation('void_invoice',{p_invoice:first.data.id})).error)
  signIn('kitchen@abt.demo','demo1234')
  assert.ok((await demoOperation('record_payment',payment)).error)
})

test('check-in and check-out maintain a single active stay', async () => {
  signIn('frontdesk@abt.demo','demo1234')
  const args={p_reservation:'res-2',p_action:'check_in'}
  assert.equal((await demoOperation('change_stay',args)).error,null)
  assert.ok((await demoOperation('change_stay',args)).error)
  const active=await demoClient.from('stay_sessions').select().eq('reservation_id','res-2').eq('status','open')
  assert.equal(active.data.length,1)
  args.p_action='check_out'
  assert.equal((await demoOperation('change_stay',args)).error,null)
  const room=await demoClient.from('rooms').select().eq('id','room-201').single()
  assert.equal(room.data.status,'available')
})
