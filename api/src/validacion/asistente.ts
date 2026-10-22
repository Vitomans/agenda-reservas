import { safeValidateUIMessages, type ToolSet, type UIMessage } from "ai";
import { ErrorHttp } from "../middlewares/errores.ts";

// La conversación que manda la página al asistente.
//
// La página guarda la conversación y la manda completa en cada mensaje: así la API no tiene que
// recordar nada. Pero viene del navegador, y quien quiera la puede escribir a mano, así que se revisa.

export const MAXIMO_CARACTERES_POR_MENSAJE = 500;
// Solo se le pasan al modelo los últimos mensajes: cada mensaje gasta tokens en cada pedido
export const MENSAJES_QUE_SE_MANDAN = 20;

type Parte = UIMessage["parts"][number];

function textoDelMensaje(mensaje: UIMessage) {
  return mensaje.parts.map((parte) => (parte.type === "text" ? parte.text : "")).join("");
}

// Las partes que puede traer un mensaje: las que manda la API (texto, el comienzo de cada paso y
// el uso de sus herramientas). Cualquier otra (archivos, datos, herramientas que no existen) se rechaza.
function esParteConocida(parte: Parte, herramientas: ToolSet) {
  if (parte.type === "text" || parte.type === "step-start") return true;
  return parte.type.startsWith("tool-") && Object.hasOwn(herramientas, parte.type.slice("tool-".length));
}

// Una herramienta que quedó a medias, por ejemplo si la persona tocó "Detener" mientras la IA buscaba.
// El modelo no acepta una llamada a una herramienta sin su resultado, así que esas partes se quitan.
function quedoAMedias(parte: Parte) {
  return parte.type.startsWith("tool-") && "state" in parte && parte.state !== "output-available" && parte.state !== "output-error";
}

// "herramientas" son las del asistente: con ellas se revisa que cada resultado anterior tenga la forma correcta
export async function conversacionValida(cuerpo: unknown, herramientas: ToolSet) {
  const resultado = await safeValidateUIMessages({
    messages: (cuerpo as { messages?: unknown } | null)?.messages,
    tools: herramientas,
  });

  if (!resultado.success) {
    throw new ErrorHttp(400, "La conversación no tiene el formato esperado");
  }

  const mensajes = resultado.data;

  // Las instrucciones las pone solo la API: un mensaje "system" escrito a mano podría cambiarlas
  if (mensajes.some((mensaje) => mensaje.role === "system")) {
    throw new ErrorHttp(400, "La conversación no puede traer instrucciones");
  }

  if (mensajes.some((mensaje) => mensaje.parts.some((parte) => !esParteConocida(parte, herramientas)))) {
    throw new ErrorHttp(400, "La conversación trae partes que el asistente no conoce");
  }

  if (mensajes.some((mensaje) => mensaje.role === "user" && textoDelMensaje(mensaje).length > MAXIMO_CARACTERES_POR_MENSAJE)) {
    throw new ErrorHttp(400, `Cada mensaje puede tener hasta ${MAXIMO_CARACTERES_POR_MENSAJE} caracteres`);
  }

  return mensajes
    .slice(-MENSAJES_QUE_SE_MANDAN)
    .map((mensaje) => ({ ...mensaje, parts: mensaje.parts.filter((parte) => !quedoAMedias(parte)) }));
}
