import { useEffect, useRef } from "react";

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  born: number;
  ttl: number;
  round: boolean;
};

const COLORS = ["#FF6A00", "#FF9A3D", "#22C55E", "#FFFFFF", "#FFD166", "#38BDF8", "#F472B6"];
const GRAVITY = 0.00085; // px/ms²
const DRAG = 0.0009; // fração da velocidade perdida por ms

/**
 * Chuva de confete em tela cheia, desenhada num canvas (sem biblioteca).
 * Três "canhões" (esquerda, centro, direita) disparam duas rajadas; as
 * peças giram, caem e vão sumindo. Não bloqueia toque nenhum.
 *
 * Com "reduzir movimento" ligado no aparelho a chuva fica mais curta e mais
 * leve (uma rajada só, menos peças) -- mas não some: o Android liga esse
 * modo também no economizador de bateria, e o efeito é o ponto do aviso.
 */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pieces: Piece[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    // angle em graus (0 = direita, -90 = pra cima); power em px/ms.
    const cannon = (x: number, y: number, count: number, angle: number, spread: number, power: number) => {
      const now = performance.now();
      const n = Math.round(count * (calm ? 0.4 : 1));
      for (let i = 0; i < n; i++) {
        const a = ((angle + rand(-spread, spread)) * Math.PI) / 180;
        const p = power * rand(0.55, 1.1);
        pieces.push({
          x,
          y,
          vx: Math.cos(a) * p,
          vy: Math.sin(a) * p,
          w: rand(6, 11),
          h: rand(10, 18),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.012, 0.012),
          color: COLORS[Math.floor(rand(0, COLORS.length))]!,
          born: now,
          ttl: rand(2600, 4200) * (calm ? 0.6 : 1),
          round: Math.random() < 0.25,
        });
      }
    };

    const fire = () => {
      cannon(w * 0.08, h * 0.8, 55, -62, 18, 1.35);
      cannon(w * 0.92, h * 0.8, 55, -118, 18, 1.35);
      cannon(w * 0.5, h * 0.55, 45, -90, 38, 1.15);
    };
    fire();
    let secondFired = calm; // modo calmo: uma rajada só
    const second = window.setTimeout(() => {
      if (calm) return;
      fire();
      secondFired = true;
    }, 450);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 40);
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i]!;
        const age = now - p.born;
        if (age > p.ttl || p.y > h + 30) {
          pieces.splice(i, 1);
          continue;
        }
        p.vy += GRAVITY * dt;
        p.vx *= 1 - DRAG * dt;
        p.vy *= 1 - DRAG * dt * 0.5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // some suavemente no último terço da vida
        const alpha = age > p.ttl * 0.66 ? 1 - (age - p.ttl * 0.66) / (p.ttl * 0.34) : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // "vira" a peça enquanto cai (efeito de papel girando)
          ctx.scale(1, Math.cos(p.rot * 3));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      // Para de desenhar quando acabou tudo (e a segunda rajada já saiu).
      if (pieces.length > 0 || !secondFired) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(second);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[210] h-full w-full" />;
}
