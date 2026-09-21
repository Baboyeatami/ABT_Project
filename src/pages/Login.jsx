import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signInWithGoogle, signInWithPassword, signInDemo, isAuthenticated, isDemo } from '../lib/auth'
import { DEMO_ACCOUNTS } from '../lib/demoData'
import { subscribeSession } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(isDemo() ? 'owner@abt.demo' : '')
  const [password, setPassword] = useState(isDemo() ? 'demo1234' : '')
  const [error, setError] = useState(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const redirectAuthenticated = () => {
      if (isAuthenticated()) navigate('/', { replace: true })
    }
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const callbackError = query.get('error_description') || hash.get('error_description')
    if (callbackError) setError(callbackError)
    redirectAuthenticated()
    return subscribeSession(redirectAuthenticated)
  }, [navigate])

  const handlePassword = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await signInWithPassword(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  const handleDemo = async (e) => {
    e.preventDefault()
    setError(null)
    const res = signInDemo(email, password)
    if (res.error) {
      setError(res.error.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="login-wrap d-flex justify-content-center align-items-center p-3">
      <div className="card login-card" style={{ maxWidth: 440, width: '100%' }}>
        <div className="login-head">
          <h1 className="h4 mb-1 fw-bold">
            <i className="bi bi-buildings me-2" />
            ABT Hotel &amp; Restaurant
          </h1>
          <p className="mb-0 opacity-75 small">Classroom Management Platform</p>
        </div>
        <div className="card-body p-4">
          {isDemo() ? (
            <>
              <div className="alert alert-info small mb-3">
                <strong>Demo mode</strong> — sign in with any seeded account. All data
                lives in your browser; no Supabase/Docker required.
              </div>
              <form onSubmit={handleDemo}>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-danger small mb-2">{error}</p>}
                <button className="btn btn-primary w-100" type="submit">
                  Sign in
                </button>
              </form>

              <hr className="my-3" />
              <div className="small text-muted mb-1">Quick sign-in as:</div>
              <div className="d-grid gap-1">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    className="btn btn-outline-secondary btn-sm text-start"
                    onClick={() => {
                      signInDemo(a.email, a.password)
                      navigate('/', { replace: true })
                    }}
                  >
                    <span className="text-muted small me-1">{a.profileId.replace('user-', '')}</span>
                    {a.email}
                  </button>
                ))}
              </div>
              <p className="text-muted small mt-3 mb-0">
                All demo accounts use password <code>demo1234</code>.
              </p>
            </>
          ) : (
            <>
              <form onSubmit={handlePassword}>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-danger small mb-2">{error}</p>}
                <button className="btn btn-primary w-100" type="submit">
                  Sign in
                </button>
              </form>

              <div className="d-flex align-items-center my-3">
                <hr className="flex-grow-1 my-0" />
                <span className="small text-muted mx-2">or</span>
                <hr className="flex-grow-1 my-0" />
              </div>
              <button className="btn btn-outline-primary w-100" onClick={handleGoogle} disabled={googleLoading}>
                <i className="bi bi-google me-2" />
                {googleLoading ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <p className="text-muted small mt-3 mb-0">
                Students can sign in with their school Google account (@g.cjc.edu.ph).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
