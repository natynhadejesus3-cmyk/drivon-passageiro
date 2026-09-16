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
