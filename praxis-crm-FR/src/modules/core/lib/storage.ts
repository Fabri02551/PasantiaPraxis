const TOKEN_KEY = 'praxis_token'
const ROLE_KEY = 'praxis_role'
const USER_KEY = 'praxis_user'

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRole: () => localStorage.getItem(ROLE_KEY) as 'admin' | 'visitador' | null,
  setRole: (r: string) => localStorage.setItem(ROLE_KEY, r),
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  setUser: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
