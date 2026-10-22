import { type EmbeddingModel, isStepCount, type LanguageModel, ToolLoopAgent } from "ai";
import { crearHerramientas } from "./herramientas.ts";
import { instrucciones } from "./instrucciones.ts";

// El "cerebro" del asistente: el modelo, sus instrucciones, sus herramientas y sus límites.
// No sabe nada de Express ni de la página: recibe la conversación y responde (ver rutas/asistente.ts).

// Cuántas veces puede "pensar y actuar" el modelo en una sola respuesta. Cada paso es un pedido a la IA:
// por ejemplo, 1) pedir los horarios libres, 2) responder con ellos. Así un mensaje no gasta la cuota sin fin.
export const MAXIMO_PASOS = 5;

// Lo más largo que puede escribir el modelo en una respuesta (en tokens, unas 600 palabras)
const MAXIMO_TOKENS_DE_RESPUESTA = 800;

// Se crea uno nuevo en cada mensaje, porque las instrucciones llevan la hora del club
// y las herramientas, el usuario de la sesión (undefined si la persona no entró).
// "modeloDeVectores" es el que busca en la información del club por significado (ver conocimiento.ts).
export function crearAsistente(
  modelo: LanguageModel,
  {
    usuarioId,
    modeloDeVectores = null,
    ahora = new Date(),
  }: { usuarioId?: string; modeloDeVectores?: EmbeddingModel | null; ahora?: Date } = {},
) {
  return new ToolLoopAgent({
    model: modelo,
    instructions: instrucciones(ahora),
    tools: crearHerramientas({ usuarioId, modeloDeVectores }),
    stopWhen: isStepCount(MAXIMO_PASOS),
    maxOutputTokens: MAXIMO_TOKENS_DE_RESPUESTA,
    // gpt-oss "razona" antes de responder, y ese razonamiento también gasta tokens.
    // Para responder sobre un club de pádel basta con poco (y así responde más rápido).
    providerOptions: { groq: { reasoningEffort: "low" } },
  });
}
