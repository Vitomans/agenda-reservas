// Muestra si la página está recibiendo los avisos en vivo (ver lib/tiempoReal.ts)
export function EnVivo({ conectado }: { conectado: boolean }) {
  return (
    <span
      title="Los horarios se actualizan solos cuando alguien reserva o cancela"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
    >
      <span aria-hidden="true" className="relative flex size-2">
        {/* Un pulso suave, solo si la persona no pidió reducir las animaciones */}
        {conectado && <span className="absolute inline-flex size-full rounded-full bg-lime-400 opacity-75 motion-safe:animate-ping" />}
        <span className={`relative inline-flex size-2 rounded-full ${conectado ? "bg-lime-500" : "bg-slate-300"}`} />
      </span>
      {conectado ? "En vivo" : "Conectando…"}
    </span>
  );
}
