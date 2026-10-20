"use client";

import { useState } from "react";
import { useCancelarReserva, useReservasDelDia } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { horaEnElClub } from "@/lib/fechas";
import type { Recurso, ReservaAdmin } from "@/lib/tipos";
import { Aviso, Cargando } from "../Aviso";
import { Boton } from "../Boton";
import { TableroDelDia } from "./TableroDelDia";

type Vista = "tablero" | "lista";

const VISTAS: { vista: Vista; texto: string }[] = [
  { vista: "tablero", texto: "Tablero" },
  { vista: "lista", texto: "Lista" },
];

type Props = {
  dia: string;
  hoy: string;
  canchas: Recurso[]; // las canchas activas
  horas: string[];
  zonaHoraria: string;
};

// Las reservas de un día, de dos formas: el tablero (todo el club de un vistazo)
// o la lista (con el email de cada jugador y el botón para cancelar)
export function ReservasDelDia({ dia, hoy, canchas, horas, zonaHoraria }: Props) {
  const reservas = useReservasDelDia(dia);
  const [vista, setVista] = useState<Vista>("tablero");
  // La hora en que se abrió el panel: sirve para no ofrecer cancelar reservas que ya empezaron
  const [ahora] = useState(() => Date.now());

  const confirmadas = reservas.data?.filter((r) => r.estado === "CONFIRMADA").length ?? 0;

  return (
    <section aria-labelledby="titulo-reservas" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-reservas" className="font-semibold">
            Reservas del día
          </h2>
          <p className="text-sm text-slate-600">
            {confirmadas} {confirmadas === 1 ? "confirmada" : "confirmadas"}
          </p>
        </div>

        <div role="group" aria-label="Vista" className="flex rounded-lg bg-slate-100 p-1">
          {VISTAS.map(({ vista: opcion, texto }) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={vista === opcion}
              onClick={() => setVista(opcion)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${
                vista === opcion ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {reservas.isPending ? (
          <Cargando />
        ) : reservas.isError ? (
          <Aviso>{reservas.error.message}</Aviso>
        ) : vista === "tablero" ? (
          <TableroDelDia
            dia={dia}
            hoy={hoy}
            canchas={canchas}
            reservas={reservas.data}
            horas={horas}
            zonaHoraria={zonaHoraria}
            ahora={ahora}
          />
        ) : (
          // Con otra "key" la lista empieza de cero al cambiar de día (sin un "¿Seguro?" pendiente)
          <ListaDeReservas key={dia} reservas={reservas.data} zonaHoraria={zonaHoraria} ahora={ahora} />
        )}
      </div>
    </section>
  );
}

function ListaDeReservas({ reservas, zonaHoraria, ahora }: { reservas: ReservaAdmin[]; zonaHoraria: string; ahora: number }) {
  const cancelar = useCancelarReserva();
  const [porCancelar, setPorCancelar] = useState<string | null>(null);

  if (reservas.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No hay reservas este día.</p>;
  }

  return (
    <div className="space-y-3">
      {cancelar.isError && <Aviso>{cancelar.error.message}</Aviso>}

      <ul className="divide-y divide-slate-100">
        {reservas.map((reserva) => {
          const cancelada = reserva.estado === "CANCELADA";
          const sePuedeCancelar = !cancelada && new Date(reserva.inicio).getTime() > ahora;

          return (
            <li key={reserva.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${cancelada ? "opacity-60" : ""}`}>
              <span className="w-14 font-semibold tabular-nums">{horaEnElClub(reserva.inicio, zonaHoraria)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {reserva.recurso.nombre} · <span className="tabular-nums">{formatearPesos(reserva.precio)}</span>
                  {cancelada && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                      Cancelada
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {reserva.usuario.nombre} · {reserva.usuario.email}
                </p>
              </div>

              {sePuedeCancelar &&
                (porCancelar === reserva.id ? (
                  // "No" queda donde estaba "Cancelar", así un doble toque no cancela sin querer
                  <div className="flex items-center gap-2">
                    <Boton
                      variante="peligro"
                      cargando={cancelar.isPending}
                      onClick={() => cancelar.mutate(reserva.id, { onSettled: () => setPorCancelar(null) })}
                    >
                      Sí, cancelar
                    </Boton>
                    <Boton variante="secundario" onClick={() => setPorCancelar(null)} disabled={cancelar.isPending}>
                      No
                    </Boton>
                  </div>
                ) : (
                  <Boton
                    variante="peligro"
                    onClick={() => {
                      cancelar.reset();
                      setPorCancelar(reserva.id);
                    }}
                  >
                    Cancelar
                  </Boton>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
