import { LogOut, QrCode, Unlink } from "lucide-react";
import { Link } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { DriverAvatar } from "../components/DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import { getCachedDriverName, unlinkDriver } from "@/lib/repository";
import { useLinks } from "@/lib/hooks";

export function Home() {
  const { links, loading, refetch } = useLinks();

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
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sair"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card text-muted-foreground"
          >
            <LogOut size={18} />
          </button>
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
              <Link
                key={link.id}
                to={`/chat/${link.id}`}
                className={`flex items-center gap-3 p-4 active:bg-card ${
                  i !== links.length - 1 ? "border-b border-[color:var(--color-hairline)]" : ""
                }`}
              >
                <DriverAvatar name={getCachedDriverName(link.driver_id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{getCachedDriverName(link.driver_id)}</p>
                  <p className="truncate text-label">
                    Pareado em {new Date(link.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={(e) => handleUnlink(e, link.id)}
                  title="Desconectar"
                  className="shrink-0 rounded-full p-2 text-muted-foreground"
                >
                  <Unlink size={16} />
                </button>
              </Link>
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
