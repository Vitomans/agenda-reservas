import { sumarDias } from "@/lib/fechas";

const claseBotonDia =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

type Props = {
  dia: string;
  hoy: string;
  onCambiar: (dia: string) => void;
};

// Para moverse entre días: el anterior, el siguiente, cualquier fecha o volver a hoy
export function SelectorDeDia({ dia, hoy, onCambiar }: Props) {
  return (
    <div role="group" aria-label="Día" className="flex items-center gap-2">
      <button type="button" className={claseBotonDia} aria-label="Día anterior" onClick={() => onCambiar(sumarDias(dia, -1))}>
        ←
      </button>
      <input
        type="date"
        aria-label="Elegir día"
        value={dia}
        onChange={(evento) => evento.target.value && onCambiar(evento.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
      />
      <button type="button" className={claseBotonDia} aria-label="Día siguiente" onClick={() => onCambiar(sumarDias(dia, 1))}>
        →
      </button>
      {/* Siempre visible (aunque desactivado) para que las flechas no cambien de lugar */}
      <button
        type="button"
        className={`${claseBotonDia} disabled:cursor-default disabled:opacity-40`}
        disabled={dia === hoy}
        onClick={() => onCambiar(hoy)}
      >
        Hoy
      </button>
    </div>
  );
}
