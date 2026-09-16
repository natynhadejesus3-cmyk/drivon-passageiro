import { LogOut, QrCode, Unlink, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { DriverAvatar } from "../components/DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatLastSeen } from "@/lib/format";
import { useDriverProfile, useLinks } from "@/lib/hooks";
import { getCachedDriverName, getMyPassengerProfile, unlinkDriver } from "@/lib/repository";
import type { DriverPassengerLink } from "@/integrations/supabase/types";

export function Home() {
  const { links, loading, refetch } = useLinks();
  const { user } = useAuth();
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getMyPassengerProfile(user.id)
      .then((p) => setMyAvatar(p?.avatar_url ?? null))
      .catch(() => {});
  }, [user?.id]);

  async function handleUnlink(e: React.MouseEvent, linkId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Desconectar desse motorista? Você vai precisar escanear o QR de novo pra falar com ele.")) return;
    await unlinkDriver(linkId);
    refetch();
  }

  return (
    <div>
      <ScreenHeader
        title="Meus motoristas"
        subtitle={links.length > 0 ? `${links.length} cadastrado${links.length > 1 ? "s" : ""}` : undefined}
        right={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/profile"
              title="Meu perfil"
              className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-[color:var(--color-hairline)] bg-card text-muted-foreground"
            >
              {myAvatar ? (
                <img src={myAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User size={18} />
              )}
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Sair"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card text-muted-foreground"
            >
              <LogOut size={18} />
            </button>
          </div>
        }
      />

      <div className="space-y-2 px-5">
        {!loading && links.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center text-muted-foreground">
            <QrCode size={40} />
            <p className="text-body">Você ainda não tem motoristas cadastrados.</p>
            <Link to="/pair" className="btn-primary mt-2 flex items-center px-5">
              Adicionar motorista
            </Link>
          </div>
        )}

        {links.length > 0 && (
          <div className="list-card">
            {links.map((link, i) => (
              <DriverRow
                key={link.id}
                link={link}
                last={i === links.length - 1}
                onUnlink={(e) => handleUnlink(e, link.id)}
              />
            ))}
          </div>
        )}
      </div>

      {links.length > 0 && (
        <div className="px-5 pb-6 pt-4">
          <Link
            to="/pair"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--color-hairline)] py-3.5 text-label font-semibold"
          >
            <QrCode size={16} />
            Adicionar outro motorista
          </Link>
        </div>
      )}
    </div>
  );
}

function DriverRow({
  link,
  last,
  onUnlink,
}: {
  link: DriverPassengerLink;
  last: boolean;
  onUnlink: (e: React.MouseEvent) => void;
}) {
  const { profile } = useDriverProfile(link.driver_id);
  const name = profile?.full_name || getCachedDriverName(link.driver_id);
  const online = profile?.is_online ?? false;

  return (
    <Link
      to={`/chat/${link.id}`}
      className={`flex items-center gap-3 p-4 active:bg-card ${
        !last ? "border-b border-[color:var(--color-hairline)]" : ""
      }`}
    >
      <DriverAvatar name={name} avatarUrl={profile?.avatar_url} online={online} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-label">
          {online ? <span className="text-success">Online agora</span> : formatLastSeen(profile?.last_seen_at)}
        </p>
      </div>
      <button onClick={onUnlink} title="Desconectar" className="shrink-0 rounded-full p-2 text-muted-foreground">
        <Unlink size={16} />
      </button>
    </Link>
  );
}
