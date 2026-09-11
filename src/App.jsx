import { Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated, canUseHotel, canAccess } from './lib/auth'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import Rooms from './pages/Rooms'
import Guests from './pages/Guests'
import Reservations from './pages/Reservations'
import Menu from './pages/Menu'
import Tables from './pages/Tables'
import Pos from './pages/Pos'
import Kitchen from './pages/Kitchen'
import Billing from './pages/Billing'
import Reports from './pages/Reports'

function Protected({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

// Pages that require an assigned hotel (owner or staff).
function HotelOnly({ children }) {
  if (!canUseHotel()) return <Navigate to="/" replace />
  return children
}

// Pages restricted to specific roles.
function Module({ name, children }) {
  if (!canAccess(name)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="admin" element={<Admin />} />
        <Route
          path="rooms"
          element={
            <HotelOnly>
              <Module name="rooms">
                <Rooms />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="guests"
          element={
            <HotelOnly>
              <Module name="guests">
                <Guests />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="reservations"
          element={
            <HotelOnly>
              <Module name="reservations">
                <Reservations />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="menu"
          element={
            <HotelOnly>
              <Module name="menu">
                <Menu />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="tables"
          element={
            <HotelOnly>
              <Module name="tables">
                <Tables />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="pos"
          element={
            <HotelOnly>
              <Module name="pos">
                <Pos />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="kitchen"
          element={
            <HotelOnly>
              <Module name="kitchen">
                <Kitchen />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="billing"
          element={
            <HotelOnly>
              <Module name="billing">
                <Billing />
              </Module>
            </HotelOnly>
          }
        />
        <Route
          path="reports"
          element={
            <HotelOnly>
              <Module name="reports">
                <Reports />
              </Module>
            </HotelOnly>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
