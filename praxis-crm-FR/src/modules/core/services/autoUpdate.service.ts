import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'

export interface AppUpdatePluginInterface {
  getAppVersion(): Promise<{ versionName: string; versionCode: number }>
  canRequestPackageInstalls(): Promise<{ canInstall: boolean }>
  openInstallPermissionSettings(): Promise<void>
  downloadAndInstall(options: { url: string; version: string }): Promise<{ success: boolean; filePath: string }>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: { percent: number; bytesRead: number; totalBytes: number }) => void
  ): Promise<PluginListenerHandle>
}

export const AppUpdate = registerPlugin<AppUpdatePluginInterface>('AppUpdate')

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  apkUrl: string
  releaseName: string
  releaseNotes: string
}

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Fabri02551/PasantiaPraxis/releases/latest'

/**
 * Compara dos versiones semver (ej: "1.0.6" vs "1.0.13").
 * Devuelve true si latest es mayor que current.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const cleanCurrent = current.replace(/^[vV]/, '').trim()
  const cleanLatest = latest.replace(/^[vV]/, '').trim()

  if (!cleanLatest) return false
  if (!cleanCurrent) return true

  const cParts = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0)
  const lParts = cleanLatest.split('.').map(n => parseInt(n, 10) || 0)

  const maxLen = Math.max(cParts.length, lParts.length)
  for (let i = 0; i < maxLen; i++) {
    const c = cParts[i] ?? 0
    const l = lParts[i] ?? 0
    if (l > c) return true
    if (l < c) return false
  }

  return false
}

export const autoUpdateService = {
  isAndroid: (): boolean => {
    return Capacitor.getPlatform() === 'android'
  },

  getCurrentVersion: async (): Promise<string> => {
    if (Capacitor.getPlatform() === 'android') {
      try {
        const info = await AppUpdate.getAppVersion()
        if (info?.versionName) return info.versionName
      } catch (err) {
        console.warn('[AutoUpdate] Error al obtener versión con AppUpdate', err)
      }
    }

    try {
      const appInfo = await App.getInfo()
      if (appInfo?.version) return appInfo.version
    } catch {
      // Ignorar fallback
    }

    return localStorage.getItem('praxis_app_version') || '1.0.0'
  },

  checkUpdate: async (): Promise<UpdateInfo | null> => {
    try {
      const response = await fetch(GITHUB_RELEASES_API, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!response.ok) {
        console.warn(`[AutoUpdate] GitHub API returned ${response.status}`)
        return null
      }

      const release = await response.json()
      const latestTag = release.tag_name || ''
      if (!latestTag) return null

      // Buscar asset APK en el release
      const assets = Array.isArray(release.assets) ? release.assets : []
      const apkAsset = assets.find(
        (a: { name: string; browser_download_url: string }) =>
          a.name.toLowerCase().endsWith('.apk')
      )

      if (!apkAsset || !apkAsset.browser_download_url) {
        console.warn('[AutoUpdate] El release no contiene ningún archivo .apk adjunto')
        return null
      }

      const currentVersion = await autoUpdateService.getCurrentVersion()
      const hasUpdate = isNewerVersion(currentVersion, latestTag)

      return {
        hasUpdate,
        currentVersion,
        latestVersion: latestTag,
        apkUrl: apkAsset.browser_download_url,
        releaseName: release.name || latestTag,
        releaseNotes: release.body || '',
      }
    } catch (err) {
      console.warn('[AutoUpdate] Error consultando releases de GitHub:', err)
      return null
    }
  },

  downloadAndInstall: async (
    apkUrl: string,
    version: string,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    let listener: PluginListenerHandle | null = null

    try {
      if (onProgress) {
        listener = await AppUpdate.addListener('downloadProgress', (data) => {
          onProgress(data.percent)
        })
      }

      await AppUpdate.downloadAndInstall({ url: apkUrl, version })
      localStorage.setItem('praxis_app_version', version.replace(/^[vV]/, ''))
    } finally {
      if (listener) {
        await listener.remove()
      }
    }
  },
}
