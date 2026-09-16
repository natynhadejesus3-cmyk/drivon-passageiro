import { Avatar, AvatarFallback } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function DriverAvatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <Avatar style={{ width: size, height: size }} className="shrink-0">
      <AvatarFallback style={{ fontSize: size * 0.36 }}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
