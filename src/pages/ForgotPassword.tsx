import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/error-messages";
import { RECOVERY_REDIRECT_URL, RESEND_SECONDS, isValidRecoveryCode, normalizeRecoveryCode } from "@/lib/recovery";
import { verifyRecoveryCode } from "@/lib/recovery-actions";
import { isValidEmail } from "@/lib/signup";

/**
 * "Esqueci minha senha": pede o e-mail e manda o e-mail de recuperação (botão que abre o app +
 * código de números). O texto de confirmação é sempre o mesmo, exista a conta ou não (não revela
 * quem tem cadastro). Quem toca no botão cai no app com a tela "Nova senha" (ver
 * pages/RecoveryLink.tsx); quem preferir digita o código aqui mesmo.
 */
export function ForgotPassword({ initialEmail = "", onBack }: { initialEmail?: string; onBack: () => void }) {
  const { startRecovery } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Segundos até poder pedir outro e-mail (evita apertar várias vezes e bater no limite do Supabase).
  const [wait, setWait] = useState(0);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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

  async function confirmCode(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    if (!isValidRecoveryCode(code)) {
      setCodeError("O código tem 6 números. Confira no e-mail.");
      return;
    }
    setCodeError(null);
    setCodeBusy(true);
    try {
      const session = await verifyRecoveryCode(sentTo, code);
      startRecovery(session); // o App troca esta tela pela "Nova senha"
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setCodeBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex h-full flex-col justify-center px-6 py-10">
        <div className="mb-5 flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
            <Mail size={28} />
          </div>
          <h1 className="text-title">Verifique sua caixa de entrada</h1>
        </div>

        {/* Aviso bem visível: o e-mail pode cair no Spam, e quem não olha lá acha que não chegou. */}
        <div className="rounded-2xl border-2 border-primary bg-primary-soft p-4">
          <p className="text-body">
            Se <b className="break-all">{sentTo}</b> tiver uma conta, o e-mail chega em até 1 minuto.
          </p>
          <div className="mt-3 rounded-xl bg-black/25 p-3">
            <p className="text-body font-bold text-primary">Não chegou? Olhe a pasta Spam.</p>
            <p className="mt-1 text-label">
              Procure por <b>Drivon</b> no <b>Spam</b> (ou Lixo eletrônico) e em <b>Promoções</b>. Se estiver lá, abra o e-mail e toque em <b>“Não é spam”</b>.
            </p>
          </div>
        </div>

        <div className="card-elevated mt-3 space-y-2 p-5 text-label">
          <p className="font-semibold">Depois que abrir o e-mail:</p>
          <p>1. Toque em “Criar nova senha”.</p>
          <p>2. Toque em “Abrir no aplicativo” e escolha a senha nova.</p>
          <p className="pt-1 opacity-70">O link vale por pouco tempo e só pode ser usado uma vez.</p>
        </div>

        <form onSubmit={confirmCode} className="card-elevated mt-3 space-y-2 p-5">
          <label className="text-label">O botão não abriu o app? Digite aqui o código do e-mail:</label>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            value={code}
            onChange={(e) => {
              setCode(normalizeRecoveryCode(e.target.value));
              setCodeError(null);
            }}
            placeholder="123456"
            className="text-center text-lg tracking-[0.3em]"
          />
          {codeError && <p className="text-label text-destructive">{codeError}</p>}
          <button
            type="submit"
            disabled={codeBusy || code.length < 6}
            className="btn-outline flex w-full items-center justify-center disabled:opacity-50"
          >
            {codeBusy ? "Conferindo..." : "Usar este código"}
          </button>
        </form>

        {error && <p className="mt-3 text-center text-label text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || wait > 0}
          className="btn-outline-neutral mt-3 flex w-full items-center justify-center disabled:opacity-50"
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
