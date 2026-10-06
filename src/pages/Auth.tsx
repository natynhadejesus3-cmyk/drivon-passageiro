import { useMemo, useState } from "react";
import { Car, Eye, EyeOff, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignupWizard } from "@/components/auth/SignupWizard";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/error-messages";
import { readPendingInvite } from "@/lib/invite";
import { InviteBanner } from "./Invite";

/**
 * Entrar (formulário simples) ou criar conta (assistente em etapas, ver SignupWizard).
 *
 * `inviteTick` muda quando chega um convite novo (link tocado com o app aberto) -- relê o pendente.
 * `onHold`/`onRelease`: o assistente pede ao App pra NÃO trocar esta tela pelo app assim que a
 * conta nascer (ainda faltam a foto, o "tudo pronto" e o vídeo de boas-vindas).
 */
export function Auth({
  inviteTick = 0,
  onHold,
  onRelease,
}: {
  inviteTick?: number;
  onHold: () => void;
  onRelease: (opts?: { fade?: boolean }) => void;
}) {
  // Convite esperando (QR lido pela câmera): mostra de quem é e, depois do login, o app pareia sozinho.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendingInvite = useMemo(() => readPendingInvite(), [inviteTick]);
  // Quem chegou por um convite provavelmente ainda não tem conta: já abre no cadastro.
  const [mode, setMode] = useState<"signin" | "signup">(pendingInvite ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (mode === "signup") {
    return <SignupWizard onBackToLogin={() => setMode("signin")} onHold={onHold} onRelease={onRelease} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Car size={28} />
        </div>
        <h1 className="text-title">Drivon Passageiro</h1>
        <p className="text-center text-subtitle">Entre pra ver seus motoristas</p>
      </div>

      {pendingInvite && <InviteBanner code={pendingInvite} />}

      <form onSubmit={submit} className="card-elevated space-y-3 p-5">
        <div>
          <label className="text-label">E-mail</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-label">Senha</label>
          <div className="relative mt-1">
            <Input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {error && <p className="text-label text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center disabled:opacity-50">
          {loading ? "Aguarde..." : "Entrar"}
        </button>
      </form>

      {/* Quem ainda não tem conta não pode passar batido: botão de verdade, com contorno laranja,
          em vez de um link pequeno embaixo do formulário. */}
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[color:var(--color-hairline)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Novo por aqui?</span>
        <div className="h-px flex-1 bg-[color:var(--color-hairline)]" />
      </div>
      <button
        type="button"
        onClick={() => setMode("signup")}
        className="btn-outline mt-3 flex w-full items-center justify-center gap-2"
      >
        <UserPlus size={18} />
        Criar minha conta
      </button>
    </div>
  );
}
