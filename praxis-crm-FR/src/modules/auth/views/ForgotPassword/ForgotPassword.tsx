import { useState } from 'react'
import './ForgotPassword.css'

interface Props {
  onBack: () => void
}

export const ForgotPasswordView: React.FC<Props> = ({ onBack }) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const v = email.trim()
    if (!v) {
      setError('Ingresa tu correo electrónico')
      return
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    if (!ok) {
      setError('Correo inválido')
      return
    }
    try {
      const { ENV } = await import('../../../core/config/env')
      const appUrl = ENV.APP_URL || window.location.origin
      await import('../../services/auth.service').then((m) => m.authService.forgotPassword(v, appUrl))
    } catch (err) {
      // No revelamos si existe o no; mostramos mensaje genérico
    }
    setSent(true)
  }

  if (sent) {
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
            <h1 className="login-title">Revisa tu correo</h1>
            <p className="forgot-desc">
              Te enviamos un enlace a <strong>{email}</strong> para restablecer tu contraseña. Si no lo ves, revisa tu bandeja de spam.
            </p>
          </div>
          <button className="btn-primary" onClick={onBack}>
            Volver a Iniciar Sesión
          </button>
          <button className="forgot-back-link" onClick={() => setSent(false)}>
            Enviar a otro correo
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
          <div className="login-logo-wrapper">
            <div className="login-logo-placeholder" aria-label="Logo Praxis">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B2A4E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="13" rx="2" />
                <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                <path d="M2 12h20" />
                <path d="M7 12v5" />
                <path d="M12 12v5" />
                <path d="M17 12v5" />
              </svg>
            </div>
          </div>
          <h1 className="login-title">¿Olvidaste tu contraseña?</h1>
          <p className="forgot-subtitle">Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="forgot-email" className="form-label">
              Correo Electrónico
            </label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              placeholder="ejemplo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-primary">
            Enviar Enlace
          </button>

          <p className="login-footer">
            ¿Recordaste tu contraseña? <button type="button" className="link-btn" onClick={onBack}>Iniciar Sesión</button>
          </p>
        </form>
      </div>
    </div>
  )
}
