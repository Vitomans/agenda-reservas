import Link from "next/link";
import type { EstadoDeLaTarjeta } from "@/lib/asistente";
import { Boton, Ruedita } from "../Boton";

type Props = {
  accion: "reservar" | "cancelar";
  estado: Exclude<EstadoDeLaTarjeta, "revisando">;
  // Lo que se va a hacer, armado por la API con los datos de la base: "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000"
  descripcion?: string;
  conSesion: boolean; // sin sesión, al confirmar una reserva se crea un jugador invitado
  ocupado: boolean; // mientras el asistente responde, o mientras se crea el jugador invitado
  onResponder: (confirma: boolean) => void;
};

const TEXTOS = {
  reservar: {
    pendiente: "¿Confirmas esta reserva?",
    confirmando: "Reservando…",
    hecha: "Reservada",
    rechazada: "No la reservaste",
    "no-se-pudo": "No se pudo hacer la reserva",
    vencida: "Quedó sin confirmar",
    confirmar: "Confirmar",
    noConfirmar: "No, gracias",
  },
  cancelar: {
    pendiente: "¿Cancelas esta reserva?",
    confirmando: "Cancelando…",
    hecha: "Cancelada: la hora quedó libre",
    rechazada: "No la cancelaste",
    "no-se-pudo": "No se pudo cancelar la reserva",
    vencida: "Quedó sin confirmar",
    confirmar: "Sí, cancelar",
    noConfirmar: "No",
  },
} as const;

const CLASES: Record<Props["estado"], string> = {
  pendiente: "border-blue-200 bg-white",
  confirmando: "border-blue-200 bg-white",
  hecha: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rechazada: "border-slate-200 bg-slate-50 text-slate-600",
  "no-se-pudo": "border-red-200 bg-red-50 text-red-800",
  vencida: "border-slate-200 bg-slate-50 text-slate-600",
};

// La tarjeta con la que la persona confirma una reserva (o una cancelación) que le propuso el asistente.
// La IA no reserva sola: la API espera a que la persona toque "Confirmar". Después, la tarjeta muestra cómo terminó.
// Si no se pudo, el asistente explica el motivo con palabras justo debajo.
export function TarjetaDeConfirmacion({ accion, estado, descripcion, conSesion, ocupado, onResponder }: Props) {
  const textos = TEXTOS[accion];
  const titulo = textos[estado];
  // Sin sesión, reservar es "como invitado", igual que en la barra para reservar de la grilla
  const comoInvitado = accion === "reservar" && !conSesion;

  return (
    <div role="group" aria-label={titulo} className={`rounded-2xl border p-3 text-sm ${CLASES[estado]}`}>
      <p className="flex items-center gap-2 font-semibold">
        {estado === "confirmando" && <Ruedita />}
        {estado === "hecha" && (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {titulo}
      </p>
      {descripcion && <p className="mt-1 tabular-nums">{descripcion}</p>}

      {estado === "pendiente" && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante={accion === "cancelar" ? "peligro" : "principal"} cargando={ocupado} onClick={() => onResponder(true)}>
              {comoInvitado ? "Reservar como invitado" : textos.confirmar}
            </Boton>
            <Boton variante="secundario" disabled={ocupado} onClick={() => onResponder(false)}>
              {textos.noConfirmar}
            </Boton>
          </div>
          {comoInvitado && <p className="mt-2 text-xs text-slate-500">Sin registrarte: se crea un jugador invitado solo para ti.</p>}
        </>
      )}

      {estado === "hecha" && accion === "reservar" && (
        <Link href="/mis-reservas" className="mt-2 inline-block font-medium underline">
          Ver mis reservas
        </Link>
      )}
    </div>
  );
}
