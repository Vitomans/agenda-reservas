"use client";

import { useCanchasAdmin, useHorario } from "@/lib/consultas";
import { useTiempoReal } from "@/lib/tiempoReal";
import { Aviso, Cargando } from "../Aviso";
import { EnVivo } from "../EnVivo";
import { CanchasAdmin } from "./CanchasAdmin";
import { ReservasDelDia } from "./ReservasDelDia";

export function PanelAdmin() {
  const horario = useHorario();
  const canchas = useCanchasAdmin();
  // El admin sigue todas las canchas: si alguien reserva o cancela, la lista del día se actualiza sola
  const enVivo = useTiempoReal(canchas.data?.map((cancha) => cancha.id) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="mt-1 text-sm text-slate-600">Revisa las reservas de cualquier día y gestiona las canchas del club.</p>
        </div>
        <EnVivo conectado={enVivo} />
      </div>

      {horario.isPending ? (
        <Cargando />
      ) : horario.isError ? (
        <Aviso>No se pudo cargar el panel. Intenta de nuevo en un momento.</Aviso>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ReservasDelDia hoy={horario.data.dias[0]} zonaHoraria={horario.data.zonaHoraria} />
          </div>
          <CanchasAdmin />
        </div>
      )}
    </div>
  );
}
