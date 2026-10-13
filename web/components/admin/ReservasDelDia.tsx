"use client";

import { useState } from "react";
import { useCancelarReserva, useReservasDelDia } from "@/lib/consultas";
import { diaLargo, horaEnElClub, sumarDias } from "@/lib/fechas";
import { Aviso, Cargando } from "../Aviso";
import { Boton } from "../Boton";

const claseBotonDia =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function ReservasDelDia({ hoy, zonaHoraria }: { hoy: string; zonaHoraria: string }) {
  const [dia, setDia] = useState(hoy);
  const reservas = useReservasDelDia(dia);
  const cancelar = useCancelarReserva();
  const [porCancelar, setPorCancelar] = useState<string | null>(null);
  // La hora en que se abrió el panel: sirve para no ofrecer cancelar reservas que ya empezaron
  const [ahora] = useState(() => Date.now());

  const confirmadas = reservas.data?.filter((r) => r.estado === "CONFIRMADA").length ?? 0;

  function cambiarDia(nuevoDia: string) {
    setDia(nuevoDia);
    setPorCancelar(null);
    cancelar.reset();
  }

  return (
    <section aria-labelledby="titulo-reservas" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-reservas" className="font-semibold">
            Reservas del día
          </h2>
          <p className="text-sm text-slate-600 first-letter:uppercase">
            {diaLargo(dia)} · {confirmadas} {confirmadas === 1 ? "confirmada" : "confirmadas"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={claseBotonDia} aria-label="Día anterior" onClick={() => cambiarDia(sumarDias(dia, -1))}>
            ←
          </button>
          <input
            type="date"
            aria-label="Elegir día"
            value={dia}
            onChange={(evento) => evento.target.value && cambiarDia(evento.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button type="button" className={claseBotonDia} aria-label="Día siguiente" onClick={() => cambiarDia(sumarDias(dia, 1))}>
            →
          </button>
          {/* Siempre visible (aunque desactivado) para que las flechas no cambien de lugar */}
          <button
            type="button"
            className={`${claseBotonDia} disabled:cursor-default disabled:opacity-40`}
            disabled={dia === hoy}
            onClick={() => cambiarDia(hoy)}
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {cancelar.isError && <Aviso>{cancelar.error.message}</Aviso>}

        {reservas.isPending ? (
          <Cargando />
        ) : reservas.isError ? (
          <Aviso>{reservas.error.message}</Aviso>
        ) : reservas.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No hay reservas este día.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reservas.data.map((reserva) => {
              const cancelada = reserva.estado === "CANCELADA";
              const sePuedeCancelar = !cancelada && new Date(reserva.inicio).getTime() > ahora;

              return (
                <li key={reserva.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${cancelada ? "opacity-60" : ""}`}>
                  <span className="w-14 font-semibold tabular-nums">{horaEnElClub(reserva.inicio, zonaHoraria)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {reserva.recurso.nombre}
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
                      <Boton variante="peligro" onClick={() => setPorCancelar(reserva.id)}>
                        Cancelar
                      </Boton>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
