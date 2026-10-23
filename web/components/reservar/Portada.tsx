import { ID_DEL_BOTON } from "@/lib/asistente";
import { formatearPesos } from "@/lib/dinero";
import type { Horario } from "@/lib/tipos";
import { EnVivo } from "../EnVivo";
import { LineasDeCancha } from "../LineasDeCancha";

type Props = {
  horario: Horario;
  canchas: number;
  enVivo: boolean;
  // El botón para abrir el asistente con IA, y si ya está abierto
  onPreguntar: () => void;
  preguntando: boolean;
};

const dosDigitos = (hora: number) => `${String(hora).padStart(2, "0")}:00`;

// La portada de la página de reservar: el club, su horario, los precios, si la página está en vivo
// y el botón del asistente con IA
export function Portada({ horario, canchas, enVivo, onPreguntar, preguntando }: Props) {
  const { tarifa, horaApertura, horaCierre } = horario;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-blue-900 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
      <LineasDeCancha className="pointer-events-none absolute -right-16 top-1/2 w-[34rem] -translate-y-1/2 -rotate-6 text-white/10 sm:-right-4" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">Club de pádel</p>
          <EnVivo conectado={enVivo} />
        </div>

        <h1 className="mt-2 font-display text-5xl leading-[0.9] font-bold uppercase italic sm:text-6xl">Reserva tu cancha</h1>
        <p className="mt-3 max-w-md text-sm text-blue-100">
          {canchas} canchas, de {dosDigitos(horaApertura)} a {dosDigitos(horaCierre)}. Mira los horarios libres en vivo:
          cada reserva dura 1 hora.
        </p>

        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          <li className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 ring-inset">
            <strong className="tabular-nums">{formatearPesos(tarifa.precioNormal)}</strong> la hora
          </li>
          <li className="rounded-full bg-lime-400 px-3 py-1 text-slate-900">
            <strong className="tabular-nums">{formatearPesos(tarifa.precioPunta)}</strong> en hora punta
          </li>
        </ul>
        <p className="mt-2 text-xs text-blue-200">
          Hora punta: de lunes a viernes desde las {dosDigitos(tarifa.inicioPuntaEntreSemana)}, y todo el fin de semana.
        </p>

        <button
          id={ID_DEL_BOTON}
          type="button"
          onClick={onPreguntar}
          aria-expanded={preguntando}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V14h0a2 2 0 0 1-2-2V4.5Z" />
          </svg>
          Pregúntale al asistente
          {/* Solo se ve: el lector de pantalla dice "Pregúntale al asistente", y el chat ya avisa que responde una IA */}
          <span aria-hidden="true" className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wider text-slate-900">
            IA
          </span>
        </button>
      </div>
    </section>
  );
}
