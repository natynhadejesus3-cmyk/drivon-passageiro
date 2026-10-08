import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearRecovery, isRecoveryPending, markRecovery } from "@/lib/recovery";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Abriu pelo link de "esqueci minha senha": o app mostra "Nova senha" até a pessoa trocar. */
  recovery: boolean;
  finishRecovery: () => void;
};

const AuthCtx = createContext<Ctx>({
  session: null,
  user: null,
  loading: true,
  recovery: false,
  finishRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Já nasce certo quando o app abriu pelo link do e-mail (client.ts anotou antes do Supabase ler).
  const [recovering, setRecovering] = useState(() => isRecoveryPending());

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        markRecovery();
        setRecovering(true);
      } else if (event === "SIGNED_OUT") {
        clearRecovery();
        setRecovering(false);
      }
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Anotou "recuperando" mas o link não rendeu sessão (já tinha vencido): solta a marca.
  useEffect(() => {
    if (!loading && !session && recovering) {
      clearRecovery();
      setRecovering(false);
    }
  }, [loading, session, recovering]);

  const finishRecovery = useCallback(() => {
    clearRecovery();
    setRecovering(false);
  }, []);

  return (
    <AuthCtx.Provider
      value={{ session, user: session?.user ?? null, loading, recovery: recovering && !!session, finishRecovery }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
