import { Bell, BellOff, Camera, ChevronRight, Image as ImageIcon, LogOut, Mail, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "../components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { getMyPassengerProfile, upsertPassengerProfile } from "@/lib/repository";
import { notificationPermission, requestWebPush, type PermissionState } from "@/lib/notifications/web-push";
import { getNativePushStatus } from "@/lib/notifications/native-push";

const APP_VERSION = "1.0.0";

export function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const loadedNameRef = useRef("");
  const [notifPerm, setNotifPerm] = useState<PermissionState>("default");
  const [notifBusy, setNotifBusy] = useState(false);
  // Diagnóstico temporário, mas dessa vez como texto na tela (não alert()) —
  // um alert() no meio do fluxo interrompe o encadeamento clique->pedido de
  // permissão que o navegador exige (a tentativa anterior quebrava por causa
  // disso). Texto simples não atrapalha nada e ainda mostra o que está
  // acontecendo de verdade no aparelho.
  const [notifDebug, setNotifDebug] = useState("");
  const [nativeStatus, setNativeStatus] = useState("");

  // O registro nativo (FCM de verdade) roda em segundo plano desde o boot do
  // app (App.tsx) — aqui só fica de olho no status pra mostrar na tela,
  // atualizando por um tempo até ele terminar (sucesso ou erro).
  useEffect(() => {
    setNativeStatus(getNativePushStatus());
    const id = setInterval(() => setNativeStatus(getNativePushStatus()), 1000);
    const stop = setTimeout(() => clearInterval(id), 20_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, []);

  function apiDebugLine() {
    const sw = typeof window !== "undefined" && "serviceWorker" in navigator;
    const pm = typeof window !== "undefined" && "PushManager" in window;
    const notif = typeof window !== "undefined" && "Notification" in window;
    return `serviceWorker=${sw} PushManager=${pm} Notification=${notif}`;
  }

  useEffect(() => {
    setNotifPerm(notificationPermission());
    setNotifDebug(apiDebugLine());
  }, []);

  async function toggleNotifications() {
    if (!user?.id || notifPerm === "denied") return;
    setNotifBusy(true);
    setNotifDebug(apiDebugLine());
    // requestWebPush roda direto aqui, sem nada assíncrono antes — só assim o
    // navegador aceita mostrar a caixinha de permissão nativa.
    requestWebPush(user.id)
      .then((result) => {
        setNotifPerm(result);
        setNotifDebug(`${apiDebugLine()} · resultado=${result}`);
      })
      .catch((e) => setNotifDebug(`erro=${e}`))
      .finally(() => setNotifBusy(false));
  }

  useEffect(() => {
    if (!user?.id) return;
    getMyPassengerProfile(user.id)
      .then((p) => {
        const name = p?.full_name ?? (user.user_metadata?.display_name as string | undefined) ?? "";
        setFullName(name);
        loadedNameRef.current = name;
        setAvatar(p?.avatar_url ?? null);
      })
      .catch(() => {
        setFullName((user.user_metadata?.display_name as string | undefined) ?? "");
      });
  }, [user?.id]);

  async function save(patch: { full_name?: string; avatar_url?: string | null }) {
    if (!user?.id) return;
    setSaving(true);
    try {
      await upsertPassengerProfile(user.id, patch);
    } catch (e) {
      console.error("[drivon] upsertPassengerProfile failed", e);
    } finally {
      setSaving(false);
    }
  }

  // Salva sozinho pouco depois de parar de digitar — depender só do onBlur
  // perde a edição se a pessoa tocar direto na barra de navegação de baixo
  // (o componente desmonta antes do blur "natural" acontecer).
  useEffect(() => {
    if (!user?.id) return;
    const trimmed = fullName.trim();
    if (trimmed === loadedNameRef.current.trim()) return;
    const handle = setTimeout(() => {
      loadedNameRef.current = trimmed;
      save({ full_name: trimmed });
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, user?.id]);

  async function handlePhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(dataUrl);
      await save({ avatar_url: dataUrl });
    } finally {
      setPickerOpen(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function removePhoto() {
    setAvatar(null);
    setPickerOpen(false);
    await save({ avatar_url: null });
  }

  return (
    <div>
      <ScreenHeader title="Meu perfil" subtitle="O motorista vê isso quando vocês conversam" />

      <div className="space-y-6 px-5 pb-8">
        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="group relative block rounded-full active:scale-95"
            aria-label="Alterar foto de perfil"
          >
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-card ring-2 ring-primary shadow-[0_0_0_6px_rgba(255,106,0,0.08)]">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-1/2 w-1/2 text-muted-foreground" />
              )}
            </div>
            <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files)}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files)}
          />
          {fullName && <p className="text-title">{fullName}</p>}
        </div>

        <div>
          <p className="section-label mb-2 px-1">Seus dados</p>
          <div className="list-card">
            <label className="block p-4">
              <span className="section-label">Nome</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Como o motorista vai te ver"
                className="mt-1.5 w-full bg-transparent text-[15px] outline-none"
              />
            </label>
            <div className="flex items-center gap-3 border-t border-[color:var(--color-hairline)] p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Mail size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-label">E-mail</p>
                <p className="truncate text-[15px]">{user?.email}</p>
              </div>
            </div>
          </div>
          {saving && <p className="mt-2 px-1 text-label">Salvando...</p>}
        </div>

        <div>
          <p className="section-label mb-2 px-1">Configurações</p>
          <div className="list-card">
            <SettingsRow
              icon={notifPerm === "granted" ? <Bell size={16} /> : <BellOff size={16} />}
              label={
                notifPerm === "granted"
                  ? "Notificações ativadas"
                  : notifPerm === "denied"
                    ? "Notificações bloqueadas — ative nos ajustes do aparelho"
                    : notifBusy
                      ? "Ativando..."
                      : "Ativar notificações de mensagens"
              }
              onClick={toggleNotifications}
            />
            {notifDebug && <p className="border-t border-[color:var(--color-hairline)] px-4 py-2 text-[11px] text-muted-foreground">{notifDebug}</p>}
            {nativeStatus && (
              <p className="border-t border-[color:var(--color-hairline)] px-4 py-2 text-[11px] text-muted-foreground">
                FCM nativo: {nativeStatus}
              </p>
            )}
            <div className="border-t border-[color:var(--color-hairline)]">
              <SettingsRow
                icon={<LogOut size={16} />}
                label="Sair da conta"
                destructive
                onClick={() => supabase.auth.signOut()}
              />
            </div>
          </div>
        </div>

        <p className="pt-2 text-center text-label opacity-60">Drivon Passageiro · v{APP_VERSION}</p>
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-t-3xl border-t border-[color:var(--color-hairline)] bg-card-elevated p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-title">Foto de perfil</p>
              <button
                onClick={() => setPickerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <PickerAction icon={<Camera className="h-5 w-5" />} label="Tirar foto" onClick={() => cameraRef.current?.click()} />
              <PickerAction
                icon={<ImageIcon className="h-5 w-5" />}
                label="Escolher da galeria"
                onClick={() => galleryRef.current?.click()}
              />
              {avatar && (
                <PickerAction icon={<X className="h-5 w-5" />} label="Remover foto" destructive onClick={removePhoto} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left active:bg-card">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          destructive ? "bg-destructive/15 text-destructive" : "bg-primary-soft text-primary"
        }`}
      >
        {icon}
      </span>
      <span className={`flex-1 text-[15px] font-medium ${destructive ? "text-destructive" : ""}`}>{label}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
}

function PickerAction({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border border-[color:var(--color-hairline)] bg-card p-4 text-left active:scale-[.98] ${
        destructive ? "text-destructive" : "text-foreground"
      }`}
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl ${
          destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
