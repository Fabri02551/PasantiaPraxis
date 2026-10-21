/// <reference types="@capgo/capacitor-updater" />
import type { CapacitorConfig } from '@capacitor/cli'

// Config de la app Android (iOS no aplica por ahora).
// Los assets son los del build de Vite (webDir dist); la app corre offline
// del nginx y llama a la API de producción con URL absoluta (ver .env.android,
// que se usa con `vite build --mode android`).
const config: CapacitorConfig = {
  appId: 'com.laboratoriopraxis.crm',
  appName: 'Praxis CRM',
  webDir: 'dist',
  server: {
    // https://localhost como origen de los assets: mantiene el contexto
    // "seguro" que exige la geolocalización del navegador.
    androidScheme: 'https',
  },
  plugins: {
    // Capgo live updates: la app busca actualizaciones del bundle JS en el
    // canal "production" al abrirse. Los updates OTA solo cambian la web;
    // lo nativo se actualiza por la tienda.
    CapacitorUpdater: {
      defaultChannel: 'production',
      autoUpdate: 'onLaunch',
    },
  },
}

export default config
