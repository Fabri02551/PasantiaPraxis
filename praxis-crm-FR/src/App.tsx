import { useEffect, useState } from 'react'
import { storage } from './modules/core/lib/storage'
import { Toast } from './modules/core/components/Toast/Toast'
import { LoginForm } from './modules/auth/views/Login/Login'
import { ForgotPasswordView } from './modules/auth/views/ForgotPassword/ForgotPassword'
import { ResetPasswordView } from './modules/auth/views/ResetPassword/ResetPassword'
import { VisitadorHome } from './modules/visitador/views/Home/Home'
import { VisitRegistrationView } from './modules/visitador/views/VisitRegistration/VisitRegistration'
import { CalendarView } from './modules/visitador/views/Calendar/Calendar'
import { ProfileView } from './modules/visitador/views/Profile/Profile'
import { NotificationsView } from './modules/visitador/views/Notifications/Notifications'
import { MedicosView } from './modules/visitador/views/Medicos/Medicos'
import { InstitucionesView } from './modules/visitador/views/Instituciones/Instituciones'
import { AdminDashboard } from './modules/admin/views/Dashboard/Dashboard'
import { VisitadoresView } from './modules/admin/views/Visitadores/Visitadores'
import { AdministradoresView } from './modules/admin/views/Administradores/Administradores'
import { GraficosView } from './modules/admin/views/Graficos/Graficos'
import { LaboratoriosView } from './modules/admin/views/Laboratorios/Laboratorios'
import { CalendarAdminView } from './modules/admin/views/CalendarAdmin/CalendarAdmin'
import { InstitucionesView as InstitucionesAdminView } from './modules/admin/views/Instituciones/Instituciones'
import { MedicosAdminView } from './modules/admin/views/MedicosAdmin/MedicosAdmin'
import { EspecialidadesView } from './modules/admin/views/Especialidades/Especialidades'
import { AdminComentariosView } from './modules/admin/views/Comentarios/AdminComentarios'
import { VisitadorComentariosView } from './modules/visitador/views/Comentarios/Comentarios'
import { PlanificadorView } from './modules/visitador/views/Planificador/Planificador'
import { HistorialView } from './modules/visitador/views/Historial/Historial'
import { CarteraView } from './modules/visitador/views/Cartera/Cartera'
import { CompletarVisitaView, type VisitaACompletar } from './modules/visitador/views/CompletarVisita/CompletarVisita'
import type { AdminView } from './modules/admin/components/AdminSidebar/AdminSidebar'

type View =
  | 'login'
  | 'forgot-password'
  | 'reset-password'
  | 'home'
  | 'registro'
  | 'calendario'
  | 'planificador'
  | 'perfil'
  | 'notificaciones'
  | 'medicos'
  | 'instituciones'
  | 'comentarios'
  | 'historial'
  | 'cartera'
  | 'completar-visita'
  | AdminView

function App() {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('token')) return 'reset-password'
    }
    const role = storage.getRole()
    const token = storage.getToken()
    if (token && role === 'admin') return 'admin-dashboard'
    if (token && role === 'visitador') return 'home'
    return 'login'
  })
  const [pendingVisita, setPendingVisita] = useState<VisitaACompletar | null>(null)
  const [sessionToast, setSessionToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleNavigate = (v: View) => setView(v)
  const handleLogout = () => {
    storage.clear()
    setPendingVisita(null)
    setView('login')
  }
  const handleLogin = (role: 'admin' | 'visitador') => {
    setSessionToast({ msg: `Sesión iniciada`, type: 'success' })
    setTimeout(() => setSessionToast(null), 3500)
    if (role === 'admin') setView('admin-dashboard')
    else setView('home')
  }
  const handleCompletarVisita = (visita: VisitaACompletar) => {
    setPendingVisita(visita)
    setView('completar-visita')
  }

  // La ubicación se pide UNA vez por sesión: al entrar al home (tras el login o
  // al restaurar la sesión). El permiso del navegador ya está concedido de la
  // primera vez, así que en los accesos siguientes no vuelve a preguntar: la
  // lectura se refresca en silencio y se guarda en storage. De ahí la leen el
  // mapa del inicio (pin "usted está aquí") y el alta de médicos (ubicación
  // nueva nacida cerca de quien la crea).
  useEffect(() => {
    if (view !== 'home') return
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const esFinita = (n: number) => Number.isFinite(n)
        if (!esFinita(pos.coords.latitude) || !esFinita(pos.coords.longitude)) return
        storage.setUbicacion({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precisionM: esFinita(pos.coords.accuracy) ? pos.coords.accuracy : null,
          tomadaEn: new Date(pos.timestamp).toISOString(),
        })
      },
      () => {
        /* sin permiso o sin señal: se sigue sin ubicación guardada */
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )
  }, [view])

  let content: React.ReactNode
  if (view === 'login') {
    content = <LoginForm onLogin={handleLogin} onForgot={() => setView('forgot-password')} />
  } else if (view === 'forgot-password') {
    content = <ForgotPasswordView onBack={() => setView('login')} />
  } else if (view === 'reset-password') {
    content = <ResetPasswordView onBack={() => setView('login')} />
  } else if (view === 'admin-dashboard') {
    content = <AdminDashboard currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-visitadores') {
    content = <VisitadoresView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-administradores') {
    content = <AdministradoresView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-graficos') {
    content = <GraficosView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-calendario') {
    content = <CalendarAdminView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-laboratorios') {
    content = <LaboratoriosView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-instituciones') {
    content = <InstitucionesAdminView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-medicos') {
    content = <MedicosAdminView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-especialidades') {
    content = <EspecialidadesView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'admin-comentarios') {
    content = <AdminComentariosView currentView={view} onNavigate={handleNavigate} onLogout={handleLogout} />
  } else if (view === 'home') {
    content = <VisitadorHome onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} onCompletar={handleCompletarVisita} />
  } else if (view === 'registro') {
    content = <VisitRegistrationView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'calendario') {
    content = <CalendarView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} onCompletar={handleCompletarVisita} />
  } else if (view === 'perfil') {
    content = <ProfileView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'notificaciones') {
    content = <NotificationsView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'medicos') {
    content = <MedicosView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'instituciones') {
    content = <InstitucionesView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'comentarios') {
    content = <VisitadorComentariosView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'historial') {
    content = <HistorialView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'cartera') {
    content = <CarteraView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else if (view === 'completar-visita') {
    content = <CompletarVisitaView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} visita={pendingVisita} />
  } else if (view === 'planificador') {
    content = <PlanificadorView onNavigate={handleNavigate} currentView={view} onLogout={handleLogout} />
  } else {
    const isAdmin = view.startsWith('admin-')
    content = (
      <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
        <header style={{ height: 56, background: '#1B2A4E', color: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
          <button onClick={() => setView(isAdmin ? 'admin-dashboard' : 'home')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 600 }}>{isAdmin ? 'Admin' : 'Planificador'}</span>
        </header>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center', color: '#1B2A4E' }}>
          <h2>{isAdmin ? 'Vista Admin en construcción' : 'Planificador'}</h2>
          <p style={{ color: '#6b7a99' }}>Vista en construcción</p>
          <button onClick={() => setView(isAdmin ? 'admin-dashboard' : 'home')} style={{ marginTop: 16, background: '#F9B233', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {sessionToast && <Toast message={sessionToast.msg} type={sessionToast.type} onClose={() => setSessionToast(null)} />}
      {content}
    </>
  )
}

export default App
