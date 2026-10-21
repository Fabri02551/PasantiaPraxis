import React, { useEffect, useState, useCallback } from 'react'
import { autoUpdateService, type UpdateInfo } from '../../services/autoUpdate.service'
import './AutoUpdater.css'

export const AutoUpdater: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [status, setStatus] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    // Solo se ejecuta en dispositivo Android nativo
    if (!autoUpdateService.isAndroid()) return

    const info = await autoUpdateService.checkUpdate()
    if (info && info.hasUpdate) {
      setUpdateInfo(info)
      // Iniciar descarga automáticamente al detectar la nueva versión
      startDownload(info)
    }
  }, [])

  useEffect(() => {
    check()
    // Chequear al reanudar la ventana o cada 15 minutos
    const interval = setInterval(check, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [check])

  const startDownload = async (info: UpdateInfo) => {
    setStatus('downloading')
    setProgress(0)
    setErrorMsg('')

    try {
      await autoUpdateService.downloadAndInstall(info.apkUrl, info.latestVersion, (p) => {
        setProgress(p)
      })
      setStatus('installing')
    } catch (err) {
      console.error('[AutoUpdater] Error en descarga o instalación', err)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  if (!updateInfo || dismissed || !updateInfo.hasUpdate) {
    return null
  }

  return (
    <div className="autoupdate-overlay">
      <div className="autoupdate-modal" role="dialog" aria-modal="true">
        <div className="autoupdate-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        <div>
          <h3 className="autoupdate-title">Actualización Disponible</h3>
          <div className="autoupdate-badge-wrap">
            <span className="autoupdate-badge-curr">v{updateInfo.currentVersion}</span>
            <span className="autoupdate-badge-arrow">→</span>
            <span className="autoupdate-badge-new">{updateInfo.latestVersion}</span>
          </div>
        </div>

        <p className="autoupdate-desc">
          {status === 'downloading'
            ? 'Descargando la versión más reciente desde GitHub Releases…'
            : status === 'installing'
            ? 'Descarga completa. Abriendo el instalador de Android…'
            : status === 'error'
            ? `Hubo un inconveniente al actualizar: ${errorMsg}`
            : 'Hay una nueva versión de la aplicación disponible con mejoras y correcciones.'}
        </p>

        {status === 'downloading' && (
          <div className="autoupdate-progress-box">
            <div className="autoupdate-progress-bar">
              <div className="autoupdate-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="autoupdate-progress-txt">
              <span>Descargando APK</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        <div className="autoupdate-actions">
          {status === 'idle' && (
            <button
              className="autoupdate-btn-primary"
              onClick={() => startDownload(updateInfo)}
            >
              Actualizar Ahora
            </button>
          )}

          {status === 'downloading' && (
            <button className="autoupdate-btn-primary" disabled>
              <span className="autoupdate-spinner" />
              Descargando ({progress}%)…
            </button>
          )}

          {status === 'installing' && (
            <button
              className="autoupdate-btn-primary"
              onClick={() => startDownload(updateInfo)}
            >
              Reabrir Instalador
            </button>
          )}

          {status === 'error' && (
            <button
              className="autoupdate-btn-primary"
              onClick={() => startDownload(updateInfo)}
            >
              Reintentar Descarga
            </button>
          )}

          {status !== 'downloading' && (
            <button
              className="autoupdate-btn-secondary"
              onClick={() => setDismissed(true)}
            >
              Recordar más tarde
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
