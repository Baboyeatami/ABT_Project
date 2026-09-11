import { useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { supabase, getAppMeta } from '../lib/supabase'
import { signOut, isAdmin, canUseHotel, canAccess } from '../lib/auth'

const RESTAURANT_LINKS = [
  ['/menu', 'Menu', 'menu'],
  ['/tables', 'Tables', 'tables'],
  ['/pos', 'Order (POS)', 'pos'],
  ['/kitchen', 'Kitchen', 'kitchen'],
]

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
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand fw-semibold" to="/">
            ABT Hotel & Restaurant
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
            <ul className="navbar-nav me-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/">
                  Dashboard
                </Link>
              </li>
              {hotelUser && (
                <>
                  {canAccess('rooms') && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/rooms">
                        Rooms
                      </Link>
                    </li>
                  )}
                  {canAccess('guests') && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/guests">
                        Guests
                      </Link>
                    </li>
                  )}
                  {canAccess('reservations') && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/reservations">
                        Front Desk
                      </Link>
                    </li>
                  )}
                  {RESTAURANT_LINKS.some(([, , m]) => canAccess(m)) && (
                    <li className="nav-item dropdown">
                      <button
                        className="nav-link dropdown-toggle"
                        onClick={() => setRestaurantOpen((v) => !v)}
                      >
                        Restaurant
                      </button>
                      <ul
                        className={`dropdown-menu ${restaurantOpen ? 'show' : ''}`}
                        style={{ position: 'absolute' }}
                      >
                        {RESTAURANT_LINKS.filter(([, , m]) => canAccess(m)).map(
                          ([to, label]) => (
                            <li key={to}>
                              <Link
                                className="dropdown-item"
                                to={to}
                                onClick={() => setRestaurantOpen(false)}
                              >
                                {label}
                              </Link>
                            </li>
                          ),
                        )}
                      </ul>
                    </li>
                  )}
                  {canAccess('billing') && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/billing">
                        Billing
                      </Link>
                    </li>
                  )}
                  {canAccess('reports') && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/reports">
                        Reports
                      </Link>
                    </li>
                  )}
                </>
              )}
              {isAdmin() && (
                <li className="nav-item">
                  <Link className="nav-link" to="/admin">
                    Admin
                  </Link>
                </li>
              )}
            </ul>
            {user && (
              <div className="d-flex align-items-center gap-3">
                <span className="navbar-text small">
                  {user.email}
                  <span className="badge bg-secondary ms-2">{meta.role}</span>
                </span>
                <button className="btn btn-outline-light btn-sm" onClick={handleSignOut}>
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
        ABT Hotel & Restaurant Management — Classroom Platform
      </footer>
    </div>
  )
}
