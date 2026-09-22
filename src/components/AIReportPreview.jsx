import { useEffect } from 'react'
import { downloadReportCsv, downloadReportPdf, reportMetricRows } from '../lib/reportExports'

export default function AIReportPreview({ result, hotelName, onClose }) {
  const metrics = result.metrics || {}
  const title = hotelName || 'Hotel performance report'
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previous }
  }, [onClose])
  return <div className="report-preview-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="report-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
      <header className="report-preview-toolbar">
        <div><p className="report-kicker">Report preview</p><h2 id="report-preview-title">{title}</h2><p>AI hotel performance report</p></div>
        <div className="report-preview-actions">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print / Save PDF</button>
          <button className="btn btn-outline-primary btn-sm" onClick={() => downloadReportPdf(result, hotelName)}><i className="bi bi-file-earmark-pdf me-1" />Download PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => downloadReportCsv(result, hotelName)}><i className="bi bi-filetype-csv me-1" />Download CSV</button>
          <button className="btn btn-light btn-sm" aria-label="Close report preview" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
      </header>
      <article className="report-preview-paper">
        <div className="report-paper-brand"><span className="brand-mark"><i className="bi bi-buildings" /></span><span><strong>ABT Hotel & Restaurant</strong><small>Classroom management platform</small></span></div>
        <div className="report-paper-title"><div><span className="report-kicker">AI performance report</span><h1>{title}</h1></div><div className="report-paper-meta"><span>{metrics.period_start || '-'} to {metrics.period_end || '-'}</span><span>{result.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}</span></div></div>
        <div className="report-paper-section"><h3>Summary</h3><p className="report-summary">{result.insight?.summary}</p></div>
        <div className="report-paper-section"><h3>Metric snapshot</h3><div className="report-preview-metrics">{reportMetricRows(result).map(row => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}</div></div>
        <div className="report-paper-columns"><div className="report-paper-section"><h3>What stands out</h3><ul>{(result.insight?.observations || []).map((item, i) => <li key={i}>{item}</li>)}</ul></div><div className="report-paper-section"><h3>Next steps</h3><ol>{(result.insight?.actions || []).map((item, i) => <li key={i}>{item}</li>)}</ol></div></div>
        <p className="report-paper-footnote">Generated from aggregate operational data. Occupancy and outstanding balances are snapshots. Restaurant values exclude cancelled orders; collections may cover older invoices.</p>
      </article>
    </section>
  </div>
}
