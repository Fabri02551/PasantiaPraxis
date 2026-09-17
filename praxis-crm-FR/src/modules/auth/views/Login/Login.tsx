import { useState, useEffect } from 'react'
import { authService } from '../../services/auth.service'
import { ApiError, apiClient } from '../../../core/lib/api'
import { ENV } from '../../../core/config/env'
import { Toast } from '../../../core/components/Toast/Toast'
import './Login.css'

type UserRole = 'admin' | 'visitador'

interface LoginFormProps {
  logoSrc?: string
  onLogin?: (role: UserRole) => void
  onForgot?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ logoSrc, onLogin, onForgot }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiToast, setApiToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .health()
      .then(() => {
        if (!cancelled) setApiToast({ msg: `Conectado a API ✓ ${ENV.API_URL}`, type: 'success' })
      })
      .catch(() => {
        if (!cancelled) setApiToast({ msg: `Sin conexión a API ✗ ${ENV.API_URL}`, type: 'error' })
      })
    const t = setTimeout(() => !cancelled && setApiToast(null), 4000)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()

    try {
      const res = await authService.login({ email: normalizedEmail, password })
      const role = res.role as UserRole
      if (role === 'admin' || role === 'visitador') {
        onLogin?.(role)
        return
      }
      onLogin?.('visitador')
      return
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Credenciales incorrectas.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {apiToast && <Toast message={apiToast.msg} type={apiToast.type} onClose={() => setApiToast(null)} />}
      <div className="login-deco login-deco--top" aria-hidden />
      <div className="login-deco login-deco--bottom" aria-hidden />
      <div className="login-card">
        {/* Branding Praxis */}
        <div className="login-branding">
          <div className="login-logo-wrapper">
            {logoSrc ? (
              <img src={logoSrc} alt="Praxis" className="login-logo-img" />
            ) : (
              <div className="login-logo-placeholder" aria-label="Logo Praxis">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="#1B2A4E"
                  stroke="none"
                  aria-hidden
                >
                  <rect x="2" y="7" width="20" height="12" rx="2" />
                  <path d="M8 7V5.2C8 4.1 8.9 3.2 10 3.2h4c1.1 0 2 .9 2 2V7" fill="none" stroke="#1B2A4E" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M7 11h10" stroke="#fff" strokeWidth="1.2" opacity="0.9" />
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
              placeholder="tu.correo@ejemplo.com"
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Conectando...' : 'Iniciar Sesión'}
          </button>

          <p className="login-footer">
            ¿Problemas de acceso? <a href="#">Soporte TI</a>
          </p>
        </form>
      </div>
    </div>
  )
}
