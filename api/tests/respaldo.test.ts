import { APICallError, type LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { puedeUsarGemini } from "../src/asistente/modelos.ts";
import { CadenaDeRespaldo, DESCANSO_SI_FALLA_MS, ESPERA_MAXIMA_MS, SinModelosDisponibles } from "../src/asistente/respaldo.ts";
import { modeloQueResponde } from "./ayudantesDelAsistente.ts";

// La cadena de respaldo, con modelos falsos y un reloj de mentira: así se prueba que un modelo "descansa"
// sin esperar de verdad.

const PEDIDO: LanguageModelV4CallOptions = { prompt: [{ role: "user", content: [{ type: "text", text: "Hola" }] }] };

// Lo que responde un servicio de IA cuando falla: por ejemplo, 429 con "retry-after" cuando se acabó la cuota
function errorDeLaIA(statusCode: number, cabeceras: Record<string, string> = {}) {
  return new APICallError({
    message: `Error ${statusCode}`,
    url: "https://ia.test/chat",
    requestBodyValues: {},
    statusCode,
    responseHeaders: cabeceras,
  });
}

function modeloQueFalla(error: unknown, { provider = "groq.chat", modelId = "modelo-que-falla" } = {}) {
  return new MockLanguageModelV4({
    provider,
    modelId,
    doStream: async () => {
      throw error;
    },
  });
}

let ahora = 0;
const reloj = () => ahora;

beforeEach(() => {
  ahora = 1_000_000;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("la cadena de respaldo", () => {
  it("si el primer modelo se quedó sin cuota, le pregunta al siguiente sin esperar", async () => {
    const primero = modeloQueFalla(errorDeLaIA(429, { "retry-after": "7" }));
    const segundo = modeloQueResponde(["Hola"]);
    const cadena = new CadenaDeRespaldo([primero, segundo], reloj);

    await cadena.modeloPara({ conGemini: true }).doStream(PEDIDO);

    expect(primero.doStreamCalls).toHaveLength(1);
    expect(segundo.doStreamCalls).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Descansa 7 s"));
  });

  it("el modelo sin cuota descansa lo que pidió: mientras tanto, los pedidos van directo al siguiente", async () => {
    const primero = modeloQueFalla(errorDeLaIA(429, { "retry-after": "7" }));
    const segundo = modeloQueResponde(["Hola"]);
    const cadena = new CadenaDeRespaldo([primero, segundo], reloj);
    const modelo = cadena.modeloPara({ conGemini: true });

    await modelo.doStream(PEDIDO);
    await modelo.doStream(PEDIDO);
    expect(primero.doStreamCalls).toHaveLength(1);
    expect(segundo.doStreamCalls).toHaveLength(2);

    // Pasados los 7 segundos, se le vuelve a preguntar primero
    ahora += 7000;
    await modelo.doStream(PEDIDO);
    expect(primero.doStreamCalls).toHaveLength(2);
  });

  it("si un servicio falla sin decir cuándo vuelve (por ejemplo, 503), descansa un minuto", async () => {
    const primero = modeloQueFalla(errorDeLaIA(503));
    const cadena = new CadenaDeRespaldo([primero, modeloQueResponde(["Hola"])], reloj);

    await cadena.modeloPara({ conGemini: true }).doStream(PEDIDO);

    expect(cadena.disponibleEn({ conGemini: true })).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Descansa ${DESCANSO_SI_FALLA_MS / 1000} s`));
  });

  it("si todos descansan, avisa cuánto falta para que vuelva el primero", async () => {
    const cadena = new CadenaDeRespaldo(
      [modeloQueFalla(errorDeLaIA(429, { "retry-after": "90" })), modeloQueFalla(errorDeLaIA(429, { "retry-after": "30" }))],
      reloj,
    );

    const error = await cadena
      .modeloPara({ conGemini: true })
      .doStream(PEDIDO)
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect(error).toBeInstanceOf(SinModelosDisponibles);
    expect((error as SinModelosDisponibles).vuelveEnMs).toBe(30_000);
    expect(cadena.disponibleEn({ conGemini: true })).toBe(30_000);
  });

  it("un error del pedido (400) no hace descansar al modelo, pero igual le pregunta al siguiente", async () => {
    const primero = modeloQueFalla(errorDeLaIA(400));
    const segundo = modeloQueResponde(["Hola"]);
    const modelo = new CadenaDeRespaldo([primero, segundo], reloj).modeloPara({ conGemini: true });

    await modelo.doStream(PEDIDO);
    await modelo.doStream(PEDIDO);

    expect(primero.doStreamCalls).toHaveLength(2);
    expect(segundo.doStreamCalls).toHaveLength(2);
  });

  it("si todos fallan por el pedido y ninguno descansa, entrega el último error", async () => {
    const ultimo = errorDeLaIA(400);
    const modelo = new CadenaDeRespaldo([modeloQueFalla(errorDeLaIA(400)), modeloQueFalla(ultimo)], reloj).modeloPara({
      conGemini: true,
    });

    await expect(modelo.doStream(PEDIDO)).rejects.toBe(ultimo);
  });

  it("si un modelo no empieza a responder a tiempo, le pregunta al siguiente", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Un modelo que nunca contesta: solo termina cuando se corta su pedido
    const lento = new MockLanguageModelV4({
      doStream: ({ abortSignal }) =>
        new Promise((_, rechazar) => abortSignal?.addEventListener("abort", () => rechazar(abortSignal.reason))),
    });
    const segundo = modeloQueResponde(["Hola"]);
    const cadena = new CadenaDeRespaldo([lento, segundo], reloj);

    const respuesta = cadena.modeloPara({ conGemini: true }).doStream(PEDIDO);
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS);
    await respuesta;

    expect(segundo.doStreamCalls).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`no respondió en ${ESPERA_MAXIMA_MS} ms`));
  });

  it("si la persona cerró el chat, no le pregunta a otro modelo", async () => {
    const cancelar = new AbortController();
    cancelar.abort();
    const primero = modeloQueFalla(new DOMException("Cancelado", "AbortError"));
    const segundo = modeloQueResponde(["Hola"]);
    const modelo = new CadenaDeRespaldo([primero, segundo], reloj).modeloPara({ conGemini: true });

    await expect(modelo.doStream({ ...PEDIDO, abortSignal: cancelar.signal })).rejects.toThrow("Cancelado");
    expect(segundo.doStreamCalls).toHaveLength(0);
  });

  it("a los visitantes que no pueden usar Gemini nunca les pregunta a Gemini", async () => {
    const groq = modeloQueFalla(errorDeLaIA(429, { "retry-after": "30" }));
    const gemini = new MockLanguageModelV4({ provider: "google.generative-ai", doStream: modeloQueResponde(["Hola"]).doStream });
    const cadena = new CadenaDeRespaldo([groq, gemini], reloj);

    await expect(cadena.modeloPara({ conGemini: false }).doStream(PEDIDO)).rejects.toBeInstanceOf(SinModelosDisponibles);
    expect(gemini.doStreamCalls).toHaveLength(0);

    // Para los demás, Gemini es el último respaldo
    await cadena.modeloPara({ conGemini: true }).doStream(PEDIDO);
    expect(gemini.doStreamCalls).toHaveLength(1);
  });

  it("disponibleEn es null si no hay ningún modelo para ese visitante", () => {
    const soloGemini = new CadenaDeRespaldo([new MockLanguageModelV4({ provider: "google.generative-ai" })], reloj);

    expect(soloGemini.disponibleEn({ conGemini: false })).toBeNull();
    expect(soloGemini.disponibleEn({ conGemini: true })).toBe(0);
    expect(new CadenaDeRespaldo([], reloj).disponibleEn({ conGemini: true })).toBeNull();
  });
});

describe("puedeUsarGemini", () => {
  it("no, para los visitantes de la Unión Europea, el resto del Espacio Económico Europeo, Suiza y el Reino Unido", () => {
    for (const pais of ["DE", "ES", "FR", "IE", "NO", "IS", "CH", "GB", "RE", "de"]) {
      expect(puedeUsarGemini(pais), pais).toBe(false);
    }
  });

  it("sí, para los demás, y cuando no se sabe el país (en local)", () => {
    for (const pais of ["CL", "AR", "US", "MX", "JP", undefined]) {
      expect(puedeUsarGemini(pais), String(pais)).toBe(true);
    }
  });
});
