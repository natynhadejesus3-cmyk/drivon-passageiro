import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/AppShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hasPasswordLogin, requestAccountDeletion, setFlash } from "@/lib/delete-account";

/**
 * Excluir minha conta. Apaga a conta e os dados do passageiro; como a conta é a mesma do
 * Drivon Motorista, ela some dos dois apps. A exclusão em si é no servidor (lib/delete-account.ts).
 */
export function DeleteAccount() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  const withPassword = hasPasswordLogin(session.user);
  const missing = withPassword ? "Digite sua senha para confirmar." : "Digite o e-mail da sua conta para confirmar.";

  async function confirmDelete() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const res = await requestAccountDeletion({
      accessToken: session.access_token,
      password: withPassword ? secret : undefined,
      confirmEmail: withPassword ? undefined : secret,
    });
    if (!res.ok) {
      setBusy(false);
      setSure(false);
      setError(res.error);
      return;
    }
    // A conta já não existe: limpa o que ficou neste aparelho. Ao perder a sessão, o app volta
    // sozinho pra tela de entrada, que mostra o aviso guardado aqui.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* a sessão some do mesmo jeito quando o token deixa de valer */
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* sem armazenamento: nada a limpar */
    }
    setFlash("Sua conta foi excluída.");
    navigate("/", { replace: true });
  }

  return (
    <div>
      <ScreenHeader title="Excluir minha conta" back />

      <div className="space-y-5 px-5 pb-10">
        <p className="text-body">
          Isso apaga sua conta e o que está ligado a ela: perfil, conversas e conexões com motoristas, pedidos e lembretes.
          Não dá para desfazer.
        </p>
        <p className="text-label">
          A conta é a mesma no Drivon Passageiro e no Drivon Motorista, então ela some dos dois.
        </p>

        <div>
          <label className="text-label">{withPassword ? "Digite sua senha para confirmar" : "Digite o e-mail da sua conta para confirmar"}</label>
          <div className="relative mt-1">
            <Input
              type={withPassword && !show ? "password" : "text"}
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setError(null);
              }}
              autoComplete={withPassword ? "current-password" : "email"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={withPassword ? "Sua senha" : "voce@email.com"}
              className={withPassword ? "pr-11" : ""}
            />
            {withPassword && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
                aria-label={show ? "Esconder senha" : "Mostrar senha"}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground"
              >
                {/* O desenho mostra o estado: escondida = olho riscado; aparecendo = olho aberto. */}
                {show ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-label text-destructive">{error}</p>}
        </div>

        {sure ? (
          <div>
            <p className="text-body font-semibold text-destructive">Tem certeza? A conta será apagada agora.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSure(false)} disabled={busy} className="btn-outline-neutral flex items-center justify-center disabled:opacity-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy}
                className="flex h-12 items-center justify-center rounded-2xl bg-destructive text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!secret.trim()) {
                setError(missing);
                return;
              }
              setSure(true);
            }}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-destructive/15 text-sm font-bold text-destructive active:bg-destructive/20"
          >
            Excluir minha conta
          </button>
        )}

        <p className="text-center text-label opacity-70">Prefere pedir por e-mail? Escreva para jhugd925@gmail.com.</p>
      </div>
    </div>
  );
}
