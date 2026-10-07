import { LEGAL_URLS } from "@/lib/legal";

const linkCls = "underline underline-offset-2";

/**
 * Frase de aceite com links ("Ao criar a conta, você concorda com os Termos de Uso e a Política
 * de Privacidade."). Os textos abrem em outra aba/no navegador do celular, sem sair do app.
 */
export function LegalConsent({ lead, className = "" }: { lead: string; className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-muted-foreground ${className}`}>
      {lead}, você concorda com os{" "}
      <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className={linkCls}>
        Termos de Uso
      </a>{" "}
      e a{" "}
      <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className={linkCls}>
        Política de Privacidade
      </a>
      .
    </p>
  );
}
