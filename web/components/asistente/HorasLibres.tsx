import { formatearPesos } from "@/lib/dinero";
import { diaLargo } from "@/lib/fechas";
import type { HorariosLibres, PedidoDeHorarios } from "@/lib/tipos";
import { CLASES_BOTON_DE_HORA, ESTADOS } from "../reservar/GrillaDeHorarios";
import { Icono } from "./Iconos";

type Props = {
  pedido: PedidoDeHorarios; // lo que pidió el asistente (el día)
  horarios: HorariosLibres; // lo que le respondió la API
  onPedir: (hora: string) => void;
  deshabilitado: boolean; // mientras el asistente responde
};

// Las horas libres que encontró el asistente, como botones con el mismo aspecto que la grilla de la página.
// Al tocar una, se le pide esa hora al asistente. Si no hay ninguna (o el día no se puede reservar),
// no se dibuja nada: el asistente lo explica con palabras.
export function HorasLibres({ pedido, horarios, onPedir, deshabilitado }: Props) {
  if (horarios.aviso || horarios.horas.length === 0) return null;

  const titulo = `Libres el ${diaLargo(pedido.fecha)}`;

  return (
    <div role="group" aria-label={titulo} className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Icono nombre="reloj" className="size-4 text-blue-700" />
        {titulo}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {horarios.horas.map(({ hora, precio, canchas }) => {
          // Corto en la pantalla ("2 libres", como en la grilla por hora) y completo para el lector de pantalla
          const libres = `${canchas.length} ${canchas.length === 1 ? "libre" : "libres"}`;
          const canchasLibres = `${canchas.length} ${canchas.length === 1 ? "cancha libre" : "canchas libres"}`;
          return (
            <li key={hora}>
              <button
                type="button"
                disabled={deshabilitado}
                onClick={() => onPedir(hora)}
                // Así un lector de pantalla dice "19:00, 2 canchas libres, $16.000"
                aria-label={`${hora}, ${canchasLibres}, ${formatearPesos(precio)}`}
                className={`${CLASES_BOTON_DE_HORA} ${ESTADOS.libre.clases} py-2 disabled:opacity-60`}
              >
                <span className="font-semibold tabular-nums">{hora}</span>
                <span className="text-xs tabular-nums">{formatearPesos(precio)}</span>
                <span className="text-xs text-slate-600">{libres}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Toca una hora para pedirla.</p>
    </div>
  );
}
