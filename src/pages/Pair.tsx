import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Html5Qrcode } from "html5-qrcode";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { extractPairCode, pairWithDriver } from "@/lib/repository";

const READER_ID = "qr-reader";

export function Pair() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [pairing, setPairing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    async function startScanning() {
      // Inside the Android WebView, getUserMedia only succeeds once the OS
      // permission is granted — triggering the native prompt here (instead
      // of relying on the WebView to ask) is what makes camera scanning work
      // in the APK, not just in a regular mobile browser.
      if (Capacitor.isNativePlatform()) {
        try {
          await Camera.requestPermissions({ permissions: ["camera"] });
        } catch {
          // ignore — Html5Qrcode.start() below will surface the failure
        }
      }
      if (cancelled) return;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 260 },
          (decodedText) => handlePayload(decodedText),
          () => {},
        )
        .then(() => !cancelled && setScanning(true))
        .catch(() => {
          if (cancelled) return;
          setScanning(false);
          setCameraError("Não foi possível acessar a câmera. Use o código manual abaixo.");
        });
    }
    startScanning();

    return () => {
      cancelled = true;
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePayload(raw: string) {
    if (handledRef.current) return;
    const code = extractPairCode(raw);
    if (!code) {
      setError("Código inválido. Peça para o motorista mostrar o QR Code dele no Drivon.");
      return;
    }
    handledRef.current = true;
    setPairing(true);
    setError(null);
    try {
      const displayName = (user?.user_metadata?.display_name as string | undefined) || undefined;
      const result = await pairWithDriver(code, displayName);
      navigate(`/chat/${result.link_id}`);
    } catch (err) {
      handledRef.current = false;
      setPairing(false);
      setError(err instanceof Error ? err.message : "Não foi possível parear com esse código.");
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 px-5 pb-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card"
        >
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold tracking-tight">Escanear código QR</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aponte a câmera para o QR Code na tela do motorista
          </p>
        </div>
      </header>

      <div className="qr-viewfinder relative mx-5 aspect-square overflow-hidden rounded-3xl bg-black">
        <div id={READER_ID} className="absolute inset-0 h-full w-full" />

        {!cameraError && (
          <div className="pointer-events-none absolute inset-0">
            <div className="qr-frame absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-2xl">
              <span className="qr-corner qr-corner-tl" />
              <span className="qr-corner qr-corner-tr" />
              <span className="qr-corner qr-corner-bl" />
              <span className="qr-corner qr-corner-br" />
              {scanning && <span className="qr-scanline" />}
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-label text-warning">{cameraError}</p>
          </div>
        )}

        {pairing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-label text-foreground">Pareando com o motorista...</p>
          </div>
        )}
      </div>

      {error && <p className="px-5 pt-3 text-center text-label text-destructive">{error}</p>}

      <div className="mt-6 space-y-3 px-5">
        <p className="section-label flex items-center gap-1.5">
          <Sparkles size={12} />
          Sem câmera?
        </p>
        <textarea
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Cole aqui o código do motorista (ex: DRIVON-PAIR:AB3D9FGHJK)"
          rows={2}
          className="w-full rounded-xl border border-[color:var(--color-hairline)] bg-card p-3.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => handlePayload(manualCode)}
          disabled={!manualCode.trim() || pairing}
          className="btn-primary flex w-full items-center justify-center disabled:opacity-40"
        >
          Parear com o código
        </button>
      </div>
    </div>
  );
}
