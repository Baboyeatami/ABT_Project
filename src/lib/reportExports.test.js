import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportCsv, reportMetricRows } from './reportExports.js'

const report = {
  generatedAt: '2026-09-22T10:00:00.000Z',
  metrics: {
    currency: 'PHP', period_start: '2026-09-15', period_end: '2026-09-21',
    rooms_total: 10, rooms_occupied: 7, rooms_maintenance: 1,
    reservations_created: 12, restaurant_sales: 1200, invoiced: 3000,
    collected: 2500, outstanding: 500,
  },
  insight: {
    summary: 'A steady week, with "good" demand.',
    observations: ['Review room readiness'],
    actions: ['Confirm arrivals', 'Reconcile payments', 'Discuss the result'],
  },
}

test('report metrics and CSV preserve report data safely', () => {
  const metrics = reportMetricRows(report)
  assert.equal(metrics[0].value, '70%')
  assert.equal(metrics[5].raw, 1200)
  const csv = buildReportCsv(report, 'Blue Horizon, Hotel')
  assert.match(csv, /^\ufeffReport,AI hotel performance insights/)
  assert.match(csv, /"Blue Horizon, Hotel"/)
  assert.match(csv, /Summary,"A steady week, with ""good"" demand\."/)
  const malicious = buildReportCsv({ ...report, insight: { ...report.insight, actions: ['=HYPERLINK("https://example.com")', 'safe', '@formula'] } })
  assert.match(malicious, /'=HYPERLINK/)
  assert.match(malicious, /'@formula/)
})
