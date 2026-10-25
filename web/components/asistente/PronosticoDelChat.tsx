import { diaLargo } from "@/lib/fechas";
import type { PedidoDePronostico, PronosticoDelChat as Pronostico } from "@/lib/tipos";
import { CreditoDeMet, IconoDelTiempo, textoDeGrados } from "../Pronostico";

type Props = {
  pedido: PedidoDePronostico; // lo que pidió el asistente (el día)
  pronostico: Pronostico; // lo que le respondió la API
};

// El pronóstico que consultó el asistente, por tramos: las horas seguidas con el mismo cielo, juntas.
// Si no hay pronóstico (el día no se puede reservar o el servicio no responde), no se dibuja nada:
// el asistente lo explica con palabras.
export function PronosticoDelChat({ pedido, pronostico }: Props) {
  if (pronostico.aviso || pronostico.tramos.length === 0) return null;

  const titulo = `Pronóstico del ${diaLargo(pedido.fecha)}`;

  return (
    <div role="group" aria-label={titulo} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
      <p className="mb-2 font-semibold">{titulo}</p>
      <ul className="space-y-2">
        {pronostico.tramos.map(({ desde, hasta, cielo, descripcion, deNoche, minima, maxima }) => (
          <li key={desde} className="flex items-center gap-2.5">
            <IconoDelTiempo cielo={cielo} deNoche={deNoche} className="size-6 text-blue-700" />
            <div className="min-w-0 flex-1">
              <p className="font-medium first-letter:uppercase">{descripcion}</p>
              <p className="text-xs text-slate-600 tabular-nums">
                {desde} a {hasta}
              </p>
            </div>
            <p className="font-semibold whitespace-nowrap tabular-nums">{textoDeGrados(minima, maxima)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Las canchas son techadas: se juega igual. <CreditoDeMet />
      </p>
    </div>
  );
}
