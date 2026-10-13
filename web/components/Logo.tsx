// El nombre del club con una pelota de pádel dibujada
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-[1.4em] shrink-0">
        <circle cx="16" cy="16" r="14" className="fill-lime-400" />
        <path
          d="M7 7.5c5.5 4.5 5.5 12.5 0 17M25 7.5c-5.5 4.5-5.5 12.5 0 17"
          fill="none"
          className="stroke-white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      Volea
    </span>
  );
}
