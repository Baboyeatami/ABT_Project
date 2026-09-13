import { useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { supabase, getAppMeta } from '../lib/supabase'
import { signOut, isAdmin, canUseHotel, canAccess } from '../lib/auth'

const RESTAURANT_LINKS = [
  ['/menu', 'Menu', 'bi-list-ul', 'menu'],
  ['/tables', 'Tables', 'bi-grid-3x3-gap', 'tables'],
  ['/pos', 'Order (POS)', 'bi-cart3', 'pos'],
  ['/kitchen', 'Kitchen', 'bi-fire', 'kitchen'],
]

function NavItem({ to, label, icon }) {
  return (
    <li className="nav-item">
      <Link className="nav-link" to={to}>
        <i className={`bi ${icon} me-1`} />
        {label}
      </Link>
    </li>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()
  const [restaurantOpen, setRestaurantOpen] = useState(false)
  const session = supabase.auth.getSession()?.data?.session
  const user = session?.user
  const meta = getAppMeta()
  const hotelUser = canUseHotel()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark app-nav">
        <div className="container-fluid">
          <Link className="navbar-brand fw-bold" to="/">
            <i className="bi bi-buildings" />
            <span className="app-brand" style={{ WebkitTextFillColor: 'unset', color: '#fff' }}>
              ABT Hotel &amp; Restaurant
            </span>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="mainNav">
            <ul className="navbar-nav me-auto gap-1">
              <NavItem to="/" label="Dashboard" icon="bi-speedometer2" />
              {hotelUser && (
                <>
                  {canAccess('rooms') && (
                    <NavItem to="/rooms" label="Rooms" icon="bi-door-open" />
                  )}
                  {canAccess('guests') && (
                    <NavItem to="/guests" label="Guests" icon="bi-people" />
                  )}
                  {canAccess('reservations') && (
                    <NavItem to="/reservations" label="Front Desk" icon="bi-front" />
                  )}
                  {RESTAURANT_LINKS.some(([, , , m]) => canAccess(m)) && (
                    <li className="nav-item dropdown">
                      <button
                        className="nav-link dropdown-toggle"
                        onClick={() => setRestaurantOpen((v) => !v)}
                      >
                        <i className="bi bi-cup-hot me-1" />
                        Restaurant
                      </button>
                      <ul
                        className={`dropdown-menu ${restaurantOpen ? 'show' : ''}`}
                        style={{ position: 'absolute' }}
                      >
                        {RESTAURANT_LINKS.filter(([, , , m]) => canAccess(m)).map(
                          ([to, label, icon]) => (
                            <li key={to}>
                              <Link
                                className="dropdown-item"
                                to={to}
                                onClick={() => setRestaurantOpen(false)}
                              >
                                <i className={`bi ${icon} me-2`} />
                                {label}
                              </Link>
                            </li>
                          ),
                        )}
                      </ul>
                    </li>
                  )}
                  {canAccess('billing') && (
                    <NavItem to="/billing" label="Billing" icon="bi-receipt" />
                  )}
                  {canAccess('reports') && (
                    <NavItem to="/reports" label="Reports" icon="bi-graph-up" />
                  )}
                </>
              )}
              {isAdmin() && <NavItem to="/admin" label="Admin" icon="bi-shield-lock" />}
            </ul>
            {user && (
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="user-avatar d-inline-flex align-items-center justify-content-center rounded-circle text-white fw-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="d-none d-md-block lh-sm">
                    <div className="small text-white">{user.email}</div>
                    <span className="badge text-bg-info">{meta.role}</span>
                  </div>
                </div>
                <button className="btn btn-outline-light btn-sm" onClick={handleSignOut}>
                  <i className="bi bi-box-arrow-right me-1" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="container-fluid py-4 flex-grow-1">
        <Outlet />
      </main>

      <footer className="text-center text-muted small py-3">
        ABT Hotel &amp; Restaurant Management — Classroom Platform
      </footer>
    </div>
  )
}
