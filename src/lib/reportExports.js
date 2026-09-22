const METRICS = [
  ['Occupancy now', metrics => `${metrics.rooms_total ? Math.round(metrics.rooms_occupied / metrics.rooms_total * 100) : 0}%`, 'percent'],
  ['Rooms total', metrics => metrics.rooms_total, 'count'],
  ['Rooms occupied', metrics => metrics.rooms_occupied, 'count'],
  ['Rooms maintenance', metrics => metrics.rooms_maintenance, 'count'],
  ['Reservations created', metrics => metrics.reservations_created, 'count'],
  ['Restaurant order value', metrics => metrics.restaurant_sales, 'amount'],
  ['Invoiced in period', metrics => metrics.invoiced, 'amount'],
  ['Collected in period', metrics => metrics.collected, 'amount'],
  ['Outstanding now', metrics => metrics.outstanding, 'amount'],
]

function currency(value, code = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toFixed(2)} ${code}`
  }
}

export function reportMetricRows(result) {
  const metrics = result.metrics || {}
  return METRICS.map(([label, value, type]) => {
    const raw = value(metrics)
    return { label, raw, value: type === 'amount' ? currency(raw, metrics.currency) : String(raw), type }
  })
}

function csvCell(value) {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function buildReportCsv(result, hotelName = 'Hotel') {
  const metrics = result.metrics || {}
  const rows = [
    ['Report', 'AI hotel performance insights'],
    ['Hotel', hotelName],
    ['Generated at', result.generatedAt || ''],
    ['Period start', metrics.period_start || ''],
    ['Period end', metrics.period_end || ''],
    [],
    ['Category', 'Metric', 'Value', 'Raw value', 'Currency'],
    ...reportMetricRows(result).map(row => ['Metric', row.label, row.value, row.raw, row.type === 'amount' ? metrics.currency || '' : '']),
    [],
    ['Category', 'Item'],
    ['Summary', result.insight?.summary || ''],
    ...(result.insight?.observations || []).map(item => ['Observation', item]),
    ...(result.insight?.actions || []).map(item => ['Next step', item]),
  ]
  return `\ufeff${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function filenamePart(value) {
  return String(value || 'hotel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hotel'
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadReportCsv(result, hotelName) {
  downloadBlob(buildReportCsv(result, hotelName), `${filenamePart(hotelName)}-ai-report.csv`, 'text/csv;charset=utf-8')
}

export async function downloadReportPdf(result, hotelName = 'Hotel') {
  const [{ default: jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  createReportPdf(result, hotelName, jsPDF, autoTable)
}

function createReportPdf(result, hotelName, jsPDF, autoTable) {
  const metrics = result.metrics || {}
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const teal = [8, 127, 120]
  const navy = [20, 46, 64]
  const margin = 42
  let y = 48
  doc.setProperties({ title: `${hotelName} AI performance report`, subject: 'Hotel performance insights' })
  doc.setFillColor(...navy)
  doc.rect(0, 0, 595, 92, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(21)
  doc.setFont('helvetica', 'bold')
  doc.text('ABT Hotel & Restaurant', margin, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('AI hotel performance report', margin, y + 20)
  y = 122
  doc.setTextColor(...navy)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(hotelName, margin, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(89, 108, 120)
  doc.text(`Period: ${metrics.period_start || '-'} to ${metrics.period_end || '-'} (UTC)`, margin, y + 18)
  doc.text(`Generated: ${result.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}`, margin, y + 32)
  y += 60
  doc.setTextColor(...navy)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const summary = doc.splitTextToSize(result.insight?.summary || 'No summary available.', 511)
  doc.text(summary, margin, y, { lineHeightFactor: 1.5 })
  y += summary.length * 15 + 18
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Metric snapshot', margin, y)
  y += 8
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: reportMetricRows(result).map(row => [row.label, row.value]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: navy },
    headStyles: { fillColor: teal, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 248, 248] },
  })
  y = doc.lastAutoTable.finalY + 24
  const addList = (title, items) => {
    if (!items?.length) return
    if (y > 730) { doc.addPage(); y = 48 }
    doc.setTextColor(...navy)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    items.forEach((item, index) => {
      const lines = doc.splitTextToSize(`${index + 1}. ${item}`, 500)
      doc.text(lines, margin + 4, y, { lineHeightFactor: 1.45 })
      y += lines.length * 14 + 6
    })
    y += 8
  }
  addList('What stands out', result.insight?.observations)
  addList('Next steps', result.insight?.actions)
  if (y > 750) { doc.addPage(); y = 48 }
  doc.setFontSize(8)
  doc.setTextColor(89, 108, 120)
  doc.text('Generated from aggregate operational data. Review recommendations against your records.', margin, y)
  doc.save(`${filenamePart(hotelName)}-ai-report.pdf`)
}
