import Link from "next/link";
import type { Casilla } from "@/lib/casillas";
import { formatearPesos } from "@/lib/dinero";
import { diaLargo, horaEnElClub } from "@/lib/fechas";
import type { Recurso } from "@/lib/tipos";
import { Boton } from "../Boton";

type Props = {
  casilla: Casilla; // la cancha y la hora elegidas (libres)
  dia: string;
  zonaHoraria: string;
  // En la vista por hora: las canchas libres a esa hora, para elegir otra
  canchasLibres?: Recurso[];
  onElegirCancha?: (recursoId: string) => void;
  conSesion: boolean;
  cargando: boolean;
  onReservar: () => void;
  onCancelar: () => void;
};

// La barra para confirmar la reserva. Queda pegada abajo de la pantalla, cómoda para el pulgar en el celular.
// Quien no entró puede reservar igual: se crea un jugador invitado en el mismo paso.
export function BarraParaReservar({
  casilla,
  dia,
  zonaHoraria,
  canchasLibres = [],
  onElegirCancha,
  conSesion,
  cargando,
  onReservar,
  onCancelar,
}: Props) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
      <div>
        <p className="text-sm text-slate-300 first-letter:uppercase">
          {casilla.cancha.nombre} · {diaLargo(dia)}
        </p>
        <p className="text-lg font-semibold tabular-nums">
          {casilla.hora} a {horaEnElClub(casilla.fin, zonaHoraria)} · {formatearPesos(casilla.precio)}
        </p>
        {canchasLibres.length > 1 && onElegirCancha && (
          <div role="group" aria-label="Cancha" className="mt-2 flex flex-wrap gap-1.5">
            {canchasLibres.map((cancha) => {
              const activa = cancha.id === casilla.cancha.id;
              return (
                <button
                  key={cancha.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => onElegirCancha(cancha.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 ${
                    activa ? "border-lime-400 bg-lime-400 text-slate-900" : "border-slate-600 text-slate-200 hover:border-slate-400"
                  }`}
                >
                  {cancha.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">
          Cancelar
        </button>
        <Boton variante="destacado" cargando={cargando} onClick={onReservar} className="flex-1 sm:flex-none">
          {conSesion ? "Reservar" : "Reservar como invitado"}
        </Boton>
      </div>

      {!conSesion && (
        <p className="w-full text-xs text-slate-400">
          Sin registrarte: se crea un jugador invitado solo para ti. ¿Tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-white underline">
            Inicia sesión
          </Link>
          .
        </p>
      )}
    </div>
  );
}
