package com.laboratoriopraxis.crm;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String TAG = "AppUpdatePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo pInfo = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", pInfo.versionName != null ? pInfo.versionName : "1.0.0");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("versionCode", pInfo.getLongVersionCode());
            } else {
                ret.put("versionCode", (long) pInfo.versionCode);
            }
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error obteniendo version de la app", e);
            call.reject("Error al obtener la versión: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("canInstall", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error abriendo configuracion de permisos", e);
            call.reject("No se pudo abrir la configuración: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("URL del APK requerida");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            InputStream in = null;
            FileOutputStream out = null;
            try {
                Log.i(TAG, "Iniciando descarga de actualización desde: " + downloadUrl);

                String currentUrl = downloadUrl;
                int redirects = 0;
                while (redirects < 6) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile)");
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);

                    int responseCode = conn.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                        responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                        responseCode == 307 || responseCode == 308) {
                        currentUrl = conn.getHeaderField("Location");
                        conn.disconnect();
                        redirects++;
                        Log.i(TAG, "Redirigiendo descarga (" + redirects + ") a: " + currentUrl);
                    } else {
                        break;
                    }
                }

                if (conn == null || conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    int code = conn != null ? conn.getResponseCode() : -1;
                    throw new Exception("HTTP error al descargar APK: " + code);
                }

                long totalBytes = conn.getContentLength();
                in = conn.getInputStream();

                File destDir = getContext().getExternalFilesDir(null);
                if (destDir == null) {
                    destDir = getContext().getCacheDir();
                }
                File apkFile = new File(destDir, "praxis-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                out = new FileOutputStream(apkFile);
                byte[] buffer = new byte[8192];
                long bytesRead = 0;
                int read;
                int lastPercent = -1;

                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    bytesRead += read;
                    if (totalBytes > 0) {
                        int percent = (int) ((bytesRead * 100) / totalBytes);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("bytesRead", bytesRead);
                            progress.put("totalBytes", totalBytes);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                }
                out.flush();
                out.close();
                out = null;
                in.close();
                in = null;

                Log.i(TAG, "Descarga completada (" + bytesRead + " bytes). Lanzando instalador...");

                // Notificar 100%
                JSObject completed = new JSObject();
                completed.put("percent", 100);
                completed.put("bytesRead", bytesRead);
                completed.put("totalBytes", bytesRead);
                notifyListeners("downloadProgress", completed);

                // Lanzar instalador
                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                getContext().startActivity(intent);

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("filePath", apkFile.getAbsolutePath());
                call.resolve(res);

            } catch (Exception e) {
                Log.e(TAG, "Error descargando o instalando APK", e);
                call.reject("Error en la actualización: " + e.getMessage());
            } finally {
                try {
                    if (out != null) out.close();
                    if (in != null) in.close();
                    if (conn != null) conn.disconnect();
                } catch (Exception ignored) {}
            }
        });
    }
}
