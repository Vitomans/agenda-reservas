import type { Recurso } from "@/lib/tipos";

type Props = {
  recursos: Recurso[];
  elegido: string;
  onElegir: (recursoId: string) => void;
};

export function SelectorDeCancha({ recursos, elegido, onElegir }: Props) {
  return (
    <div role="group" aria-label="Cancha" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {recursos.map((recurso) => {
        const activo = recurso.id === elegido;
        return (
          <button
            key={recurso.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(recurso.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activo
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {recurso.nombre}
          </button>
        );
      })}
    </div>
  );
}
