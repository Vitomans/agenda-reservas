import { formatearPesos } from "@/lib/dinero";
import { diaLargo } from "@/lib/fechas";
import type { MisReservasDelChat, ReservaDelChat } from "@/lib/tipos";
import { Boton } from "../Boton";

type Props = {
  misReservas: MisReservasDelChat; // lo que encontró la herramienta verMisReservas
  canceladas: Set<string>; // las que ya se cancelaron después en la conversación
  onCancelar: (reserva: ReservaDelChat) => void;
  deshabilitado: boolean; // mientras el asistente responde
};

// Las próximas reservas de quien conversa, que buscó el asistente. Al tocar "Cancelar" en una, se le pide al
// asistente que la cancele, y él muestra la tarjeta para confirmar. Si no hay ninguna, no se dibuja nada:
// el asistente lo dice con palabras.
export function ReservasDelChat({ misReservas, canceladas, onCancelar, deshabilitado }: Props) {
  if (misReservas.aviso || misReservas.reservas.length === 0) return null;

  return (
    <div role="group" aria-label="Tus próximas reservas" className="rounded-2xl border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold">Tus próximas reservas</p>
      <ul className="space-y-2">
        {misReservas.reservas.map((reserva) => (
          <li key={reserva.id} className="flex items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-medium">{reserva.cancha}</p>
              <p className="text-slate-600 tabular-nums first-letter:uppercase">
                {diaLargo(reserva.fecha)} · {reserva.hora} · {formatearPesos(reserva.precio)}
              </p>
            </div>
            {canceladas.has(reserva.id) ? (
              <span className="text-xs font-medium text-slate-500">Cancelada</span>
            ) : (
              <Boton
                variante="peligro"
                disabled={deshabilitado}
                onClick={() => onCancelar(reserva)}
                aria-label={`Cancelar la reserva de la ${reserva.cancha} del ${diaLargo(reserva.fecha)} a las ${reserva.hora}`}
                className="px-3 py-1.5"
              >
                Cancelar
              </Boton>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
