import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearRecovery, isRecoveryPending, markRecovery } from "@/lib/recovery";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Digitou o código de "esqueci minha senha": o app mostra "Nova senha" até a pessoa trocar. */
  recovery: boolean;
  finishRecovery: () => void;
  /** O código do e-mail deu certo: entra na sessão de recuperação e já mostra "Nova senha". */
  startRecovery: (session: Session) => void;
};

const AuthCtx = createContext<Ctx>({
  session: null,
  user: null,
  loading: true,
  recovery: false,
  finishRecovery: () => {},
  startRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Já nasce certo se a página foi recarregada no meio da recuperação (a marca fica na sessão do navegador).
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

  // Anotou "recuperando" mas não existe sessão (venceu ou saiu da conta): solta a marca.
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

  // Põe a sessão e a marca "recuperando" JUNTAS: se a marca entrasse antes da sessão chegar pelo
  // onAuthStateChange, o efeito acima acharia que é uma marca velha e a apagaria.
  const startRecovery = useCallback((s: Session) => {
    markRecovery();
    setSession(s);
    setLoading(false);
    setRecovering(true);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recovery: recovering && !!session,
        finishRecovery,
        startRecovery,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
