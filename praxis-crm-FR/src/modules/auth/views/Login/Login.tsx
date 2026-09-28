import { useState } from 'react'
import './Login.css'

interface LoginFormProps {
  logoSrc?: string
  onLogin?: (email: string, password: string) => void
  onForgot?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ logoSrc, onLogin, onForgot }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const VALID_CREDENTIALS = {
    email: 'visitador@praxis.com',
    password: 'visitador123',
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      onLogin?.(email, password)
    } else {
      setError('Credenciales incorrectas. Usa visitador@praxis.com / visitador123')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Espacio para imagen / logo */}
        <div className="login-branding">
          <div className="login-logo-wrapper">
            {logoSrc ? (
              <img src={logoSrc} alt="Praxis" className="login-logo-img" />
            ) : (
              <div className="login-logo-placeholder" aria-label="Logo Praxis">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1B2A4E"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="13" rx="2" />
                  <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                  <path d="M2 12h20" />
                  <path d="M7 12v5" />
                  <path d="M12 12v5" />
                  <path d="M17 12v5" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="login-title">Praxis</h1>
          <p className="login-subtitle">Laboratorio clínico</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="ejemplo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.53 9.53A3 3 0 0 0 12 15a3 3 0 0 0 2.47-5.47" />
                    <path d="M14.12 14.12L9.88 9.88" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="login-actions">
            <button type="button" className="forgot-link" onClick={onForgot} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-primary">
            Iniciar Sesión
          </button>
          <p className="login-hint">
            Demo: <code>visitador@praxis.com</code> / <code>visitador123</code>
          </p>

          <p className="login-footer">
            ¿No tienes cuenta? <a href="#">Contacta a tu administrador</a>
          </p>
        </form>
      </div>
    </div>
  )
}
