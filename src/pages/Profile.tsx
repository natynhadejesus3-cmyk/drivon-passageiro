import { Camera, Image as ImageIcon, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "../components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { getMyPassengerProfile, upsertPassengerProfile } from "@/lib/repository";

export function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    getMyPassengerProfile(user.id)
      .then((p) => {
        setFullName(p?.full_name ?? (user.user_metadata?.display_name as string | undefined) ?? "");
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
      <ScreenHeader title="Meu perfil" subtitle="O motorista vê isso quando vocês conversam" back />

      <div className="space-y-5 px-5 pb-8">
        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="group relative block rounded-full active:scale-95"
            aria-label="Alterar foto de perfil"
          >
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-card ring-2 ring-primary">
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
        </div>

        <label className="block">
          <span className="section-label">Nome</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => save({ full_name: fullName.trim() })}
            placeholder="Como o motorista vai te ver"
            className="mt-1.5 w-full rounded-xl border border-[color:var(--color-hairline)] bg-card px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
        </label>
        {saving && <p className="text-label">Salvando...</p>}
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
