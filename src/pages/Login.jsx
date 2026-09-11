import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { signInWithGoogle, isAuthenticated } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated()) navigate('/', { replace: true })
  }, [navigate])

  const handleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      alert(`Sign-in failed: ${err.message}`)
    }
  }

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 420, width: '100%' }}>
        <div className="card-body p-4">
          <h1 className="h4 mb-1 fw-semibold">ABT Hotel & Restaurant</h1>
          <p className="text-muted mb-4">Classroom Management Platform</p>
          <p className="small">
            Sign in with your school Google account to access your hotel workspace.
          </p>
          <button className="btn btn-primary w-100" onClick={handleLogin}>
            Continue with Google
          </button>
          <p className="text-muted small mt-3 mb-0">
            Only accounts from your school domain (@g.cjc.edu.ph) are allowed.
          </p>
        </div>
      </div>
    </div>
  )
}
