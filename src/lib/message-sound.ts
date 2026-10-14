/**
 * Som de mensagem nova do chat (arquivo public/sounds/message-pop.mp3, um "pop" curto, estilo WhatsApp).
 * Só toca com a conversa aberta e o app à vista (ver use-incoming-message-sound.ts); com o app
 * minimizado quem avisa é a notificação (push). Nunca lança: som que falha não pode quebrar o chat.
 */
let audio: HTMLAudioElement | null = null;

function get(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    // O app fica numa subpasta do GitHub Pages (/drivon-passageiro/): BASE_URL traz o prefixo certo.
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/message-pop.mp3`);
    audio.preload = "auto";
    audio.volume = 0.9;
  }
  return audio;
}

/** Carrega o arquivo antes da primeira mensagem (o primeiro toque não atrasa). */
export function preloadMessageSound(): void {
  try {
    get()?.load();
  } catch {
    /* ignora */
  }
}

export function playMessageSound(): void {
  try {
    const a = get();
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {
      /* o navegador pode recusar tocar sem um toque da pessoa antes; sem problema */
    });
  } catch {
    /* ignora */
  }
}
