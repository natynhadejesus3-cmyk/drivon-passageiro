import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Respeita o endereço-base do site (no GitHub Pages o app vive em /drivon-passageiro/).
const SRC = `${import.meta.env.BASE_URL}videos/welcome.mp4`;
const FADE_MS = 700;
// Deixa a tela "tudo pronto" do cadastro aparecer um instante antes do fade.
const BEAT_MS = 900;
// Se o vídeo não começar a tocar nesse tempo (rede ruim, formato recusado),
// segue direto pro app em vez de deixar a pessoa olhando uma tela preta.
const START_TIMEOUT_MS = 4000;
// O vídeo dura 8s -- rede de segurança caso o evento "ended" nunca chegue.
const FALLBACK_MS = 11000;

/**
 * Mensagem de boas-vindas em vídeo, logo depois que a conta é criada:
 * fade pra preto -> vídeo (sem controles de player) -> fade -> app. Mesmo vídeo do app
 * do motorista ("Bem-vindo ao Drivon").
 *
 * O vídeo é todo preto com o texto no meio e termina em preto, então o fundo
 * `bg-black` emenda com ele sem aparecer "caixa". Fica montado (e carrega o
 * arquivo) antes mesmo de tocar, via `preload`, pra começar sem espera.
 *
 * Vai pro <body> por portal: o <main> do AppShell tem animação com transform, que faria o
 * "fixed" daqui prender nele em vez de cobrir a tela inteira.
 */
export function WelcomeVideo({
  preload,
  play,
  onFinish,
}: {
  /** Já pode baixar o arquivo (a pessoa está chegando no fim do cadastro). */
  preload: boolean;
  /** Conta criada: começa a transição e o vídeo. */
  play: boolean;
  onFinish: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const [covered, setCovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const finishNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!play) return;
    let done = false;
    let started = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const finish = () => {
      if (done) return;
      done = true;
      setShowVideo(false);
      later(() => finishRef.current(), FADE_MS);
    };
    finishNowRef.current = finish;

    later(() => setCovered(true), BEAT_MS);
    later(() => {
      const v = videoRef.current;
      if (!v) return finish();
      later(() => {
        if (!started) finish();
      }, START_TIMEOUT_MS);
      later(finish, FALLBACK_MS);
      v.currentTime = 0;
      v.muted = false;
      // Alguns WebViews só deixam tocar com som depois de um toque; se
      // recusar, toca mudo em vez de pular o vídeo.
      v.play()
        .catch(() => {
          v.muted = true;
          return v.play();
        })
        .then(() => {
          started = true;
        })
        .catch(finish);
    }, BEAT_MS + FADE_MS);

    return () => {
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [play]);

  return createPortal(
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-black transition-opacity ease-out ${
        covered ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <video
        ref={videoRef}
        src={preload || play ? SRC : undefined}
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onPlaying={() => setShowVideo(true)}
        onEnded={() => finishNowRef.current()}
        onError={() => finishNowRef.current()}
        className={`pointer-events-none h-full w-full object-contain transition-opacity duration-500 ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>,
    document.body,
  );
}
