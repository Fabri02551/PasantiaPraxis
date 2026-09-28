import { useState } from 'react'

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  const login = async (_email: string, _password: string) => {
    // TODO: Implement login logic
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
  }

  return {
    isAuthenticated,
    user,
    login,
    logout,
  }
}
