import { useMemo, useState } from "react";
import { Car, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/error-messages";
import { readPendingInvite } from "@/lib/invite";
import { InviteBanner } from "./Invite";

/** `inviteTick` muda quando chega um convite novo (link tocado com o app aberto) -- relê o pendente. */
export function Auth({ inviteTick = 0 }: { inviteTick?: number }) {
  // Convite esperando (QR lido pela câmera): mostra de quem é e, depois do login, o app pareia sozinho.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendingInvite = useMemo(() => readPendingInvite(), [inviteTick]);
  const [mode, setMode] = useState<"signin" | "signup">(pendingInvite ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        // E-mail de caixa temporária (ex.: hudzer.com) não é aceito: pergunta ao
        // banco ANTES de enviar o cadastro, pra dar uma mensagem clara. Se a
        // pergunta falhar (sem rede, função ainda não criada) segue normal -- o
        // banco também barra na hora de criar a conta.
        try {
          const { data: temporary } = await supabase.rpc("is_disposable_email", { p_email: email.trim() });
          if (temporary === true) {
            setError("Esse tipo de e-mail temporário não é aceito. Use o seu e-mail pessoal (Gmail, Outlook, etc.).");
            return;
          }
        } catch {
          /* o banco confere de novo ao criar a conta */
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { user_type: "passenger", display_name: name || undefined },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      // Traduz os erros do Supabase (inclusive o gatilho que barra e-mail temporário,
      // que volta como "Database error saving new user").
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
        <p className="text-center text-subtitle">
          {mode === "signup" ? "Crie sua conta pra parear com seus motoristas" : "Entre pra ver seus motoristas"}
        </p>
      </div>

      {pendingInvite && <InviteBanner code={pendingInvite} />}

      <form onSubmit={submit} className="card-elevated space-y-3 p-5">
        {mode === "signup" && (
          <div>
            <label className="text-label">Seu nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como o motorista vai te ver"
              className="mt-1"
            />
          </div>
        )}
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
              // 8+ só no cadastro (igual ao app do motorista). No login NÃO: quem já tem senha de 6 ou 7 não pode ficar travado.
              minLength={mode === "signup" ? 8 : undefined}
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
          {loading ? "Aguarde..." : mode === "signup" ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <button
        onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
        className="mt-4 text-center text-label font-semibold text-primary"
      >
        {mode === "signup" ? "Já tenho conta — entrar" : "Ainda não tenho conta — criar"}
      </button>
    </div>
  );
}
