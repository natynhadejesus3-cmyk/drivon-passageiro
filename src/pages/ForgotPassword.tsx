import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-messages";
import { RECOVERY_REDIRECT_URL, RESEND_SECONDS } from "@/lib/recovery";
import { isValidEmail } from "@/lib/signup";

/**
 * "Esqueci minha senha": pede o e-mail e manda o link de recuperação. O texto de confirmação é
 * sempre o mesmo, exista a conta ou não (não revela quem tem cadastro). Quem toca no link cai no
 * app com a tela "Nova senha" (ver auth-context.tsx e pages/ResetPassword.tsx).
 */
export function ForgotPassword({ initialEmail = "", onBack }: { initialEmail?: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Segundos até poder pedir outro e-mail (evita apertar várias vezes e bater no limite do Supabase).
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const target = email.trim();
    if (!isValidEmail(target)) {
      setError("Esse e-mail não parece certo.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: RECOVERY_REDIRECT_URL });
      if (err) throw err;
      setSentTo(target);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex h-full flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
            <Mail size={28} />
          </div>
          <h1 className="text-title">Confira seu e-mail</h1>
          <p className="text-center text-subtitle">
            Se <b className="break-all">{sentTo}</b> tiver uma conta, o link para criar uma senha nova chega em instantes.
          </p>
        </div>

        <div className="card-elevated space-y-2 p-5 text-label">
          <p>1. Abra o e-mail e toque no link.</p>
          <p>2. Escolha a senha nova.</p>
          <p>3. Volte aqui e entre com ela.</p>
          <p className="pt-1 opacity-70">Não chegou? Olhe a caixa de spam. O link vale por pouco tempo.</p>
        </div>

        {error && <p className="mt-3 text-center text-label text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || wait > 0}
          className="btn-outline mt-4 flex w-full items-center justify-center disabled:opacity-50"
        >
          {busy ? "Enviando..." : wait > 0 ? `Enviar de novo em ${wait}s` : "Enviar de novo"}
        </button>
        <button type="button" onClick={onBack} className="btn-primary mt-3 flex w-full items-center justify-center">
          Voltar para entrar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1 self-start py-2 text-label text-muted-foreground"
      >
        <ArrowLeft size={16} />
        Voltar
      </button>

      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Mail size={28} />
        </div>
        <h1 className="text-title">Esqueci minha senha</h1>
        <p className="text-center text-subtitle">Digite o e-mail da sua conta e enviamos um link pra criar uma senha nova.</p>
      </div>

      <form onSubmit={send} className="card-elevated space-y-3 p-5">
        <div>
          <label className="text-label">E-mail</label>
          <Input
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="voce@email.com"
            className="mt-1"
          />
        </div>

        {error && <p className="text-label text-destructive">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary flex w-full items-center justify-center disabled:opacity-50">
          {busy ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </div>
  );
}
