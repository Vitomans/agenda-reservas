// El nombre del club con una pelota de pádel dibujada. "claro" es para fondos oscuros.
export function Logo({ tono = "oscuro" }: { tono?: "oscuro" | "claro" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display text-[1.3em] leading-none font-bold tracking-wide uppercase italic ${
        tono === "claro" ? "text-white" : "text-slate-900"
      }`}
    >
      <Pelota className="size-[1.4em] shrink-0" />
      Volea
    </span>
  );
}

// La pelota del logo. Sola, es la "cara" del asistente con IA en el chat.
export function Pelota({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14" className="fill-lime-400" />
      <path
        d="M7 7.5c5.5 4.5 5.5 12.5 0 17M25 7.5c-5.5 4.5-5.5 12.5 0 17"
        fill="none"
        className="stroke-white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
