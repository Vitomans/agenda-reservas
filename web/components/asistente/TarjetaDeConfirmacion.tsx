import Link from "next/link";
import type { ReactNode } from "react";
import type { EstadoDeLaTarjeta } from "@/lib/asistente";
import { Boton, Ruedita } from "../Boton";
import { Icono } from "./Iconos";

type Props = {
  accion: "reservar" | "cancelar";
  estado: Exclude<EstadoDeLaTarjeta, "revisando">;
  // Lo que se va a hacer, armado por la API con los datos de la base: "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000"
  descripcion?: string;
  // Al reservar, la línea con el tiempo que hará a esa hora ("18 °C · lluvia ligera")
  pronostico?: ReactNode;
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

// La reserva que espera una respuesta va en lima, como la hora elegida en la grilla. La cancelación, en blanco
// con su botón rojo. Después, verde si se hizo, rojo si no se pudo y gris si la persona dijo que no.
const CLASES: Record<Props["accion"], Record<Props["estado"], string>> = {
  reservar: {
    pendiente: "border-lime-400 bg-lime-50",
    confirmando: "border-lime-400 bg-lime-50",
    hecha: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rechazada: "border-slate-200 bg-slate-50 text-slate-600",
    "no-se-pudo": "border-red-200 bg-red-50 text-red-800",
    vencida: "border-slate-200 bg-slate-50 text-slate-600",
  },
  cancelar: {
    pendiente: "border-slate-300 bg-white",
    confirmando: "border-slate-300 bg-white",
    hecha: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rechazada: "border-slate-200 bg-slate-50 text-slate-600",
    "no-se-pudo": "border-red-200 bg-red-50 text-red-800",
    vencida: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

// La tarjeta con la que la persona confirma una reserva (o una cancelación) que le propuso el asistente.
// La IA no reserva sola: la API espera a que la persona toque "Confirmar". Después, la tarjeta muestra cómo terminó.
// Si no se pudo, el asistente explica el motivo con palabras justo debajo.
export function TarjetaDeConfirmacion({ accion, estado, descripcion, pronostico, conSesion, ocupado, onResponder }: Props) {
  const textos = TEXTOS[accion];
  const titulo = textos[estado];
  // Sin sesión, reservar es "como invitado", igual que en la barra para reservar de la grilla
  const comoInvitado = accion === "reservar" && !conSesion;

  return (
    <div role="group" aria-label={titulo} className={`rounded-2xl border p-3 text-sm ${CLASES[accion][estado]}`}>
      <p className="flex items-center gap-2 font-semibold">
        {estado === "confirmando" ? (
          <Ruedita />
        ) : (
          <Icono nombre={estado === "hecha" ? "listo" : "ticket"} className={estado === "hecha" ? "size-4" : "size-4 opacity-70"} />
        )}
        {titulo}
      </p>
      {descripcion && <Descripcion texto={descripcion} />}
      {/* Solo mientras la reserva sigue en pie: si la persona dijo que no, o no se pudo, ya no importa */}
      {pronostico && (estado === "pendiente" || estado === "confirmando" || estado === "hecha") && <div className="mt-1.5">{pronostico}</div>}

      {estado === "pendiente" && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante={accion === "cancelar" ? "peligro" : "principal"}
              cargando={ocupado}
              onClick={() => onResponder(true)}
              className="flex-1 whitespace-nowrap"
            >
              {comoInvitado ? "Reservar como invitado" : textos.confirmar}
            </Boton>
            <Boton variante="secundario" disabled={ocupado} onClick={() => onResponder(false)} className="flex-1 whitespace-nowrap">
              {textos.noConfirmar}
            </Boton>
          </div>
          {comoInvitado && <p className="mt-2 text-xs text-slate-600">Sin registrarte: se crea un jugador invitado solo para ti.</p>}
        </>
      )}

      {estado === "hecha" && accion === "reservar" && (
        <Link href="/mis-reservas" className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2">
          Ver mis reservas
          <Icono nombre="flecha" className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

// "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000", con la cancha destacada. El texto queda igual
// (con los puntos), así el lector de pantalla lo lee tal como lo armó la API.
function Descripcion({ texto }: { texto: string }) {
  const [cancha, ...resto] = texto.split(" · ");
  return (
    <p className="mt-1.5 tabular-nums">
      <strong className="font-semibold">{cancha}</strong>
      {resto.length > 0 && ` · ${resto.join(" · ")}`}
    </p>
  );
}
