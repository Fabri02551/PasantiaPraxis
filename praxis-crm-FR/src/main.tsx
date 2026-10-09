import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App as CapacitorApp } from '@capacitor/app'
import './index.css'
import App from './App.tsx'

// Capgo: avisa al plugin nativo que el JS arrancó bien. Si no llega este
// aviso dentro del timeout (10s), el updater tira rollback a la versión
// anterior — red de seguridad ante un bundle OTA roto.
CapacitorUpdater.notifyAppReady()

// Deep link: cuando Android abre la app con una URL (ej. el mail de
// reset-password), recarga el bundle con esa ruta/token — App.tsx detecta
// ?token= y muestra la vista de restablecer contraseña.
CapacitorApp.addListener('appUrlOpen', ({ url }) => {
  try {
    const u = new URL(url)
    if (u.pathname.startsWith('/reset-password') && u.searchParams.get('token')) {
      window.location.href = `${u.pathname}${u.search}`
    }
  } catch {
    // URL inválida: se ignora y queda la vista normal.
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
