import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import request from "supertest";
import type { crearApp } from "../src/app.ts";

// Lo que comparten los tests del asistente. Usan un modelo falso que responde siempre lo mismo: así no gastan
// la cuota de la IA, no dependen de internet y dan siempre el mismo resultado.

const USO = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

// Un modelo falso que "piensa" y después escribe la respuesta en pedazos, como el de verdad
export function modeloQueResponde(pedazos: string[], { razonamiento = "" } = {}) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          ...(razonamiento
            ? [
                { type: "reasoning-start", id: "r1" } as const,
                { type: "reasoning-delta", id: "r1", delta: razonamiento } as const,
                { type: "reasoning-end", id: "r1" } as const,
              ]
            : []),
          { type: "text-start", id: "t1" } as const,
          ...pedazos.map((delta) => ({ type: "text-delta", id: "t1", delta }) as const),
          { type: "text-end", id: "t1" } as const,
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USO } as const,
        ],
      }),
    }),
  });
}

// Un paso del modelo en que, en vez de escribir, pide usar una herramienta. Con una lista de pasos, el modelo
// falso responde cada pedido con el siguiente, como el de verdad: primero pide la herramienta y después escribe.
export function pasoQuePide(herramienta: string, entrada: object, toolCallId = "llamada-1") {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "tool-call", toolCallId, toolName: herramienta, input: JSON.stringify(entrada) } as const,
        { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USO } as const,
      ],
    }),
  };
}

export function pasoQueEscribe(texto: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start", id: "t1" } as const,
        { type: "text-delta", id: "t1", delta: texto } as const,
        { type: "text-end", id: "t1" } as const,
        { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USO } as const,
      ],
    }),
  };
}

export function mensajeDeLaPersona(texto: string, id = "m1") {
  return { id, role: "user", parts: [{ type: "text", text: texto }] };
}

// La respuesta llega como "eventos" (Server-Sent Events): líneas "data: {...}" separadas por una línea en blanco.
// Supertest no sabe leer ese formato, así que se junta todo como texto y después se separa en eventos.
const leerComoTexto: Parameters<request.Test["parse"]>[0] = (respuesta, listo) => {
  let texto = "";
  respuesta.setEncoding("utf8");
  respuesta.on("data", (pedazo: string) => (texto += pedazo));
  respuesta.on("end", () => listo(null, texto));
};

export type Evento = {
  type: string;
  toolName?: string;
  input?: unknown;
  delta?: string;
  errorText?: string;
  output?: unknown;
  approvalId?: string;
  approved?: boolean;
  reason?: string;
  isAutomatic?: boolean;
};

export function eventos(texto: string) {
  return texto
    .split("\n")
    .filter((linea) => linea.startsWith("data: ") && linea !== "data: [DONE]")
    .map((linea) => JSON.parse(linea.slice("data: ".length)) as Evento);
}

// "navegador" puede ser uno con la sesión iniciada (ver entrarComoJugadorNuevo)
export function escribirle(app: ReturnType<typeof crearApp>, mensajes: unknown[], navegador = request(app)) {
  return navegador.post("/api/asistente").send({ messages: mensajes }).buffer(true).parse(leerComoTexto);
}

// Lo que recibió la página de la herramienta
export function resultadoDeLaHerramienta<Resultado>(texto: string) {
  return eventos(texto).find((evento) => evento.type === "tool-output-available")?.output as Resultado | undefined;
}
