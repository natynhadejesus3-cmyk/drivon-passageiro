/** "Visto agora" / "Visto há 2 minutos" / "Visto há 3 horas" — igual Instagram. */
export function seenAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Visto agora";
  if (minutes < 60) return `Visto há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Visto há ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Visto há ${days} dia${days === 1 ? "" : "s"}`;
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Visto por último há um tempo";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `Visto por último às ${time}`;
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `Visto por último em ${date} às ${time}`;
}
