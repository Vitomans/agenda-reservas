"use client";

import { useState } from "react";
import { useCanchasAdmin, useHorario } from "@/lib/consultas";
import { diaLargo } from "@/lib/fechas";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Horario, RecursoAdmin } from "@/lib/tipos";
import { Aviso, Cargando } from "../Aviso";
import { EnVivo } from "../EnVivo";
import { CanchasAdmin } from "./CanchasAdmin";
import { ReservasDelDia } from "./ReservasDelDia";
import { ResumenDelDia } from "./ResumenDelDia";
import { SelectorDeDia } from "./SelectorDeDia";

export function PanelAdmin() {
  const horario = useHorario();
  const canchas = useCanchasAdmin();
  // El admin sigue todas las canchas: si alguien reserva o cancela, el resumen y las reservas se actualizan solos
  const enVivo = useTiempoReal(canchas.data?.map((cancha) => cancha.id) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="mt-1 text-sm text-slate-600">Mira cómo va el club, las reservas de cualquier día y gestiona las canchas.</p>
        </div>
        <EnVivo conectado={enVivo} />
      </div>

      {horario.isPending ? (
        <Cargando />
      ) : horario.isError ? (
        <Aviso>No se pudo cargar el panel. Intenta de nuevo en un momento.</Aviso>
      ) : (
        <ContenidoDelPanel horario={horario.data} canchas={canchas.data ?? []} />
      )}
    </div>
  );
}

function ContenidoDelPanel({ horario, canchas }: { horario: Horario; canchas: RecursoAdmin[] }) {
  const { dias, zonaHoraria, horaApertura, horaCierre } = horario;
  const hoy = dias[0];
  // El día que se está mirando. Si no se eligió ninguno, es hoy.
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const dia = diaElegido ?? hoy;

  // Una fila del tablero por cada hora del club: "08:00", "09:00"...
  const horas = Array.from({ length: horaCierre - horaApertura }, (_, i) => `${String(horaApertura + i).padStart(2, "0")}:00`);
  // El tablero muestra las canchas activas. Las reservas de una cancha desactivada siguen en la lista.
  const canchasActivas = canchas.filter((cancha) => cancha.activo);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold first-letter:uppercase">{diaLargo(dia)}</p>
        <SelectorDeDia dia={dia} hoy={hoy} onCambiar={setDiaElegido} />
      </div>

      <ResumenDelDia dia={dia} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReservasDelDia dia={dia} hoy={hoy} canchas={canchasActivas} horas={horas} zonaHoraria={zonaHoraria} />
        </div>
        <CanchasAdmin />
      </div>
    </>
  );
}
