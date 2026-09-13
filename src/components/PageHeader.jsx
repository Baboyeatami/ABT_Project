export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
      <div>
        <h1 className="h3 fw-bold mb-1">{title}</h1>
        {subtitle && <p className="page-subtitle mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex gap-2">{actions}</div>}
    </div>
  )
}
