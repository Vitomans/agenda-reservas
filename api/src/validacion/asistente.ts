import { safeValidateUIMessages, type UIMessage } from "ai";
import { ErrorHttp } from "../middlewares/errores.ts";

// La conversación que manda la página al asistente.
//
// La página guarda la conversación y la manda completa en cada mensaje: así la API no tiene que
// recordar nada. Pero viene del navegador, y quien quiera la puede escribir a mano, así que se revisa.

export const MAXIMO_CARACTERES_POR_MENSAJE = 500;
// Solo se le pasan al modelo los últimos mensajes: cada mensaje gasta tokens en cada pedido
export const MENSAJES_QUE_SE_MANDAN = 20;

function textoDelMensaje(mensaje: UIMessage) {
  return mensaje.parts.map((parte) => (parte.type === "text" ? parte.text : "")).join("");
}

export async function conversacionValida(cuerpo: unknown) {
  const resultado = await safeValidateUIMessages({ messages: (cuerpo as { messages?: unknown } | null)?.messages });

  if (!resultado.success) {
    throw new ErrorHttp(400, "La conversación no tiene el formato esperado");
  }

  const mensajes = resultado.data;

  // Las instrucciones las pone solo la API: un mensaje "system" escrito a mano podría cambiarlas
  if (mensajes.some((mensaje) => mensaje.role === "system")) {
    throw new ErrorHttp(400, "La conversación no puede traer instrucciones");
  }

  if (mensajes.some((mensaje) => mensaje.role === "user" && textoDelMensaje(mensaje).length > MAXIMO_CARACTERES_POR_MENSAJE)) {
    throw new ErrorHttp(400, `Cada mensaje puede tener hasta ${MAXIMO_CARACTERES_POR_MENSAJE} caracteres`);
  }

  return mensajes.slice(-MENSAJES_QUE_SE_MANDAN);
}
