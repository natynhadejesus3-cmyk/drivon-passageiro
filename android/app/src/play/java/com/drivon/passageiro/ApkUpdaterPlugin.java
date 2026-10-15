package com.drivon.passageiro;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * DRIVON — versão da PLAY STORE do atualizador: não faz nada.
 *
 * A Play Store proíbe que um app distribuído por ela se atualize por outro meio que não a própria Play. Quem
 * atualiza o app instalado pela Play é a Play. A versão que se instala por arquivo (flavor "sideload") tem o
 * atualizador de verdade em src/sideload/.... O site só precisa saber que aqui NÃO deve oferecer atualização.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

  @PluginMethod
  public void status(PluginCall call) {
    JSObject r = new JSObject();
    r.put("supported", false);
    r.put("canInstall", false);
    call.resolve(r);
  }

  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    call.reject("A atualização é feita pela Play Store.");
  }

  @PluginMethod
  public void download(PluginCall call) {
    call.reject("A atualização é feita pela Play Store.");
  }

  @PluginMethod
  public void install(PluginCall call) {
    call.reject("A atualização é feita pela Play Store.");
  }
}
