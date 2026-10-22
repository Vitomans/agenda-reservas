import type { UIMessage } from "ai";

// Lo que la página necesita saber del asistente con IA (la parte de la IA está en la API: api/src/asistente).

// El mismo límite que revisa la API
export const MAXIMO_CARACTERES = 500;

// El botón que abre el chat (está en la portada). Al cerrar el chat, el foco vuelve a él.
export const ID_DEL_BOTON = "boton-del-asistente";

// Preguntas para empezar, que el asistente ya sabe responder
export const SUGERENCIAS = ["¿Cuánto cuesta una hora de cancha?", "¿Hasta qué hora abren?", "¿Puedo cancelar una reserva?"];

// El texto de un mensaje. Un mensaje viene en partes (texto, herramientas...); por ahora solo se muestra el texto.
export function textoDelMensaje(mensaje: UIMessage) {
  return mensaje.parts.map((parte) => (parte.type === "text" ? parte.text : "")).join("");
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
