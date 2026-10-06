import { useEffect, useState } from "react";
import { getInviteDriverName } from "@/lib/repository";

/** Primeiro nome do motorista do convite (null enquanto carrega ou se não der pra saber). */
export function useInviteDriverName(code: string | null): string | null {
  // Guarda o código junto do nome: se o código mudar, o nome antigo não aparece no convite novo.
  const [found, setFound] = useState<{ code: string; name: string | null } | null>(null);
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void getInviteDriverName(code).then((name) => {
      if (!cancelled) setFound({ code, name });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return found && found.code === code ? found.name : null;
}
