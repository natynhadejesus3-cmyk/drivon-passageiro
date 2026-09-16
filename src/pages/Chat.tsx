import { ArrowLeft, Calendar, Clock, Navigation, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { DriverAvatar } from "../components/DriverAvatar";
import { useAuth } from "@/lib/auth-context";
import { useLink, useMessages } from "@/lib/hooks";
import { getCachedDriverName, markRead, sendMessage } from "@/lib/repository";
import { resolveLocationContext, type LocationContext } from "@/lib/services/location-service";
import type { AddressSuggestion } from "@/lib/services/pelias-search-service";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function nowInputValue() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [rideDate, setRideDate] = useState(todayInputValue);
  const [rideTime, setRideTime] = useState(nowInputValue);
  const [location, setLocation] = useState<LocationContext | null>(null);
  const [locating, setLocating] = useState(false);
  const [askingRide, setAskingRide] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function openRideRequest() {
    setAskingRide(true);
    setRideDate(todayInputValue());
    setRideTime(nowInputValue());
    // Melhor ordenação das sugestões por proximidade — se a pessoa negar a
    // permissão, a busca continua funcionando normalmente, só sem viés.
    if (!location) {
      setLocating(true);
      resolveLocationContext()
        .then(setLocation)
        .finally(() => setLocating(false));
    }
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
      const when = new Date(`${rideDate}T${rideTime}`);
      const dateLabel = when.toLocaleDateString("pt-BR");
      const timeLabel = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const body = `Você pode me levar em ${destination.trim()} no dia ${dateLabel} às ${timeLabel}?`;
      await sendMessage(linkId, user.id, body, true);
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
              bias={location}
              hasSelection={!!selectedAddress && selectedAddress.label === destination}
              placeholder="Rua, praça, bairro..."
              inputClassName="w-full rounded-xl border border-[color:var(--color-hairline)] bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
            />
            {locating && <p className="mt-1.5 text-[11px] text-muted-foreground">Localizando você...</p>}
            {!locating && !location && (
              <p className="mt-1.5 text-[11px] text-warning">
                Sem localização — resultados podem não vir ordenados pela sua proximidade.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="section-label mb-2 flex items-center gap-1.5">
                  <Calendar size={12} />
                  Data
                </span>
                <input
                  type="date"
                  value={rideDate}
                  min={todayInputValue()}
                  onChange={(e) => setRideDate(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--color-hairline)] bg-background px-3.5 py-3 text-[15px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="section-label mb-2 flex items-center gap-1.5">
                  <Clock size={12} />
                  Horário
                </span>
                <input
                  type="time"
                  value={rideTime}
                  onChange={(e) => setRideTime(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--color-hairline)] bg-background px-3.5 py-3 text-[15px] outline-none focus:border-primary"
                />
              </label>
            </div>

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
