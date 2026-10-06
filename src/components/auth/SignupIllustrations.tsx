import type { ReactNode } from "react";

const ORANGE = "#FF6A00";
const PANEL = "#1B1B1B";
const PANEL_HI = "#262626";
const LINE = "rgba(255,255,255,0.14)";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.32)";

/**
 * Moldura comum: ilustração estática e sóbria sobre um quadrado arredondado
 * com borda fina -- sem brilho, sem balanço, sem enfeite. A única animação é a
 * entrada da própria etapa (ver wizard-in-* no index.css). Mesmo visual do cadastro
 * do app do motorista.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid h-[168px] w-[168px] place-items-center rounded-[40px] border border-[color:var(--color-hairline)] bg-card">
      <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" aria-hidden>
        {children}
      </svg>
    </div>
  );
}

const stroke = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IllusName() {
  return (
    <Frame>
      <rect x="16" y="28" width="88" height="60" rx="10" fill={PANEL_HI} stroke={LINE} strokeWidth="1.5" />
      <rect x="22" y="34" width="76" height="48" rx="7" fill={PANEL} />
      <circle cx="44" cy="54" r="10" fill={ORANGE} />
      <path d="M30 76 C32 66 56 66 58 76" fill={ORANGE} />
      <rect x="66" y="46" width="26" height="5" rx="2.5" fill={TEXT} />
      <rect x="66" y="57" width="20" height="4" rx="2" fill={TEXT_DIM} />
      <rect x="66" y="66" width="24" height="4" rx="2" fill={TEXT_DIM} />
    </Frame>
  );
}

export function IllusEmail() {
  return (
    <Frame>
      <rect x="16" y="32" width="88" height="58" rx="10" fill={PANEL_HI} stroke={LINE} strokeWidth="1.5" />
      <path d="M20 40 L60 68 L100 40" stroke={ORANGE} strokeWidth="3" {...stroke} />
      <rect x="26" y="78" width="26" height="4" rx="2" fill={TEXT_DIM} />
      <circle cx="98" cy="32" r="6" fill={ORANGE} stroke={PANEL} strokeWidth="3" />
    </Frame>
  );
}

export function IllusLock() {
  return (
    <Frame>
      <path
        d="M60 12 L98 26 V58 C98 80 82 98 60 108 C38 98 22 80 22 58 V26 Z"
        fill={PANEL_HI}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M50 56 V50 a10 10 0 0 1 20 0 V56" stroke={TEXT} strokeWidth="4" {...stroke} />
      <rect x="44" y="55" width="32" height="26" rx="6" fill={ORANGE} />
      <circle cx="60" cy="66" r="3.6" fill={PANEL} />
      <rect x="58.2" y="68" width="3.6" height="7" rx="1.8" fill={PANEL} />
    </Frame>
  );
}

/** Sucesso: check dentro de círculo, com dois anéis discretos que se expandem uma vez. */
export function IllusSuccess() {
  return (
    <div className="relative mx-auto grid h-[168px] w-[168px] place-items-center">
      {[0, 0.25].map((d) => (
        <span
          key={d}
          aria-hidden
          className="absolute h-[96px] w-[96px] rounded-full border-2 border-primary/60"
          style={{ animation: `ring-expand 1.4s ${d}s ease-out both` }}
        />
      ))}
      <svg viewBox="0 0 120 120" className="relative h-[120px] w-[120px]" aria-hidden>
        <circle cx="60" cy="60" r="38" fill={ORANGE} />
        <path
          d="M43 61 L55 73 L78 47"
          stroke="#fff"
          strokeWidth="7"
          {...stroke}
          strokeDasharray="60"
          style={{ animation: "check-draw 0.6s 0.2s ease-out both" }}
        />
      </svg>
    </div>
  );
}

/** Foto de perfil: círculo com a foto escolhida (ou silhueta) e selo de câmera. */
export function PhotoPreview({ src }: { src: string | null }) {
  return (
    <div className="relative mx-auto grid h-[168px] w-[168px] place-items-center">
      <div
        className="grid h-[136px] w-[136px] place-items-center overflow-hidden rounded-full bg-card"
        style={{ border: `2px ${src ? "solid" : "dashed"} ${src ? ORANGE : LINE}` }}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full animate-[fade-in_.35s_ease-out] object-cover" />
        ) : (
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
            <circle cx="50" cy="38" r="16" fill={PANEL_HI} />
            <path d="M18 92 C20 66 80 66 82 92 Z" fill={PANEL_HI} />
          </svg>
        )}
      </div>
      <span
        className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full border-[3px] border-background"
        style={{ background: ORANGE }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </span>
    </div>
  );
}
