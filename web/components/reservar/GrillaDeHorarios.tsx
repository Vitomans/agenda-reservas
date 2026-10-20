import type { Bloque, EstadoBloque } from "@/lib/tipos";

// Cómo se ve cada estado. Solo los bloques libres se pueden elegir.
const ESTADOS: Record<EstadoBloque, { texto: string; clases: string }> = {
  libre: {
    texto: "Libre",
    clases: "border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:bg-blue-50",
  },
  mio: {
    texto: "Tu reserva",
    clases: "border-blue-700 bg-blue-700 text-white",
  },
  ocupado: {
    texto: "Ocupado",
    clases: "border-slate-200 bg-slate-100 text-slate-400",
  },
  pasado: {
    texto: "Ya pasó",
    clases: "border-dashed border-slate-200 bg-transparent text-slate-300",
  },
};

type Props = {
  bloques: Bloque[];
  elegido: string | null; // el "inicio" del bloque elegido
  onElegir: (bloque: Bloque) => void;
  resaltados?: string[]; // los "inicio" de las horas que otra persona acaba de cambiar
};

export function GrillaDeHorarios({ bloques, elegido, onElegir, resaltados = [] }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {bloques.map((bloque) => {
        // Si otra persona tomó la hora elegida, se muestra como ocupada y no como elegida
        const estaElegido = bloque.inicio === elegido && bloque.estado === "libre";
        const estado = ESTADOS[bloque.estado];
        const texto = estaElegido ? "Elegido" : estado.texto;
        // Un destello si se mueve la pantalla; si la persona pidió menos animaciones, un borde quieto
        const resaltado = resaltados.includes(bloque.inicio)
          ? "motion-safe:animate-destello motion-reduce:ring-2 motion-reduce:ring-lime-400"
          : "";

        return (
          <li key={bloque.inicio}>
            <button
              type="button"
              disabled={bloque.estado !== "libre"}
              aria-pressed={bloque.estado === "libre" ? estaElegido : undefined}
              // Así un lector de pantalla dice "09:00, Libre" y no junta los dos textos
              aria-label={`${bloque.hora}, ${texto}`}
              onClick={() => onElegir(bloque)}
              className={`flex w-full flex-col items-center rounded-xl border px-2 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default ${
                estaElegido ? "border-lime-500 bg-lime-100 text-slate-900 ring-2 ring-lime-400" : estado.clases
              } ${resaltado}`}
            >
              <span className="text-base font-semibold tabular-nums">{bloque.hora}</span>
              <span className="text-xs">{texto}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Leyenda() {
  const muestras: { estado: EstadoBloque; clases: string }[] = [
    { estado: "libre", clases: "border-slate-300 bg-white" },
    { estado: "mio", clases: "border-blue-700 bg-blue-700" },
    { estado: "ocupado", clases: "border-slate-200 bg-slate-100" },
  ];

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      {muestras.map(({ estado, clases }) => (
        <li key={estado} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded border ${clases}`} />
          {ESTADOS[estado].texto}
        </li>
      ))}
    </ul>
  );
}
