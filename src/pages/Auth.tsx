import { useState } from "react";
import { Car, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      setError(err instanceof Error ? err.message : "Não foi possível continuar. Tente de novo.");
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
              minLength={6}
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
