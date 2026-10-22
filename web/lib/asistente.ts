import type { UIDataTypes, UIMessage } from "ai";
import { diaLargo } from "./fechas";
import type { HorariosLibres, PedidoDeHorarios } from "./tipos";

// Lo que la página necesita saber del asistente con IA (la parte de la IA está en la API: api/src/asistente).

// Un mensaje de la conversación, con las herramientas que puede usar el asistente.
// Así TypeScript sabe qué trae cada herramienta (por ejemplo, las horas libres para dibujar los botones).
export type MensajeDelAsistente = UIMessage<
  unknown,
  UIDataTypes,
  { verHorariosLibres: { input: PedidoDeHorarios; output: HorariosLibres } }
>;

// El mismo límite que revisa la API
export const MAXIMO_CARACTERES = 500;

// El botón que abre el chat (está en la portada). Al cerrar el chat, el foco vuelve a él.
export const ID_DEL_BOTON = "boton-del-asistente";

// Preguntas para empezar, que el asistente ya sabe responder
export const SUGERENCIAS = ["¿Hay cancha mañana después de las 7?", "¿Cuánto cuesta una hora de cancha?", "¿Puedo cancelar una reserva?"];

// Lo que se le escribe al asistente al tocar una de las horas libres que mostró
export function pedidoDeHora(fecha: string, hora: string) {
  return `Quiero reservar el ${diaLargo(fecha)} a las ${hora}`;
}

// useChat entrega los errores de distintas formas. Esto los deja como un mensaje en español para mostrar:
// - Si la API respondió un error (400, 429, 503), el mensaje es su JSON: {"error": "..."}.
// - Si no hubo conexión, fetch lanza un TypeError (cada navegador con su texto: "Failed to fetch", "Load failed"...).
// - Cualquier otro (por ejemplo, si la IA falló a mitad de la respuesta), un mensaje general.
export function mensajeDelError(error: Error) {
  try {
    const datos: unknown = JSON.parse(error.message);
    if (typeof datos === "object" && datos !== null && "error" in datos && typeof datos.error === "string") {
      return datos.error;
    }
  } catch {
    // No era JSON: se revisa abajo
  }

  if (error.name === "TypeError") {
    return "No se pudo conectar con el asistente. Revisa tu conexión e intenta de nuevo.";
  }

  return "El asistente tuvo un problema y no pudo responder. Prueba de nuevo en unos segundos.";
}
