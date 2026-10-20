"use client";

import Link from "next/link";
import { useState } from "react";
import { useCancelarReserva, useHorario, useMisReservas } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { describirHorario } from "@/lib/fechas";
import { Aviso, Cargando } from "./Aviso";
import { Boton } from "./Boton";
import { VistaDelCorreo } from "./VistaDelCorreo";

export function MisReservas() {
  const horario = useHorario();
  const reservas = useMisReservas();
  const cancelar = useCancelarReserva();
  // La reserva que espera la confirmación "¿Seguro?", para no cancelar con un toque sin querer
  const [porCancelar, setPorCancelar] = useState<string | null>(null);
  // La reserva cuyo correo de confirmación se está mirando
  const [correoDe, setCorreoDe] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold uppercase italic">Mis reservas</h1>
        <p className="mt-1 text-sm text-slate-600">Tus próximas horas. Puedes cancelar hasta que empiece la hora.</p>
      </div>

      {cancelar.isError && <Aviso>{cancelar.error.message}</Aviso>}
      {cancelar.isSuccess && <Aviso tipo="exito">Reserva cancelada. La hora quedó libre para otros jugadores.</Aviso>}

      {reservas.isPending || horario.isPending ? (
        <Cargando />
      ) : reservas.isError || horario.isError ? (
        <Aviso>No se pudieron cargar tus reservas. Intenta de nuevo en un momento.</Aviso>
      ) : reservas.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-slate-600">No tienes reservas próximas.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Reservar una cancha
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {reservas.data.map((reserva) => (
            <li
              key={reserva.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-semibold">{reserva.recurso.nombre}</p>
                <p className="text-sm text-slate-600 tabular-nums">
                  {describirHorario(reserva.inicio, reserva.fin, horario.data.zonaHoraria)} · {formatearPesos(reserva.precio)}
                </p>
              </div>

              {porCancelar === reserva.id ? (
                // "No" queda donde estaba "Cancelar", así un doble toque no cancela sin querer
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">¿Seguro?</span>
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
                <div className="flex items-center gap-2">
                  <Boton variante="secundario" onClick={() => setCorreoDe(reserva.id)}>
                    Ver correo
                  </Boton>
                  <Boton
                    variante="peligro"
                    onClick={() => {
                      cancelar.reset();
                      setPorCancelar(reserva.id);
                    }}
                  >
                    Cancelar
                  </Boton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {correoDe && <VistaDelCorreo reservaId={correoDe} onCerrar={() => setCorreoDe(null)} />}
    </div>
  );
}
