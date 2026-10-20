import type { Recurso } from "@/lib/tipos";

type Props = {
  recursos: Recurso[];
  elegido: string;
  onElegir: (recursoId: string) => void;
};

// Las canchas en columnas iguales de al menos 4,5rem. En un celular caben las 4 en una fila,
// y si el club agrega más canchas, las que no caben bajan a otra fila (nunca quedan cortadas en el borde).
export function SelectorDeCancha({ recursos, elegido, onElegir }: Props) {
  return (
    <div
      role="group"
      aria-label="Cancha"
      className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1 rounded-xl border border-slate-200 bg-white p-1"
    >
      {recursos.map((recurso) => {
        const activo = recurso.id === elegido;
        return (
          <button
            key={recurso.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(recurso.id)}
            className={`truncate rounded-lg px-1 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activo ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {recurso.nombre}
          </button>
        );
      })}
    </div>
  );
}
