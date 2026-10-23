import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DriverAvatar } from "../components/DriverAvatar";
import { VehicleBadges } from "../components/VehicleBadges";
import { formatLastSeen } from "@/lib/format";
import { useDriverProfile, useLink } from "@/lib/hooks";
import { getCachedDriverName, getDriverShareCode } from "@/lib/repository";
import { driverFirstName, driverShareMessage, driverShareUrl } from "@/lib/share-driver";

/** Perfil do motorista (toque nele dentro da conversa): dados dele e o QR para mostrar a um amigo. */
export function DriverProfile() {
  const { linkId = "" } = useParams();
  const navigate = useNavigate();
  const { link, loading } = useLink(linkId);
  const { profile } = useDriverProfile(link?.driver_id);
  const driverId = link?.driver_id;
  const [code, setCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let alive = true;
    setCodeLoading(true);
    getDriverShareCode(driverId)
      .then((c) => alive && setCode(c))
      .finally(() => alive && setCodeLoading(false));
    return () => {
      alive = false;
    };
  }, [driverId]);

  if (loading) return null;
  if (!link) {
    return (
      <div className="p-6 text-center text-label">
        Motorista não encontrado.
        <button onClick={() => navigate("/")} className="mt-3 block w-full font-bold text-primary">
          Voltar
        </button>
      </div>
    );
  }

  const name = profile?.full_name || getCachedDriverName(link.driver_id);
  const online = !!profile?.is_online;
  const url = driverShareUrl(code);
  const message = url ? driverShareMessage(name, url) : "";

  async function share() {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // a pessoa fechou a janela de compartilhar
    }
    await copyLink();
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copiado!");
    } catch {
      setNotice("Não consegui copiar. Segure o link para copiar.");
    }
    window.setTimeout(() => setNotice(null), 2500);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="flex items-center gap-3 border-b border-[color:var(--color-hairline)] px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="rounded-full p-1 text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <p className="font-bold">Perfil do motorista</p>
      </header>

      <div className="flex flex-col items-center px-6 pb-8 pt-6 text-center">
        <DriverAvatar name={name} avatarUrl={profile?.avatar_url} online={online} size={96} />
        <p className="mt-3 text-title">{name}</p>
        <div className="mt-2">
          <VehicleBadges vehicles={profile?.vehicle_types} size="md" />
        </div>
        <p className="mt-2 text-label">
          {online ? <span className="font-semibold text-success">Online agora</span> : formatLastSeen(profile?.last_seen_at)}
        </p>

        <div className="mt-8 w-full max-w-sm rounded-3xl border border-[color:var(--color-hairline)] bg-card-elevated p-5">
          <p className="font-bold">Compartilhar {driverFirstName(name)}</p>
          <p className="mt-1 text-label">
            Quem escanear baixa o app (se ainda não tiver) e já entra com este motorista, sem você passar o QR de novo.
          </p>

          {codeLoading ? (
            <p className="my-8 text-label">Carregando o QR…</p>
          ) : url ? (
            <>
              <div className="mx-auto my-5 w-fit rounded-2xl bg-white p-3">
                <QRCodeSVG value={url} size={200} level="M" />
              </div>
              <button
                onClick={share}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"
              >
                <Share2 size={18} /> Compartilhar
              </button>
              <button
                onClick={copyLink}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-hairline)] font-semibold"
              >
                <Copy size={16} /> Copiar link
              </button>
              {notice && <p className="mt-2 text-[13px] font-semibold text-success">{notice}</p>}
            </>
          ) : (
            <p className="my-6 text-label">O QR deste motorista ainda não está disponível. Tente de novo mais tarde.</p>
          )}
        </div>
      </div>
    </div>
  );
}
