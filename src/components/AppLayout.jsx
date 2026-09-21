import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { getSessionSnapshot, DEMO } from '../lib/supabase'
import { signOut, isAdmin, canAccess } from '../lib/auth'
import { useHotel } from '../lib/hotel'

const GROUPS = [
  ['Workspace', [['/', 'Overview', 'bi-grid-1x2'], ['/rooms', 'Rooms', 'bi-door-open', 'rooms'], ['/guests', 'Guests', 'bi-people', 'guests'], ['/reservations', 'Front desk', 'bi-front', 'reservations']]],
  ['Restaurant', [['/menu', 'Menu', 'bi-journal-text', 'menu'], ['/tables', 'Dining tables', 'bi-grid-3x3-gap', 'tables'], ['/pos', 'Point of sale', 'bi-bag', 'pos'], ['/kitchen', 'Kitchen', 'bi-fire', 'kitchen']]],
  ['Management', [['/billing', 'Billing', 'bi-receipt', 'billing'], ['/reports', 'Reports', 'bi-bar-chart', 'reports'], ['/admin', 'Administration', 'bi-shield-check', 'admin']]],
]

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const toggleRef = useRef(null)
  const navRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { hotel, role } = useHotel()
  const user = getSessionSnapshot()?.user
  const admin = isAdmin()
  const groups = GROUPS.map(([name, links]) => [name, links.filter(([, , , module]) =>
    !module || (module === 'admin' ? admin : !admin && canAccess(module)))])
  const page = GROUPS.flatMap(([, links]) => links).find(([path]) => path === location.pathname)?.[1] || 'Workspace'

  useEffect(() => { setNavOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    navRef.current?.querySelector('button')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') {
        setNavOpen(false)
        toggleRef.current?.focus()
      }
      if (event.key === 'Tab') {
        const items = navRef.current.querySelectorAll('a, button')
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown) }
  }, [navOpen])

  async function handleSignOut() {
    try { await signOut(); navigate('/login') } catch { setSignOutError('Could not sign out. Please try again.') }
  }

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      {navOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => { setNavOpen(false); toggleRef.current?.focus() }} />}
      <aside ref={navRef} id="workspace-nav" className={`workspace-sidebar ${navOpen ? 'is-open' : ''}`}>
        <button className="sidebar-close btn btn-sm btn-outline-light" onClick={() => { setNavOpen(false); toggleRef.current?.focus() }} aria-label="Close navigation"><i className="bi bi-x-lg" /></button>
        <Link to="/" className="workspace-brand"><span className="brand-mark"><i className="bi bi-buildings" /></span><span>ABT<span className="brand-caption">Hospitality workspace</span></span></Link>
        <div className="workspace-property"><span className="property-dot" /><div><strong>{admin ? 'Instructor workspace' : hotel?.name || 'Hotel workspace'}</strong><span>{admin ? 'Platform management' : 'Hotel & restaurant operations'}</span></div></div>
        <nav aria-label="Main navigation" className="workspace-navigation">
          {groups.filter(([, links]) => links.length).map(([name, links]) => <div className="navigation-group" key={name}>
            <p>{name}</p>
            {links.map(([to, label, icon]) => <NavLink end={to === '/'} key={to} to={to} className={({ isActive }) => `workspace-link ${isActive ? 'active' : ''}`}><i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span></NavLink>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom"><i className="bi bi-mortarboard" /><span>Built for learning.<br /><strong>Ready for hospitality.</strong></span></div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="d-flex align-items-center gap-3"><button ref={toggleRef} className="mobile-nav-toggle btn btn-light" aria-label="Open navigation" aria-expanded={navOpen} aria-controls="workspace-nav" onClick={() => setNavOpen(true)}><i className="bi bi-list" /></button><span className="topbar-context">Workspace <span>/</span> <strong>{page}</strong></span></div>
          <div className="d-flex align-items-center gap-3">
            {DEMO && <span className="demo-pill">Demo workspace</span>}
            <div className="account-details"><strong>{user?.email}</strong><span>{role?.replaceAll('_', ' ')}</span></div>
            <span className="account-avatar" aria-hidden="true">{user?.email?.[0]?.toUpperCase() || 'A'}</span>
            <button className="btn btn-light btn-sm" onClick={handleSignOut} aria-label="Sign out" title="Sign out"><i className="bi bi-box-arrow-right" /></button>
          </div>
        </header>
        <main id="workspace-content" className="workspace-content" tabIndex="-1">
          {signOutError && <div role="alert" className="alert alert-danger">{signOutError}</div>}
          <Outlet />
        </main>
        <footer className="workspace-footer"><span>ABT Hotel & Restaurant</span><span>Classroom management platform</span></footer>
      </div>
    </div>
  )
}
