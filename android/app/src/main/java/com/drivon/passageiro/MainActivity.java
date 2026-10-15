package com.drivon.passageiro;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Atualizador do próprio APK (ver ApkUpdaterPlugin; a versão da Play Store só diz "não suportado").
    // Plugins próprios precisam ser registrados ANTES do super.onCreate.
    registerPlugin(ApkUpdaterPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
