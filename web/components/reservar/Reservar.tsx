"use client";

import Link from "next/link";
import { useState } from "react";
import { useDisponibilidad, useHorario, useRecursos, useReservar } from "@/lib/consultas";
import { describirHorario, diaLargo, horaEnElClub } from "@/lib/fechas";
import type { Reserva } from "@/lib/tipos";
import { Aviso, Cargando } from "../Aviso";
import { Boton } from "../Boton";
import { GrillaDeHorarios, Leyenda } from "./GrillaDeHorarios";
import { SelectorDeCancha } from "./SelectorDeCancha";
import { TiraDeDias } from "./TiraDeDias";

// La pantalla principal del jugador: elige cancha, día y hora, y reserva
export function Reservar() {
  const horario = useHorario();
  const recursos = useRecursos();
  const reservar = useReservar();

  const [recursoElegido, setRecursoElegido] = useState<string | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [inicioElegido, setInicioElegido] = useState<string | null>(null);
  const [reservaHecha, setReservaHecha] = useState<Reserva | null>(null);

  // Si no se eligió nada (o lo elegido ya no está, por ejemplo al cambiar el día a medianoche),
  // se usa la primera cancha y el día de hoy
  const dias = horario.data?.dias ?? [];
  const dia = diaElegido && dias.includes(diaElegido) ? diaElegido : dias[0];
  const recurso = recursos.data?.find((r) => r.id === recursoElegido) ?? recursos.data?.[0];

  const disponibilidad = useDisponibilidad(recurso?.id, dia);
  // El bloque elegido, solo si sigue libre (alguien podría haberlo tomado mientras tanto)
  const bloqueElegido = disponibilidad.data?.find((b) => b.inicio === inicioElegido && b.estado === "libre");

  if (horario.isPending || recursos.isPending) {
    return <Cargando />;
  }
  if (horario.isError || recursos.isError) {
    return <Aviso>No se pudieron cargar las canchas. Intenta de nuevo en un momento.</Aviso>;
  }
  if (!recurso || !dia) {
    return <Aviso>Por ahora no hay canchas disponibles.</Aviso>;
  }

  const { zonaHoraria } = horario.data;

  // Al cambiar algo se borran la elección y los mensajes anteriores
  function empezarDeNuevo() {
    setInicioElegido(null);
    setReservaHecha(null);
    reservar.reset();
  }

  function confirmar() {
    if (!recurso || !bloqueElegido) return;
    reservar.mutate(
      { recursoId: recurso.id, inicio: bloqueElegido.inicio },
      {
        onSuccess: (reserva) => {
          setReservaHecha(reserva);
          setInicioElegido(null);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reservar cancha</h1>
        <p className="mt-1 text-sm text-slate-600">Elige la cancha, el día y la hora. Cada reserva dura 1 hora.</p>
      </div>

      <div className="space-y-3">
        <SelectorDeCancha
          recursos={recursos.data}
          elegido={recurso.id}
          onElegir={(id) => {
            setRecursoElegido(id);
            empezarDeNuevo();
          }}
        />
        <TiraDeDias
          dias={dias}
          elegido={dia}
          onElegir={(nuevoDia) => {
            setDiaElegido(nuevoDia);
            empezarDeNuevo();
          }}
        />
      </div>

      {reservaHecha && (
        <Aviso tipo="exito">
          ¡Listo! Reservaste la {reservaHecha.recurso.nombre} el{" "}
          {describirHorario(reservaHecha.inicio, reservaHecha.fin, zonaHoraria)}.{" "}
          <Link href="/mis-reservas" className="font-medium underline">
            Ver mis reservas
          </Link>
        </Aviso>
      )}
      {reservar.error && <Aviso>{reservar.error.message}</Aviso>}

      <section aria-labelledby="titulo-horarios" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-horarios" className="font-semibold first-letter:uppercase">
            {recurso.nombre} · {diaLargo(dia)}
          </h2>
          <Leyenda />
        </div>

        {disponibilidad.isPending ? (
          <Cargando texto="Buscando horarios…" />
        ) : disponibilidad.isError ? (
          <Aviso>{disponibilidad.error.message}</Aviso>
        ) : (
          <GrillaDeHorarios
            bloques={disponibilidad.data}
            elegido={inicioElegido}
            onElegir={(bloque) => {
              empezarDeNuevo();
              setInicioElegido(bloque.inicio);
            }}
          />
        )}
      </section>

      {/* La barra para confirmar queda pegada abajo de la pantalla, cómoda para el pulgar en el celular */}
      {bloqueElegido && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
          <div>
            <p className="text-sm text-slate-300 first-letter:uppercase">
              {recurso.nombre} · {diaLargo(dia)}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {bloqueElegido.hora} a {horaEnElClub(bloqueElegido.fin, zonaHoraria)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInicioElegido(null)}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <Boton variante="destacado" cargando={reservar.isPending} onClick={confirmar}>
              Reservar
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
