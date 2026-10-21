import { useState, useCallback } from 'react'
import { authService } from '../services/auth.service'
import { storage } from '../../core/lib/storage'

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!storage.getToken())
  const [user, setUser] = useState(() => storage.getUser())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await authService.login({ email, password })
      setIsAuthenticated(true)
      setUser({ email, role: res.role })
      return res
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar sesión'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setIsAuthenticated(false)
    setUser(null)
  }, [])

  return { isAuthenticated, user, role: storage.getRole(), loading, error, login, logout }
}
