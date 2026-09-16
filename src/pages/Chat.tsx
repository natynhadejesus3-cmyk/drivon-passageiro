import { ArrowLeft, Navigation, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { DriverAvatar } from "../components/DriverAvatar";
import { useAuth } from "@/lib/auth-context";
import { useLink, useMessages } from "@/lib/hooks";
import { getCachedDriverName, markRead, sendMessage } from "@/lib/repository";
import { getCurrentPosition } from "@/lib/services/location-service";
import type { AddressSuggestion } from "@/lib/services/pelias-search-service";

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
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [bias, setBias] = useState<{ lat: number; lng: number } | null>(null);
  const [askingRide, setAskingRide] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function openRideRequest() {
    setAskingRide(true);
    // Melhor ordenação das sugestões por proximidade — se a pessoa negar a
    // permissão, a busca continua funcionando normalmente, só sem viés.
    if (!bias) getCurrentPosition().then((c) => setBias(c)).catch(() => {});
  }

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
      setSelectedAddress(null);
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
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAskingRide(false)} />
          <div className="relative rounded-t-3xl border-t border-[color:var(--color-hairline)] bg-card-elevated px-5 pb-6 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-title">Pedir corrida</p>
              <button
                onClick={() => setAskingRide(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="section-label mb-2">Destino</p>
            <AddressAutocomplete
              value={destination}
              onChange={(v) => {
                setDestination(v);
                if (selectedAddress && v !== selectedAddress.label) setSelectedAddress(null);
              }}
              onSelect={setSelectedAddress}
              bias={bias}
              hasSelection={!!selectedAddress && selectedAddress.label === destination}
              placeholder="Rua, praça, bairro..."
              inputClassName="w-full rounded-xl border border-[color:var(--color-hairline)] bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
            />

            <button
              onClick={submitRideRequest}
              disabled={!destination.trim() || sending}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2 disabled:opacity-40"
            >
              <Send size={16} />
              Enviar pedido
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[color:var(--color-hairline)] px-3 py-3">
        <button
          onClick={openRideRequest}
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
