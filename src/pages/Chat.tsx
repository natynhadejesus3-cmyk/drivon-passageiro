import { ArrowLeft, Navigation, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DriverAvatar } from "../components/DriverAvatar";
import { useAuth } from "@/lib/auth-context";
import { useLink, useMessages } from "@/lib/hooks";
import { getCachedDriverName, markRead, sendMessage } from "@/lib/repository";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Chat() {
  const { linkId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { link, loading: linkLoading } = useLink(linkId);
  const { messages, refetch } = useMessages(linkId);
  const [text, setText] = useState("");
  const [destination, setDestination] = useState("");
  const [askingRide, setAskingRide] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    messages
      .filter((m) => m.sender_role === "driver" && !m.read_at)
      .forEach((m) => markRead(m.id).catch(() => {}));
  }, [messages]);

  if (linkLoading) return null;

  if (!link) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <p className="text-body">Motorista não encontrado.</p>
        <button onClick={() => navigate("/")} className="font-semibold text-primary">
          Voltar
        </button>
      </div>
    );
  }

  const driverName = getCachedDriverName(link.driver_id);

  async function submitRideRequest() {
    if (!destination.trim() || !user) return;
    setSending(true);
    try {
      await sendMessage(linkId, user.id, `Você pode me levar em ${destination.trim()}?`, true);
      setDestination("");
      setAskingRide(false);
      refetch();
    } finally {
      setSending(false);
    }
  }

  async function submitText() {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      await sendMessage(linkId, user.id, text.trim(), false);
      setText("");
      refetch();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-[color:var(--color-hairline)] px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-1 text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <DriverAvatar name={driverName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{driverName}</p>
          <p className="truncate text-label">Pareado em {new Date(link.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-label">
            Mande uma mensagem ou peça uma corrida pra {driverName.split(" ")[0]}.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === "passenger";
          const isRideEvent = m.is_ride_request;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[15px] ${
                  isRideEvent
                    ? m.ride_confirmed
                      ? "bg-success/15 text-success"
                      : "bg-primary-soft text-primary"
                    : mine
                      ? "bg-primary text-primary-foreground"
                      : "card-elevated"
                }`}
              >
                <p>{m.body}</p>
                {isRideEvent && (
                  <p className="mt-1 text-[10px] font-semibold uppercase opacity-80">
                    {m.ride_confirmed ? "Corrida confirmada" : "Pedido de corrida · aguardando"}
                  </p>
                )}
                <p className="mt-1 text-[10px] opacity-70">{formatTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {askingRide && (
        <div className="flex items-end gap-2 border-t border-[color:var(--color-hairline)] bg-card-elevated px-4 py-3">
          <input
            autoFocus
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRideRequest()}
            placeholder="Pra onde? Ex: Shopping Center Norte"
            className="min-w-0 flex-1 rounded-full border border-[color:var(--color-hairline)] bg-background px-4 py-2.5 text-[15px] outline-none focus:border-primary"
          />
          <button
            onClick={submitRideRequest}
            disabled={!destination.trim() || sending}
            className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[color:var(--color-hairline)] px-3 py-3">
        <button
          onClick={() => setAskingRide((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-2.5 text-label font-semibold text-primary"
        >
          <Navigation size={16} />
          Pedir corrida
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitText()}
          placeholder="Mensagem"
          className="min-w-0 flex-1 rounded-full border border-[color:var(--color-hairline)] bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary"
        />
        <button
          onClick={submitText}
          disabled={!text.trim() || sending}
          className="shrink-0 rounded-full bg-secondary p-2.5 text-foreground disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
