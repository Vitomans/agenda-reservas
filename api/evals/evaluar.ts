import { APICallError, type LanguageModelV4 } from "@ai-sdk/provider";
import { createAgentUIStream, type EmbeddingModel, getToolName, isToolUIPart, readUIMessageStream, type UIMessage, wrapLanguageModel } from "ai";
import { crearAsistente } from "../src/asistente/asistente.ts";
import type { Paso } from "../src/asistente/gasto.ts";
import type { Meteorologo } from "../src/meteorologo.ts";
import { conversacionValida } from "../src/validacion/asistente.ts";
import type { Caso } from "./casos.ts";
import { type Respuesta, revisionesDeEstilo } from "./revisar.ts";

// Le hace un caso al asistente y revisa la respuesta.
//
// El asistente se arma igual que en la ruta /api/asistente (crearAsistente y conversacionValida), y la respuesta
// se lee igual que en la página (como un mensaje con sus partes). Lo único distinto es que no pasa por Express:
// así las evals no chocan con el límite de mensajes por visitante.

export type Resultado = {
  caso: Caso;
  respuesta: Respuesta;
  problemas: string[]; // vacío si pasó todas las revisiones
  pedidos: number; // pedidos a la IA (uno por paso)
  tokens: number;
  segundos: number;
};

// gpt-oss a veces escribe un espacio que no se corta entre el número y la palabra ("7 días", con U+202F):
// en el texto se cambia por un espacio normal, así las revisiones lo encuentran
const ESPACIOS_ESPECIALES = /[\u00A0\u2007\u202F]/gu;

// El texto y las herramientas del mensaje que respondió el asistente
export function respuestaDelMensaje(mensaje: UIMessage | undefined): Respuesta {
  const partes = mensaje?.parts ?? [];
  return {
    texto: partes
      .map((parte) => (parte.type === "text" ? parte.text.replace(ESPACIOS_ESPECIALES, " ").trim() : ""))
      .filter(Boolean)
      .join(" "),
    herramientas: partes.filter(isToolUIPart).map((parte) => ({
      nombre: getToolName(parte),
      entrada: (parte.input ?? {}) as Record<string, unknown>,
      estado: parte.state,
    })),
  };
}

export async function evaluarCaso(
  modelo: LanguageModelV4,
  caso: Caso,
  { modeloDeVectores = null, meteorologo }: { modeloDeVectores?: EmbeddingModel | null; meteorologo?: Meteorologo } = {},
): Promise<Resultado> {
  const inicio = performance.now();
  let pasos: Paso[] = [];
  const asistente = crearAsistente(modelo, { usuario: caso.usuario, modeloDeVectores, meteorologo, alTerminar: (p) => (pasos = p) });
  const mensajes = await conversacionValida({ messages: caso.conversacion }, asistente.tools);

  let fallo: unknown;
  const pedazos = await createAgentUIStream({
    agent: asistente,
    uiMessages: mensajes,
    sendReasoning: false,
    onError: (error) => {
      fallo = error;
      return "";
    },
  });

  let mensaje: UIMessage | undefined;
  for await (const parcial of readUIMessageStream({ stream: pedazos })) mensaje = parcial;
  // Si la IA falló (por ejemplo, se acabó la cuota del día), el caso no se puede evaluar
  if (fallo) throw fallo;

  const respuesta = respuestaDelMensaje(mensaje);
  const problemas = [...caso.revisiones, ...revisionesDeEstilo]
    .map((revisar) => revisar(respuesta))
    .filter((problema) => problema !== null);

  return {
    caso,
    respuesta,
    problemas,
    pedidos: pasos.length,
    tokens: pasos.reduce((suma, paso) => suma + (paso.usage.inputTokens ?? 0) + (paso.usage.outputTokens ?? 0), 0),
    segundos: (performance.now() - inicio) / 1000,
  };
}

// ---------- Esperar la cuota por minuto ----------

// Groq gratis da 8.000 tokens por minuto, y una eval completa pasa ese límite varias veces. En la página, la cadena
// de respaldo le pasaría el mensaje al siguiente modelo; aquí se quiere medir siempre el mismo, así que se espera lo
// que pide Groq y se le vuelve a preguntar. Si pide esperar mucho (se acabó la cuota del día), las evals se detienen.
export const ESPERA_MAXIMA_S = 120;
const INTENTOS = 5;

function segundosQuePide(error: unknown) {
  if (!APICallError.isInstance(error) || error.statusCode !== 429) return undefined;
  // La cuota del día no vuelve en unos segundos
  if (/per day/iu.test(error.message)) return Number.POSITIVE_INFINITY;
  const segundos = Number.parseFloat(error.responseHeaders?.["retry-after"] ?? "");
  return Number.isFinite(segundos) ? Math.max(Math.ceil(segundos), 1) : 10;
}

export function esperandoLaCuota(
  modelo: LanguageModelV4,
  {
    dormir = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms)),
    alEsperar = (segundos: number) => console.log(`   La IA pide esperar ${segundos} s (límite de tokens por minuto)…`),
  } = {},
): LanguageModelV4 {
  async function conEspera<T>(llamar: () => PromiseLike<T>): Promise<T> {
    for (let intento = 1; ; intento++) {
      try {
        return await llamar();
      } catch (error) {
        const segundos = segundosQuePide(error);
        if (segundos === undefined || segundos > ESPERA_MAXIMA_S || intento === INTENTOS) throw error;
        alEsperar(segundos);
        await dormir(segundos * 1000);
      }
    }
  }

  return wrapLanguageModel({
    model: modelo,
    middleware: {
      specificationVersion: "v4",
      wrapGenerate: ({ doGenerate }) => conEspera(doGenerate),
      wrapStream: ({ doStream }) => conEspera(doStream),
    },
  });
}
