import { formatearPesos } from "@/lib/dinero";
import type { Horario } from "@/lib/tipos";
import { EnVivo } from "../EnVivo";
import { LineasDeCancha } from "../LineasDeCancha";

type Props = {
  horario: Horario;
  canchas: number;
  enVivo: boolean;
};

const dosDigitos = (hora: number) => `${String(hora).padStart(2, "0")}:00`;

// La portada de la página de reservar: el club, su horario, los precios y si la página está en vivo
export function Portada({ horario, canchas, enVivo }: Props) {
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
      </div>
    </section>
  );
}
