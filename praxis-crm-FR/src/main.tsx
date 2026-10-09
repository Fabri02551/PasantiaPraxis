import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import './index.css'
import App from './App.tsx'

// Capgo: avisa al plugin nativo que el JS arrancó bien. Si no llega este
// aviso dentro del timeout (10s), el updater tira rollback a la versión
// anterior — red de seguridad ante un bundle OTA roto.
CapacitorUpdater.notifyAppReady()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
