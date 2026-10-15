package com.drivon.passageiro;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * DRIVON — atualizador do próprio APK (versão "sideload": a que se instala por arquivo, fora da Play Store).
 *
 * O Android NÃO deixa nenhum app se instalar escondido: a pessoa sempre confirma na tela do instalador. O que
 * este plugin faz é tirar todo o resto do caminho: baixar o APK novo, CONFERIR a impressão digital (SHA-256) e
 * abrir o instalador. O Android ainda confere por conta própria que o APK novo foi assinado com a MESMA chave
 * do app instalado (um APK de outra origem não instala por cima).
 *
 * Na versão da Play Store (flavor "play") este arquivo é outro (src/play/...): a Play proíbe app que se
 * atualiza por fora dela, então lá o plugin só responde "supported: false".
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

  private final ExecutorService io = Executors.newSingleThreadExecutor();

  /** Só se baixa de endereços do GitHub, por https (os APKs ficam nas Releases do GitHub). */
  private static boolean isAllowedUrl(String raw) {
    try {
      URL u = new URL(raw);
      return "https".equals(u.getProtocol()) && "github.com".equalsIgnoreCase(u.getHost());
    } catch (Exception e) {
      return false;
    }
  }

  private File updateFile() {
    File dir = new File(getContext().getCacheDir(), "updates");
    //noinspection ResultOfMethodCallIgnored
    dir.mkdirs();
    return new File(dir, "update.apk");
  }

  /** {supported, canInstall}: canInstall = o Android já deixa este app instalar APKs ("fontes desconhecidas"). */
  @PluginMethod
  public void status(PluginCall call) {
    JSObject r = new JSObject();
    r.put("supported", true);
    boolean can = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
        || getContext().getPackageManager().canRequestPackageInstalls();
    r.put("canInstall", can);
    call.resolve(r);
  }

  /** Abre a tela do Android onde a pessoa libera "instalar apps desta fonte" pro Drivon. */
  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    try {
      Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
      call.resolve();
    } catch (Exception e) {
      call.reject("Não foi possível abrir as configurações.");
    }
  }

  /** download({url, sha256}): baixa pro cache do app, conferindo o SHA-256. Avisa o andamento em "progress". */
  @PluginMethod
  public void download(final PluginCall call) {
    final String url = call.getString("url");
    final String expected = call.getString("sha256");
    if (url == null || !isAllowedUrl(url)) {
      call.reject("Endereço de atualização não permitido.");
      return;
    }
    if (expected == null || expected.length() != 64) {
      call.reject("Atualização sem impressão digital (SHA-256).");
      return;
    }
    io.execute(() -> {
      File out = updateFile();
      //noinspection ResultOfMethodCallIgnored
      out.delete();
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true); // o GitHub redireciona o download pra outro endereço https
        conn.setConnectTimeout(20_000);
        conn.setReadTimeout(30_000);
        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
          call.reject("O servidor respondeu " + code + " ao baixar a atualização.");
          return;
        }
        long total = conn.getContentLengthLong();
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        long done = 0;
        int lastPercent = -1;
        byte[] buf = new byte[64 * 1024];
        try (InputStream in = conn.getInputStream(); OutputStream fos = new FileOutputStream(out)) {
          int n;
          while ((n = in.read(buf)) > 0) {
            fos.write(buf, 0, n);
            sha.update(buf, 0, n);
            done += n;
            if (total > 0) {
              int percent = (int) (done * 100 / total);
              if (percent != lastPercent) {
                lastPercent = percent;
                JSObject p = new JSObject();
                p.put("percent", percent);
                notifyListeners("progress", p);
              }
            }
          }
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
        if (!hex.toString().equalsIgnoreCase(expected)) {
          //noinspection ResultOfMethodCallIgnored
          out.delete();
          call.reject("O arquivo baixado não confere (SHA-256). Tente de novo.");
          return;
        }
        JSObject r = new JSObject();
        r.put("bytes", done);
        call.resolve(r);
      } catch (Exception e) {
        //noinspection ResultOfMethodCallIgnored
        out.delete();
        call.reject("Falha ao baixar a atualização: " + e.getClass().getSimpleName());
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  /** Abre o instalador do Android com o APK já baixado e conferido. */
  @PluginMethod
  public void install(PluginCall call) {
    File apk = updateFile();
    if (!apk.exists() || apk.length() == 0) {
      call.reject("A atualização ainda não foi baixada.");
      return;
    }
    try {
      Context ctx = getContext();
      Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(uri, "application/vnd.android.package-archive");
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(intent);
      call.resolve();
    } catch (Exception e) {
      call.reject("Não foi possível abrir o instalador.");
    }
  }
}
