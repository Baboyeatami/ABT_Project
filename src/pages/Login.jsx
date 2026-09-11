import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signInWithGoogle, signInDemo, isAuthenticated, isDemo } from '../lib/auth'
import { DEMO_ACCOUNTS } from '../lib/demoData'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('owner@abt.demo')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isAuthenticated()) navigate('/', { replace: true })
  }, [navigate])

  const handleGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      alert(`Sign-in failed: ${err.message}`)
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
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4">
          <h1 className="h4 mb-1 fw-semibold">ABT Hotel & Restaurant</h1>
          <p className="text-muted mb-4">Classroom Management Platform</p>

          {isDemo() ? (
            <>
              <p className="small">
                <strong>Demo mode</strong> — sign in with any seeded account below.
                All data is in your browser; no Supabase/Docker required.
              </p>
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
                {error && <p className="text-danger small">{error}</p>}
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
                    onClick={() => signInDemo(a.email, a.password) && navigate('/', { replace: true })}
                  >
                    {a.email} <span className="text-muted">— {a.profileId.replace('user-', '')}</span>
                  </button>
                ))}
              </div>
              <p className="text-muted small mt-3 mb-0">
                All demo accounts use password <code>demo1234</code>.
              </p>
            </>
          ) : (
            <>
              <p className="small">
                Sign in with your school Google account to access your hotel workspace.
              </p>
              <button className="btn btn-primary w-100" onClick={handleGoogle}>
                Continue with Google
              </button>
              <p className="text-muted small mt-3 mb-0">
                Only accounts from your school domain (@g.cjc.edu.ph) are allowed.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
