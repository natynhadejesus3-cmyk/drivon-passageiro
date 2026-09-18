import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calendar, Home, QrCode, User } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Motoristas" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/pair", icon: QrCode, label: "Parear" },
  { to: "/profile", icon: User, label: "Perfil" },
] as const;

/**
 * Structural shell: full-height flex column so the bottom nav sits in normal
 * flow, never overlapping content. Only the <main> scrolls.
 */
export function AppShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const loc = useLocation();
  return (
    <div className="phone-shell flex h-[100svh] max-h-[100svh] flex-col overflow-hidden supports-[height:100dvh]:h-dvh supports-[height:100dvh]:max-h-dvh">
      <main
        className="screen-anim min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: hideNav ? "env(safe-area-inset-bottom, 0px)" : "16px" }}
      >
        {children}
      </main>

      {!hideNav && (
        <nav
          className="z-40 shrink-0 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-card)]/95 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ul className="grid grid-cols-4">
            {items.map(({ to, icon: Icon, label }) => {
              const active = loc.pathname === to;
              return (
                <li key={to} className="flex justify-center py-2">
                  <Link
                    to={to}
                    className={`flex w-16 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors ${
                      active ? "bg-primary-soft" : ""
                    }`}
                  >
                    <Icon
                      className={`h-[21px] w-[21px] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    <span
                      className={`text-nav font-semibold leading-none tracking-wide transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function ScreenHeader({
  title,
  right,
  back,
  subtitle,
}: {
  title: string;
  right?: ReactNode;
  back?: boolean;
  subtitle?: string;
}) {
  const navigate = useNavigate();
  const backCls =
    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card text-base";
  return (
    <header className="flex items-center gap-3 px-5 pb-5 pt-6">
      {back && (
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className={backCls}>
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
