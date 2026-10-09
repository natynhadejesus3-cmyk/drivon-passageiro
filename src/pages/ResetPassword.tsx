import { useState, type FormEvent } from "react";
import { Car, Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-messages";
import { clearRecovery, validateNewPassword } from "@/lib/recovery";
import { strengthLabel } from "@/lib/signup";

/**
 * Tela "Nova senha": aparece no lugar do app quando a pessoa digita o código do e-mail de
 * "esqueci minha senha" (o código já abriu uma sessão de recuperação). `onDone` libera o app.
 */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      // Quem recupera a senha costuma ter perdido o controle da conta: derruba as outras sessões
      // abertas (a senha antiga já não vale). Não é crítico, então uma falha aqui não atrapalha.
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        /* segue */
      }
      // Trocou: se recarregar a página agora, entra direto no app (não pede a senha de novo).
      clearRecovery();
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex h-full flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
            <Check size={30} />
          </div>
          <h1 className="text-title">Senha alterada!</h1>
          <p className="text-center text-subtitle">Pronto. Já pode usar a senha nova.</p>
        </div>
        <button type="button" onClick={onDone} className="btn-primary flex w-full items-center justify-center">
          Continuar
        </button>
      </div>
    );
  }

  const strength = strengthLabel(password);

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Car size={28} />
        </div>
        <h1 className="text-title">Crie uma senha nova</h1>
        <p className="text-center text-subtitle">Escolha uma senha que você não use em outro lugar.</p>
      </div>

      <form onSubmit={submit} className="card-elevated space-y-3 p-5">
        <div>
          <label className="text-label">Senha nova</label>
          <div className="relative mt-1">
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Pelo menos 8 caracteres"
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
          {strength && <p className="mt-1 text-label opacity-70">Força: {strength}</p>}
        </div>
        <div>
          <label className="text-label">Repita a senha nova</label>
          <div className="relative mt-1">
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              placeholder="Digite de novo"
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

        {error && <p className="text-label text-destructive">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary flex w-full items-center justify-center disabled:opacity-50">
          {busy ? "Salvando..." : "Salvar senha nova"}
        </button>
      </form>
    </div>
  );
}
