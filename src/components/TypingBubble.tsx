/** Balãozinho com os três pontinhos animados ("fulano está digitando"). */
export function TypingBubble() {
  return (
    <div className="flex justify-start" role="status" aria-label="digitando">
      <div className="card-elevated flex items-center gap-1.5 rounded-2xl px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground"
            style={{ animation: "typing-dot 1.2s infinite ease-in-out", animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
