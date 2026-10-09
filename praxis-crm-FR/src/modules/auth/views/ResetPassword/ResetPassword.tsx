import { useEffect, useState } from 'react'
import './ResetPassword.css'
import { authService } from '../../services/auth.service'

interface Props {
  onBack: () => void
}

export const ResetPasswordView: React.FC<Props> = ({ onBack }) => {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Token inválido')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await authService.resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Error al restablecer contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card forgot-card">
          <div className="login-branding">
            <div className="forgot-success-icon" aria-hidden>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d9c9c" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2.2 2.2L16 8.5" />
              </svg>
            </div>
            <h1 className="login-title">Contraseña actualizada</h1>
            <p className="forgot-desc">Tu contraseña se ha restablecido correctamente.</p>
          </div>
          <button className="btn-primary" onClick={onBack}>
            Volver a Iniciar Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card forgot-card">
        <button className="forgot-back-btn" onClick={onBack} aria-label="Volver">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="login-branding">
          <h1 className="login-title">Nueva contraseña</h1>
          <p className="forgot-subtitle">Ingresa tu nueva contraseña.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar contraseña</label>
            <input
              type="password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Restablecer contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
