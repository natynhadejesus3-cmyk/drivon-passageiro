import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, Check, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { errorMessage } from "@/lib/error-messages";
import { readPendingInvite } from "@/lib/invite";
import { upsertPassengerProfile } from "@/lib/repository";
import {
  SIGNUP_STEPS,
  firstNameOf,
  nextStepIndex,
  passwordScore,
  stepForSignupError,
  strengthLabel,
  validateStep,
  type SignupStepKey,
} from "@/lib/signup";
import { InviteBanner } from "@/pages/Invite";
import { IllusEmail, IllusLock, IllusName, IllusSuccess, PhotoPreview } from "./SignupIllustrations";
import { WelcomeVideo } from "./WelcomeVideo";

type StepKey = SignupStepKey | "done" | "verify";

/**
 * True enquanto um campo está em foco no celular (teclado aberto). Com a
 * ilustração grande a etapa não cabe acima do teclado e o campo ficava
 * escondido atrás dele. Aqui a própria tela se compacta e continua cabendo.
 *
 * Não dá pra depender só da altura da área visível: em alguns Androids o teclado
 * fica POR CIMA da WebView e a altura nunca muda. Por isso, em tela de toque,
 * "digitando" já basta.
 */
function useKeyboardCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    function update() {
      const el = document.activeElement;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      const h = vv?.height ?? window.innerHeight;
      setCompact(typing && (touch || h < 720));
    }
    function onOut() {
      setTimeout(update, 50);
    }
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onOut);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return compact;
}

/**
 * Cadastro do passageiro em poucas etapas (uma pergunta por tela, com ilustração e texto
 * motivador), no mesmo estilo do cadastro do app do motorista: nome -> e-mail -> senha ->
 * foto (opcional). Depois: tela de "tudo pronto" + vídeo de boas-vindas + entra no app.
 *
 * `onHold`/`onRelease`: assim que a conta nasce, o app JÁ teria uma sessão e trocaria esta
 * tela pelo app na hora, pulando a foto e o vídeo. O pai (App.tsx) segura a troca enquanto
 * o assistente estiver trabalhando e libera no fim (ou se algo der errado).
 */
export function SignupWizard({
  onBackToLogin,
  onHold,
  onRelease,
}: {
  /** Volta pro login; `email` (se houver) já vai preenchido (quando a conta já existe). */
  onBackToLogin: (email?: string) => void;
  onHold: () => void;
  onRelease: (opts?: { fade?: boolean }) => void;
}) {
  const [step, setStep] = useState<StepKey>("name");
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Etapa mais adiantada em que a pessoa já esteve. Se ela voltar (ou um erro devolvê-la) pra
  // corrigir algo, o "Continuar" leva direto até aqui em vez de refazer as etapas do meio.
  const [furthest, setFurthest] = useState(0);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const compact = useKeyboardCompact();
  // Convite do motorista esperando (QR lido pela câmera): a 1ª tela avisa de quem é.
  const [pendingInvite] = useState(() => readPendingInvite());

  // Corrigiu o campo? O aviso vermelho antigo sai na hora.
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };

  const stepIndex = (SIGNUP_STEPS as readonly string[]).indexOf(step);
  const index = step === "done" || step === "verify" ? SIGNUP_STEPS.length : stepIndex;
  const firstName = firstNameOf(name);
  const last = SIGNUP_STEPS[SIGNUP_STEPS.length - 1];

  function go(to: StepKey, direction: "fwd" | "back") {
    setDir(direction);
    setError(null);
    setStep(to);
    const at = (SIGNUP_STEPS as readonly string[]).indexOf(to);
    if (at >= 0) setFurthest((f) => Math.max(f, at));
  }

  async function next(e?: FormEvent) {
    e?.preventDefault();
    if (busy || step === "done" || step === "verify") return;
    const err = validateStep(step, { name, email, password });
    if (err) {
      setError(err);
      return;
    }
    if (step === last) {
      await createAccount();
      return;
    }
    // E-mail de caixa temporária é barrado já aqui (e de novo pelo banco ao criar a conta).
    if (step === "email") {
      setBusy(true);
      try {
        const { data: temporary } = await supabase.rpc("is_disposable_email", { p_email: email.trim() });
        if (temporary === true) {
          setError("Esse tipo de e-mail temporário não é aceito. Use o seu e-mail pessoal (Gmail, Outlook, etc.).");
          return;
        }
      } catch {
        /* sem rede agora: segue, a criação da conta confere de novo */
      } finally {
        setBusy(false);
      }
    }
    // Normalmente a próxima etapa; se a pessoa voltou pra corrigir algo, direto até onde tinha chegado.
    go(SIGNUP_STEPS[nextStepIndex(stepIndex, furthest, { name, email, password })]!, "fwd");
  }

  function back() {
    if (busy || step === "done" || step === "verify") return;
    if (step === "name") onBackToLogin();
    else go(SIGNUP_STEPS[stepIndex - 1]!, "back");
  }

  async function pickPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      setPhoto(await fileToAvatarDataUrl(file));
    } catch {
      setError("Não foi possível processar essa imagem.");
    } finally {
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function createAccount() {
    setBusy(true);
    // Segura a troca de tela ANTES de criar: o signUp já cria a sessão e o app trocaria de tela.
    onHold();
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { user_type: "passenger", display_name: name.trim() } },
      });
      if (signUpError) throw signUpError;

      // Projeto com confirmação de e-mail ligada: a conta nasce sem sessão. Avisa pra confirmar.
      if (!data.session) {
        onRelease();
        go("verify", "fwd");
        return;
      }

      // Foto e nome vão pro perfil que o motorista vê. Se falhar, a conta já existe: segue.
      try {
        await upsertPassengerProfile(data.session.user.id, {
          full_name: name.trim(),
          ...(photo ? { avatar_url: photo } : {}),
        });
      } catch (e) {
        console.error("[signup] perfil não sincronizou", e);
      }

      // A tela "done" aparece um instante e o WelcomeVideo (abaixo) assume:
      // fade, vídeo de boas-vindas, fade e só então entra no app.
      go("done", "fwd");
    } catch (e) {
      onRelease();
      const message = errorMessage(e, "Não foi possível criar a conta agora.");
      // Volta pra etapa do campo que deu problema em vez de deixar a pessoa perdida.
      const target = stepForSignupError(message);
      if (target) go(target, "back");
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const finished = step === "done" || step === "verify";
  const progress = finished ? 100 : ((index + 1) / SIGNUP_STEPS.length) * 100;
  const score = passwordScore(password);
  const anim = dir === "fwd" ? "wizard-in-fwd" : "wizard-in-back";

  return (
    <div className="flex min-h-full flex-col px-6 pb-8 pt-6">
      {!finished && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={back}
            aria-label="Voltar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-hairline)]">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 text-right text-[11px] font-bold tabular-nums text-muted-foreground">
            {index + 1}/{SIGNUP_STEPS.length}
          </span>
        </div>
      )}

      {/* noValidate: quem avisa de e-mail errado é o próprio assistente (em português); sem isso o
          navegador barra o envio com um balão em inglês antes de chegar aqui. */}
      <form
        key={step}
        noValidate
        onSubmit={next}
        className="flex flex-1 flex-col"
        style={{ animation: `${anim} 0.38s cubic-bezier(0.22, 0.9, 0.35, 1) both` }}
      >
        {/* Compacto: o conteúdo não estica, então o botão fica logo abaixo do
            campo (e não colado no rodapé, que o teclado cobriria). */}
        <div className={`flex flex-col py-4 ${compact ? "justify-start pt-6" : "flex-1 justify-center"}`}>
          {step === "name" && pendingInvite && !compact && (
            <div className="-mb-1">
              <InviteBanner code={pendingInvite} />
            </div>
          )}

          {/* Some com o teclado aberto pra título + campo + botão caberem acima dele. */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              compact ? "max-h-0 opacity-0" : "max-h-[190px] opacity-100"
            }`}
          >
            {step === "name" && <IllusName />}
            {(step === "email" || step === "verify") && <IllusEmail />}
            {step === "password" && <IllusLock />}
            {step === "photo" && <PhotoPreview src={photo} />}
            {step === "done" && <IllusSuccess />}
          </div>

          <div className={`text-center ${compact ? "mt-0" : "mt-4"}`}>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">
              {step === "name" && "Qual é o seu nome?"}
              {step === "email" && `Olá, ${firstName}. Qual é o seu e-mail?`}
              {step === "password" && "Crie uma senha"}
              {step === "photo" && "Adicione uma foto de perfil"}
              {step === "done" && `Bem-vindo ao Drivon, ${firstName}`}
              {step === "verify" && "Confira o seu e-mail"}
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              {step === "name" && "Esse é o nome que o seu motorista vai ver."}
              {step === "email" && "Usado para entrar e para recuperar sua senha."}
              {step === "password" && "Mínimo de 8 caracteres. Misture letras, números e símbolos."}
              {step === "photo" && "O motorista te reconhece mais fácil com foto. Você pode alterar depois."}
              {step === "done" &&
                (pendingInvite
                  ? "Sua conta foi criada. Já vamos conectar você ao seu motorista."
                  : "Sua conta foi criada. É só adicionar seu motorista pelo QR Code.")}
              {step === "verify" && `Enviamos um link para ${email.trim()}. Toque nele para ativar a conta e depois entre.`}
            </p>
          </div>

          {!finished && (
            <div className="mt-6">
              {step === "name" && (
                <WizardInput value={name} onChange={edit(setName)} placeholder="Seu nome completo" autoComplete="name" />
              )}
              {step === "email" && (
                <WizardInput
                  value={email}
                  onChange={edit(setEmail)}
                  placeholder="voce@email.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                />
              )}
              {step === "password" && (
                <>
                  <div className="relative">
                    <WizardInput
                      value={password}
                      onChange={edit(setPassword)}
                      placeholder="••••••••"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      rightPad
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Esconder senha" : "Mostrar senha"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="grid flex-1 grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-full transition-colors ${
                            password && i < Math.max(score, 1)
                              ? score >= 3
                                ? "bg-success"
                                : "bg-primary"
                              : "bg-[color:var(--color-hairline)]"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="w-20 text-right text-[11px] font-semibold text-muted-foreground">
                      {strengthLabel(password)}
                    </span>
                  </div>
                </>
              )}
              {step === "photo" && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-hairline)] bg-card text-sm font-semibold"
                  >
                    <Camera className="h-4 w-4 text-primary" /> Tirar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-hairline)] bg-card text-sm font-semibold"
                  >
                    <ImageIcon className="h-4 w-4 text-primary" /> Galeria
                  </button>
                  <input
                    ref={galleryRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickPhoto(e.target.files)}
                  />
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => pickPhoto(e.target.files)}
                  />
                </div>
              )}

              {error && <p className="mt-3 text-center text-[13px] font-semibold text-destructive">{error}</p>}
              {/* O e-mail já tem conta (inclusive do app do motorista, que vale aqui também): leva pro
                  login já com o e-mail preenchido, em vez de a pessoa ficar procurando. */}
              {step === "email" && error && /já está cadastrado/i.test(error) && (
                <button
                  type="button"
                  onClick={() => onBackToLogin(email.trim())}
                  className="btn-outline mt-3 flex w-full items-center justify-center"
                >
                  Entrar com essa conta
                </button>
              )}
              {/* Voltou pra corrigir algo: avisa que não precisa refazer o resto. */}
              {furthest > stepIndex && !error && (
                <p className="mt-3 text-center text-[12px] text-muted-foreground">
                  Depois de corrigir, toque em Continuar: você volta direto para onde estava.
                </p>
              )}
            </div>
          )}
        </div>

        {step === "verify" && (
          <button type="button" onClick={() => onBackToLogin()} className="btn-primary flex w-full items-center justify-center">
            Ir para o login
          </button>
        )}

        {!finished && (
          <div className={`space-y-3 ${compact ? "mt-2" : ""}`}>
            <button disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {busy && step === last ? (
                "Criando sua conta..."
              ) : step === last ? (
                <>
                  <Check className="h-4 w-4" /> {photo ? "Criar conta" : "Criar conta sem foto"}
                </>
              ) : (
                "Continuar"
              )}
            </button>
            {step === "name" && !compact && (
              <button type="button" onClick={() => onBackToLogin()} className="w-full pt-1 text-center text-sm text-muted-foreground">
                Já tem conta? <span className="font-semibold text-primary">Entrar</span>
              </button>
            )}
          </div>
        )}
      </form>

      <WelcomeVideo
        preload={step === "password" || step === "photo" || step === "done"}
        play={step === "done"}
        onFinish={() => onRelease({ fade: true })}
      />
    </div>
  );
}

function WizardInput({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  rightPad,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  rightPad?: boolean;
}) {
  return (
    <div className="flex h-14 items-center rounded-2xl border border-[color:var(--color-hairline)] bg-card px-4 transition-colors focus-within:border-primary">
      <input
        autoFocus
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-full w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 ${rightPad ? "pr-8" : ""}`}
      />
    </div>
  );
}
