import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function DriverAvatar({
  name,
  avatarUrl,
  online,
  size = 48,
}: {
  name: string;
  avatarUrl?: string | null;
  online?: boolean;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Avatar style={{ width: size, height: size }}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
        <AvatarFallback style={{ fontSize: size * 0.36 }}>{initials(name)}</AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 border-background ${
            online ? "bg-success" : "bg-muted-foreground/40"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
