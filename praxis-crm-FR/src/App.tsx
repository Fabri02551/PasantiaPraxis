import { useState } from 'react'
import { LoginForm } from './modules/auth/views/Login/Login'
import { ForgotPasswordView } from './modules/auth/views/ForgotPassword/ForgotPassword'
import { VisitadorHome } from './modules/visitador/views/Home/Home'
import { VisitRegistrationView } from './modules/visitador/views/VisitRegistration/VisitRegistration'
import { CalendarView } from './modules/visitador/views/Calendar/Calendar'
import { ProfileView } from './modules/visitador/views/Profile/Profile'
import { NotificationsView } from './modules/visitador/views/Notifications/Notifications'
import { MedicosView } from './modules/visitador/views/Medicos/Medicos'

type View = 'login' | 'forgot-password' | 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

function App() {
  const [view, setView] = useState<View>('login')

  const handleNavigate = (v: View) => setView(v)
  const handleLogout = () => setView('login')
  const handleLogin = () => setView('home')

  if (view === 'login') {
    return <LoginForm onLogin={handleLogin} onForgot={() => setView('forgot-password')} />
  }

  if (view === 'forgot-password') {
    return <ForgotPasswordView onBack={() => setView('login')} />
  }

  if (view === 'home') {
    return <VisitadorHome onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  if (view === 'registro') {
    return <VisitRegistrationView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  if (view === 'calendario') {
    return <CalendarView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  if (view === 'perfil') {
    return <ProfileView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  if (view === 'notificaciones') {
    return <NotificationsView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  if (view === 'medicos') {
    return <MedicosView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  }

  // Planificador placeholder
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <header style={{ height: 56, background: '#1B2A4E', color: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button onClick={() => setView('home')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 600 }}>Planificador</span>
      </header>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center', color: '#1B2A4E' }}>
        <h2>Planificador</h2>
        <p style={{ color: '#6b7a99' }}>Vista en construcción</p>
        <button onClick={() => setView('home')} style={{ marginTop: 16, background: '#F9B233', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Volver a Ruta del Día
        </button>
      </div>
    </div>
  )
}

export default App
