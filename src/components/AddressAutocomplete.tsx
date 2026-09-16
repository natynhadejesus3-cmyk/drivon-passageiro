import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Store } from "lucide-react";
import { GeoSearchService, type AddressSuggestion } from "@/lib/services/pelias-search-service";

type Props = {
  value: string;
  onChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number } | null;
  inputClassName?: string;
  /** When true, treat the current value as an already-selected address and skip searching. */
  hasSelection?: boolean;
};

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  bias,
  inputClassName,
  hasSelection,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);

  // Debounced search — only runs while the user is actively focused and typing,
  // and only when there's no selection matching the current value.
  useEffect(() => {
    if (!focused || hasSelection) {
      setOpen(false);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const q = value.trim();
    setError(null);
    if (q.length < 3) {
      setSuggestions([]);
      setEmpty(false);
      setLoading(false);
      setOpen(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const reqId = ++reqIdRef.current;
      try {
        const res = await GeoSearchService.search(q, {
          signal: ctrl.signal,
          bias,
          limit: 6,
          // Mostra o primeiro lote assim que chegar, sem esperar o resto.
          onPartial: (items) => {
            if (reqId !== reqIdRef.current || !items.length) return;
            setSuggestions(items);
            setEmpty(false);
            setOpen(true);
          },
        });
        if (reqId !== reqIdRef.current) return; // resposta antiga — descarta
        setSuggestions(res);
        setEmpty(res.length === 0);
        setOpen(true);
      } catch (e: any) {
        if (e?.name === "AbortError" || reqId !== reqIdRef.current) return;
        setError("Não foi possível buscar endereços agora.");
        setSuggestions([]);
        setOpen(true);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 320);


    return () => clearTimeout(handle);
  }, [value, bias, focused, hasSelection]);

  // Close on outside click / touch — hard reset so the list never gets stuck.
  useEffect(() => {
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
        abortRef.current?.abort();
        // Se o toque caiu numa área não-focável (ex.: espaço em branco), o
        // input pode continuar com o foco NATIVO mesmo após isso — e aí um
        // novo toque nele não dispara onFocus (já estava "focado"), deixando
        // a lista presa fechada até apagar tudo e digitar de novo. Forçar o
        // blur aqui mantém o estado em sincronia com o DOM.
        if (document.activeElement === inputRef.current) inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc as any);
    };
  }, []);

  // Always close and abort on unmount (e.g. route change).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      setOpen(false);
    };
  }, []);

  function pick(s: AddressSuggestion) {
    skipNextSearchRef.current = true;
    reqIdRef.current++; // invalida qualquer resposta em voo
    abortRef.current?.abort();
    setLoading(false);
    onSelect(s);
    onChange(s.label);
    setSuggestions([]);
    setEmpty(false);
    setError(null);
    setOpen(false);
    setFocused(false);
    // Remove focus so the list doesn't reopen.
    inputRef.current?.blur();
  }

  const showDropdown = open && focused && !hasSelection && (suggestions.length > 0 || empty || error);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so mousedown/touchstart on a suggestion can fire pick() first.
            setTimeout(() => setFocused(false), 120);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={
            inputClassName ??
            "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          }
        />
        {loading && focused && !hasSelection && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-hairline)] bg-card shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          {error && (
            <div className="px-4 py-3 text-xs text-destructive/90">{error}</div>
          )}
          {!error && empty && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Nenhum endereço encontrado.
            </div>
          )}
          {!error &&
            suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className="flex w-full items-start gap-3 border-b border-[color:var(--color-hairline)] px-4 py-3 text-left last:border-b-0 hover:bg-foreground/5 active:bg-foreground/10"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft">
                  {s.type === "poi" ? (
                    <Store className="h-4 w-4 text-primary" />
                  ) : (
                    <MapPin className="h-4 w-4 text-primary" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.street || s.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[s.city, s.state].filter(Boolean).join(" - ") || s.country}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
