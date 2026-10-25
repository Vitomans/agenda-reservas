import { type EmbeddingModel, isStepCount, type LanguageModel, ToolLoopAgent } from "ai";
import type { Cartero } from "../cartero.ts";
import type { Meteorologo } from "../meteorologo.ts";
import type { UsuarioSesion } from "../servicios/sesion.ts";
import type { Avisador } from "../tiempoReal.ts";
import type { Paso } from "./gasto.ts";
import { crearHerramientas } from "./herramientas.ts";
import { instrucciones } from "./instrucciones.ts";
import { confirmacionesDeReservas } from "./reservas.ts";

// El "cerebro" del asistente: el modelo, sus instrucciones, sus herramientas y sus límites.
// No sabe nada de Express ni de la página: recibe la conversación y responde (ver rutas/asistente.ts).

// Cuántas veces puede "pensar y actuar" el modelo en una sola respuesta. Cada paso es un pedido a la IA:
// por ejemplo, 1) pedir los horarios libres, 2) responder con ellos. Así un mensaje no gasta la cuota sin fin.
export const MAXIMO_PASOS = 5;

// Lo más largo que puede escribir el modelo en una respuesta (en tokens, unas 600 palabras)
const MAXIMO_TOKENS_DE_RESPUESTA = 800;

// Se crea uno nuevo en cada mensaje, porque las instrucciones llevan la hora del club
// y las herramientas, el usuario de la sesión (undefined si la persona no entró).
// "modeloDeVectores" es el que busca en la información del club por significado (ver conocimiento.ts),
// y "avisador" y "cartero", los que avisan en vivo y envían el correo al reservar o cancelar.
// "meteorologo" trae el pronóstico del tiempo (ver meteorologo.ts).
// "alTerminar" recibe los pasos de la respuesta, con los tokens que gastó cada uno (ver gasto.ts).
export function crearAsistente(
  modelo: LanguageModel,
  {
    usuario,
    modeloDeVectores = null,
    avisador,
    cartero,
    meteorologo,
    ahora = new Date(),
    alTerminar,
  }: {
    usuario?: UsuarioSesion;
    modeloDeVectores?: EmbeddingModel | null;
    avisador?: Avisador;
    cartero?: Cartero;
    meteorologo?: Meteorologo;
    ahora?: Date;
    alTerminar?: (pasos: Paso[]) => void;
  } = {},
) {
  return new ToolLoopAgent({
    model: modelo,
    instructions: instrucciones(ahora),
    tools: crearHerramientas({ usuario, modeloDeVectores, avisador, cartero, meteorologo }),
    // Reservar y cancelar esperan a que la persona toque "Confirmar" (ver reservas.ts)
    toolApproval: confirmacionesDeReservas(usuario),
    stopWhen: isStepCount(MAXIMO_PASOS),
    maxOutputTokens: MAXIMO_TOKENS_DE_RESPUESTA,
    // Los modelos "razonan" antes de responder, y ese razonamiento también gasta tokens.
    // Para responder sobre un club de pádel basta con poco (y así responde más rápido).
    // El AI SDK lo traduce para cada proveedor (en Groq, reasoning_effort; en Gemini, thinkingLevel).
    reasoning: "low",
    // Si un modelo falla, el AI SDK no reintenta (por defecto lo hace 2 veces, esperando entre medio):
    // la cadena de respaldo le pregunta de inmediato al siguiente modelo (ver respaldo.ts)
    maxRetries: 0,
    onEnd: alTerminar ? ({ steps }) => alTerminar(steps) : undefined,
  });
}
