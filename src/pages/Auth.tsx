import { useMemo, useState } from "react";
import { Car, Eye, EyeOff, UserPlus } from "lucide-react";
import { SignupWizard } from "@/components/auth/SignupWizard";
import { LegalConsent } from "@/components/LegalConsent";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/error-messages";
import { readPendingInvite } from "@/lib/invite";
import { loginWithIdentifier } from "@/lib/passenger-login";
import { isValidEmail } from "@/lib/signup";
import { ForgotPassword } from "./ForgotPassword";
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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(pendingInvite ? "signup" : "signin");
  // @usuário (o mesmo do app do motorista) ou e-mail.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (mode === "forgot") {
    return (
      <ForgotPassword
        // Se a pessoa já digitou o e-mail no login, ele vem preenchido.
        initialEmail={isValidEmail(identifier) ? identifier.trim() : ""}
        onBack={() => setMode("signin")}
      />
    );
  }

  if (mode === "signup") {
    return (
      <SignupWizard
        // Se o e-mail já tinha conta, o assistente devolve pro login com ele preenchido.
        onBackToLogin={(existingEmail) => {
          if (existingEmail) setIdentifier(existingEmail);
          setMode("signin");
        }}
        onHold={onHold}
        onRelease={onRelease}
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Mesma conta dos dois apps: entra com o @usuário do motorista ou com o e-mail.
      await loginWithIdentifier(identifier, password);
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
          <label className="text-label">Usuário ou e-mail</label>
          <Input
            type="text"
            required
            // Aceita o @usuário do app do motorista (não é e-mail, por isso NÃO é type="email").
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="seu_usuario ou voce@email.com"
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
              {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
          </div>
        </div>

        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("forgot");
            }}
            className="py-1.5 text-[13px] font-medium text-primary"
          >
            Esqueci minha senha
          </button>
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

      <LegalConsent lead="Ao continuar" className="mt-4 px-2 text-center" />
    </div>
  );
}
