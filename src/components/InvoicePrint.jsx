const fmt = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0))

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

const SOURCE_LABEL = { room: 'Room charge', restaurant: 'Restaurant', manual: 'Other charge' }

export default function InvoicePrint({ invoice, charges = [], payments = [], hotel }) {
  const stay = invoice.stay_sessions
  const guest = stay?.guests
  const room = stay?.rooms
  const balance = Number(invoice.total) - Number(invoice.amount_paid)
  charges = invoice.line_items || charges
  const items = charges.length
    ? charges
    : [{ id: 'single', description: 'Total charges', amount: invoice.subtotal }]

  return (
    <div id="invoice-print" className="print-area p-3">
      <div className="d-flex justify-content-between border-bottom pb-3 mb-3">
        <div>
          <h2 className="h4 mb-1 fw-bold text-brand">
            <i className="bi bi-buildings me-2" />
            {hotel?.name || 'Hotel'}
          </h2>
          <div className="small text-muted">{hotel?.address || ''}</div>
          <div className="small text-muted">Currency: {hotel?.currency || 'PHP'}</div>
        </div>
        <div className="text-end">
          <div className="h5 text-uppercase fw-bold">Invoice</div>
          <div className="small">
            <div>
              <span className="text-muted">No:</span> {invoice.invoice_number}
            </div>
            <div>
              <span className="text-muted">Date:</span> {fmtDate(invoice.created_at)}
            </div>
            <div className="mt-1">
              <span className={`badge text-bg-${invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'secondary' : invoice.status === 'partially_paid' ? 'warning' : 'danger'}`}>
                {invoice.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <div className="text-muted small text-uppercase">Bill to</div>
          <div className="fw-semibold">
            {guest?.first_name} {guest?.last_name}
          </div>
          {guest?.email && <div className="small">{guest.email}</div>}
          {guest?.phone && <div className="small">{guest.phone}</div>}
        </div>
        <div className="col-sm-6">
          <div className="text-muted small text-uppercase">Stay</div>
          {room?.room_number && (
            <div className="small">
              Room <span className="fw-semibold">{room.room_number}</span>
              {room?.floor ? ` · Floor ${room.floor}` : ''}
              {room?.room_types?.name ? ` · ${room.room_types.name}` : ''}
            </div>
          )}
          <div className="small">
            {fmtDate(stay?.check_in_at)} → {fmtDate(stay?.check_out_at)}
          </div>
        </div>
      </div>

      <table className="table table-sm align-middle">
        <thead>
          <tr className="text-muted small text-uppercase">
            <th>Description</th>
            <th className="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id || c.description}>
              <td>
                <div>{c.description || SOURCE_LABEL[c.source] || 'Charge'}</div>
                <div className="text-muted small">{SOURCE_LABEL[c.source] || ''}</div>
              </td>
              <td className="text-end fw-semibold">{fmt(c.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row justify-content-end">
        <div className="col-sm-6 col-lg-5">
          <div className="d-flex justify-content-between small py-1">
            <span>Subtotal</span>
            <span>{fmt(invoice.subtotal)}</span>
          </div>
          <div className="d-flex justify-content-between small py-1">
            <span>Tax (12%)</span>
            <span>{fmt(invoice.tax)}</span>
          </div>
          <div className="d-flex justify-content-between small py-1">
            <span>Discount</span>
            <span>{fmt(invoice.discount)}</span>
          </div>
          <div className="d-flex justify-content-between fw-bold border-top py-2">
            <span>Total</span>
            <span>{fmt(invoice.total)}</span>
          </div>
          <div className="d-flex justify-content-between small py-1">
            <span>Amount paid</span>
            <span>{fmt(invoice.amount_paid)}</span>
          </div>
          <div className="d-flex justify-content-between fw-bold py-1">
            <span>Balance due</span>
            <span>{fmt(balance)}</span>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="mt-3">
          <div className="text-muted small text-uppercase mb-1">Payments</div>
          <table className="table table-sm mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Method</th>
                <th>Reference</th>
                <th>Date</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-capitalize">{p.method}</td>
                  <td>{p.reference || '—'}</td>
                  <td>{fmtDate(p.created_at)}</td>
                  <td className="text-end">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-top pt-3 mt-3 text-center small text-muted">
        Thank you for staying with us. {hotel?.name} — Customer invoice.
      </div>
    </div>
  )
}
