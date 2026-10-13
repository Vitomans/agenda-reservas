import { diaLargo, nombreDelDia, numeroDelDia } from "@/lib/fechas";

type Props = {
  dias: string[]; // los 7 días que manda la API; el primero es hoy
  elegido: string;
  onElegir: (dia: string) => void;
};

export function TiraDeDias({ dias, elegido, onElegir }: Props) {
  const hoy = dias[0];

  return (
    <div role="group" aria-label="Día" className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {dias.map((dia) => {
        const activo = dia === elegido;
        return (
          <button
            key={dia}
            type="button"
            aria-pressed={activo}
            aria-label={diaLargo(dia)}
            onClick={() => onElegir(dia)}
            className={`flex flex-col items-center rounded-xl border py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activo
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <span className={`text-[11px] font-medium sm:text-xs ${activo ? "text-blue-100" : "text-slate-500"}`}>
              {nombreDelDia(dia, hoy)}
            </span>
            <span className="text-lg font-semibold tabular-nums">{numeroDelDia(dia)}</span>
          </button>
        );
      })}
    </div>
  );
}
