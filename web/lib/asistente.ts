import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses, type UIDataTypes, type UIMessage } from "ai";
import { diaLargo } from "./fechas";
import type {
  HorariosLibres,
  InformacionDelClub,
  MisReservasDelChat,
  PedidoDeCancelacion,
  PedidoDeHorarios,
  PedidoDeInformacion,
  PedidoDePronostico,
  PedidoDeReserva,
  PronosticoDelChat,
  ReservaDelChat,
  ResultadoDeCancelacion,
  ResultadoDeReserva,
} from "./tipos";

// Lo que la página necesita saber del asistente con IA (la parte de la IA está en la API: api/src/asistente).

// Un mensaje de la conversación, con las herramientas que puede usar el asistente.
// Así TypeScript sabe qué trae cada herramienta (por ejemplo, las horas libres para dibujar los botones).
export type MensajeDelAsistente = UIMessage<
  unknown,
  UIDataTypes,
  {
    verHorariosLibres: { input: PedidoDeHorarios; output: HorariosLibres };
    buscarInformacion: { input: PedidoDeInformacion; output: InformacionDelClub };
    verPronostico: { input: PedidoDePronostico; output: PronosticoDelChat };
    reservar: { input: PedidoDeReserva; output: ResultadoDeReserva };
    verMisReservas: { input: Record<string, never>; output: MisReservasDelChat };
    cancelarReserva: { input: PedidoDeCancelacion; output: ResultadoDeCancelacion };
  }
>;

// El mismo límite que revisa la API
export const MAXIMO_CARACTERES = 500;

// El botón que abre el chat (está en la portada). Al cerrar el chat, el foco vuelve a él.
export const ID_DEL_BOTON = "boton-del-asistente";

// Preguntas para empezar, una por cada cosa que sabe hacer el asistente: horarios, precios e información del club.
// "icono" es el dibujo que va al lado (ver components/asistente/Iconos.tsx).
export const SUGERENCIAS = [
  { texto: "¿Hay cancha mañana después de las 7?", icono: "calendario" },
  { texto: "¿Cuánto cuesta una hora de cancha?", icono: "precio" },
  { texto: "¿Arriendan paletas?", icono: "club" },
] as const;

// Lo que se le escribe al asistente al tocar una de las horas libres que mostró
export function pedidoDeHora(fecha: string, hora: string) {
  return `Quiero reservar el ${diaLargo(fecha)} a las ${hora}`;
}

// Lo que se le escribe al asistente al tocar "Cancelar" en una de las reservas que mostró
export function pedidoDeCancelacion({ cancha, fecha, hora }: ReservaDelChat) {
  return `Quiero cancelar mi reserva de la ${cancha} del ${diaLargo(fecha)} a las ${hora}`;
}

// ---------- Reservar y cancelar con confirmación ----------

// Las herramientas que esperan a que la persona toque "Confirmar"
export type ParteQueConfirma = Extract<MensajeDelAsistente["parts"][number], { type: "tool-reservar" | "tool-cancelarReserva" }>;

// En qué va una reserva (o una cancelación) que propuso el asistente:
// - "revisando": la API está revisando si se puede
// - "pendiente": espera que la persona toque "Confirmar" o "No, gracias"
// - "confirmando": la persona confirmó y la API la está haciendo
// - "hecha", "rechazada" (la persona dijo que no) o "no-se-pudo" (por ejemplo, otra persona tomó la hora)
// - "vencida": la persona escribió otra cosa en vez de responder, y ya no se puede confirmar
export type EstadoDeLaTarjeta = "revisando" | "pendiente" | "confirmando" | "hecha" | "rechazada" | "no-se-pudo" | "vencida";

// Qué muestra la tarjeta. null es que no se muestra nada: por ejemplo, si la API la rechazó sola (una hora ocupada)
// nunca hubo nada que confirmar, y el asistente explica el motivo con palabras.
// "esElUltimo": si la herramienta está en el último mensaje. "respondiendo": si el asistente sigue escribiendo
// ese mensaje. "fallo": si el último pedido a la API falló (entonces una confirmación quedó sin hacer).
export function estadoDeLaTarjeta(
  parte: ParteQueConfirma,
  { esElUltimo, respondiendo, fallo }: { esElUltimo: boolean; respondiendo: boolean; fallo: boolean },
): EstadoDeLaTarjeta | null {
  switch (parte.state) {
    case "input-streaming":
    case "input-available":
      return respondiendo ? "revisando" : null;
    case "approval-requested":
      if (parte.approval.isAutomatic) return null;
      return esElUltimo ? "pendiente" : "vencida";
    case "approval-responded":
      if (!parte.approval.approved) return "rechazada";
      return esElUltimo && !fallo ? "confirmando" : "no-se-pudo";
    case "output-available": {
      const hecha = parte.type === "tool-reservar" ? parte.output.reserva : parte.output.cancelada;
      return hecha ? "hecha" : "no-se-pudo";
    }
    case "output-denied":
      return parte.approval.isAutomatic ? null : "no-se-pudo";
    case "output-error":
      return "no-se-pudo";
  }
}

// Después de tocar "Confirmar", la conversación se manda sola a la API para que haga la reserva.
// Al tocar "No, gracias" no se manda nada: no hace falta preguntarle a la IA (y así no se gasta la cuota).
// La IA se entera del "no" con el mensaje siguiente.
export function debeEnviarseSolo({ messages }: { messages: MensajeDelAsistente[] }) {
  const confirmo = messages
    .at(-1)
    ?.parts.some((parte) => isToolUIPart(parte) && parte.state === "approval-responded" && parte.approval.approved);
  return Boolean(confirmo) && lastAssistantMessageIsCompleteWithApprovalResponses({ messages });
}

// Los ids de las reservas que se cancelaron en la conversación. Las listas de reservas que mostró antes el
// asistente siguen ahí: en esas reservas ya no se ofrece "Cancelar".
export function reservasCanceladas(mensajes: MensajeDelAsistente[]) {
  return new Set(
    mensajes.flatMap((mensaje) =>
      mensaje.parts.flatMap((parte) =>
        parte.type === "tool-cancelarReserva" && parte.state === "output-available" && parte.output.cancelada
          ? [parte.output.cancelada.id]
          : [],
      ),
    ),
  );
}

// La reserva que el asistente hizo o canceló en ese mensaje (la última, si fueron varias), o undefined si no
// cambió nada. Entonces la grilla y "Mis reservas" se vuelven a pedir, y la grilla salta a ese día y esa hora.
export function reservaQueCambio(mensaje: MensajeDelAsistente): ReservaDelChat | undefined {
  return mensaje.parts
    .map((parte) => {
      if (parte.type === "tool-reservar" && parte.state === "output-available") return parte.output.reserva;
      if (parte.type === "tool-cancelarReserva" && parte.state === "output-available") return parte.output.cancelada;
      return undefined;
    })
    .findLast((reserva) => reserva !== undefined);
}

// useChat entrega los errores de distintas formas. Esto los deja como un mensaje en español para mostrar,
// y dice si el chat se cierra:
// - La API manda sus errores como JSON, {"error": "...", "cerrarElChat": true}, tanto si rechaza el mensaje
//   (400, 429, 503) como si la IA falla a mitad de la respuesta. "cerrarElChat" llega cuando el asistente no va
//   a poder responder por un buen rato (por ejemplo, si se acabó la cuota gratis de la IA): ahí no sirve
//   reintentar, y la página ofrece la grilla, que funciona sin IA.
// - Si no hubo conexión, fetch lanza un TypeError (cada navegador con su texto: "Failed to fetch", "Load failed"...).
// - Cualquier otro, un mensaje general.
export function errorDelAsistente(error: Error): { mensaje: string; cerrarElChat: boolean } {
  try {
    const datos: unknown = JSON.parse(error.message);
    if (typeof datos === "object" && datos !== null && "error" in datos && typeof datos.error === "string") {
      return { mensaje: datos.error, cerrarElChat: "cerrarElChat" in datos && datos.cerrarElChat === true };
    }
  } catch {
    // No era JSON: se revisa abajo
  }

  if (error.name === "TypeError") {
    return { mensaje: "No se pudo conectar con el asistente. Revisa tu conexión e intenta de nuevo.", cerrarElChat: false };
  }

  return { mensaje: "El asistente tuvo un problema y no pudo responder. Prueba de nuevo en unos segundos.", cerrarElChat: false };
}
