import { APICallError } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, describe, expect, it, vi } from "vitest";
import { type Caso, type Contexto, casos, preguntaDelCaso } from "../evals/casos.ts";
import { esperandoLaCuota, evaluarCaso, respuestaDelMensaje } from "../evals/evaluar.ts";
import { type Respuesta, revisionesDeEstilo, usa } from "../evals/revisar.ts";
import { crearHerramientas } from "../src/asistente/herramientas.ts";
import { db } from "../src/db.ts";
import { diasReservables } from "../src/servicios/horario.ts";
import { conversacionValida } from "../src/validacion/asistente.ts";
import { pasoQueEscribe, pasoQuePide } from "./ayudantesDelAsistente.ts";

// Las evals se corren a mano con la IA de verdad (npm run evals). Estos tests revisan su código con un modelo falso,
// así un error en las evals se ve en el CI y no después de gastar la cuota.

afterAll(async () => {
  await db.$disconnect();
});

const manana = diasReservables()[1];

const contextoFalso: Contexto = {
  dias: diasReservables(),
  horasDeManana: {
    pedido: { fecha: manana, desde: 19 },
    horarios: { horas: [{ hora: "19:00", precio: 16000, canchas: ["Cancha 1", "Cancha 3"] }], tusReservas: [] },
  },
  conUnaReserva: { usuario: { id: "jugador-1", rol: "CLIENTE" }, reservaId: "reserva-1" },
  conDosReservas: { usuario: { id: "jugador-2", rol: "CLIENTE" } },
};

const estilo = (texto: string) => revisionesDeEstilo.map((revisar) => revisar({ texto, herramientas: [] })).filter(Boolean);

describe("revisiones de estilo", () => {
  it("aceptan una respuesta breve, de tú y sin Markdown", () => {
    expect(estilo("Mañana hay libres de 19:00 a 22:00, a $16.000. ¿Quieres que te reserve alguna? Elige una hora.")).toEqual([]);
  });

  it('encuentran las palabras de "vos", aunque tengan tilde', () => {
    expect(estilo("Si querés, tocá una hora.")).toEqual(['Dice palabras de "vos": "querés"']);
    expect(estilo("Hay libres. Elegí la que te sirva.")).toHaveLength(1);
    // El voseo chileno: el modelo escribió "podís cancelar sin costo"
    expect(estilo("Si llueve, podís cancelar sin costo.")).toEqual(['Dice palabras de "vos": "podís"']);
    // "elegí" en medio de la frase es "yo elegí": está bien
    expect(estilo("Te muestro la que elegí para ti.")).toEqual([]);
  });

  it("encuentran Markdown, respuestas largas y el id de una reserva", () => {
    expect(estilo("**Cancha 2** a las 19:00")).toEqual(['Dice Markdown: "**"']);
    expect(estilo("a".repeat(451))).toEqual(["Es muy larga: 451 caracteres (máximo 450)"]);
    expect(estilo("Tu reserva 3f2a1b4c-1234-4abc-8def-0123456789ab")).toHaveLength(1);
  });
});

describe("casos", () => {
  const casoQueEmpiezaCon = (inicio: string) => casos(contextoFalso).find((caso) => preguntaDelCaso(caso).startsWith(inicio))!;
  const revisar = (caso: Caso, respuesta: Respuesta) => caso.revisiones.map((r) => r(respuesta)).filter(Boolean);

  // Problemas que aparecieron en la primera corrida con Groq: las respuestas estaban bien y la revisión, mal
  it('"mañana" no cuenta como repetir el nombre "Ana"', () => {
    const caso = casoQueEmpiezaCon("Me llamo Ana");
    const horarios = [{ nombre: "verHorariosLibres", entrada: { fecha: manana }, estado: "output-available" }];

    expect(revisar(caso, { texto: "Mañana hay cancha libre a las 10:00.", herramientas: horarios })).toEqual([]);
    expect(revisar(caso, { texto: "Hola Ana, mañana hay cancha a las 10:00.", herramientas: horarios })).toHaveLength(1);
  });

  it('"no se menciona sauna" es decir que no tiene esa información', () => {
    const caso = casoQueEmpiezaCon("¿Tienen sauna?");
    const busqueda = [{ nombre: "buscarInformacion", entrada: { pregunta: "sauna" }, estado: "output-available" }];

    expect(revisar(caso, { texto: "Según los servicios del club, no se menciona sauna.", herramientas: busqueda })).toEqual([]);
    expect(revisar(caso, { texto: "No, el club no tiene sauna.", herramientas: busqueda })).toHaveLength(2);
  });

  it("cada conversación tiene el formato que acepta la API", async () => {
    const herramientas = crearHerramientas();
    const lista = casos(contextoFalso);

    expect(lista.length).toBeGreaterThanOrEqual(20);
    for (const caso of lista) {
      await expect(conversacionValida({ messages: caso.conversacion }, herramientas)).resolves.toBeDefined();
    }
  });
});

describe("respuestaDelMensaje", () => {
  it("cambia el espacio angosto que escribe gpt-oss por un espacio normal", () => {
    const mensaje = { id: "a1", role: "assistant" as const, parts: [{ type: "text" as const, text: "Hasta 7\u202Fdías adelante." }] };

    expect(respuestaDelMensaje(mensaje).texto).toBe("Hasta 7 días adelante.");
  });
});

describe("evaluarCaso", () => {
  it("le hace el caso al asistente y junta los problemas de la respuesta", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [pasoQuePide("verHorariosLibres", { fecha: manana, desde: 19 }), pasoQueEscribe("Hay libres. ¿Querés reservar?")],
    });
    const caso = casos(contextoFalso)[0]; // "¿Hay cancha mañana después de las 7?"

    const resultado = await evaluarCaso(modelo, caso);

    expect(resultado.respuesta.herramientas).toEqual([
      { nombre: "verHorariosLibres", entrada: { fecha: manana, desde: 19 }, estado: "output-available" },
    ]);
    expect(resultado.problemas).toEqual(['Dice palabras de "vos": "Querés"']);
    expect(resultado.pedidos).toBe(2);
  });

  it("dice qué herramienta usó cuando no es la que se esperaba", async () => {
    const modelo = new MockLanguageModelV4({ doStream: [pasoQueEscribe("Sí, hay cancha.")] });

    const resultado = await evaluarCaso(modelo, { ...casos(contextoFalso)[0], revisiones: [usa("verHorariosLibres")] });

    expect(resultado.problemas).toEqual(["No usó verHorariosLibres con {} (usó: ninguna)"]);
  });
});

describe("esperandoLaCuota", () => {
  const sinCuota = (mensaje: string, retryAfter: string) =>
    new APICallError({ message: mensaje, url: "https://api.groq.com", requestBodyValues: {}, statusCode: 429, responseHeaders: { "retry-after": retryAfter } });

  it("si se pasó del límite por minuto, espera lo que pide la IA y vuelve a preguntar", async () => {
    let llamadas = 0;
    const modelo = new MockLanguageModelV4({
      doStream: async () => {
        if (++llamadas === 1) throw sinCuota("Rate limit reached on tokens per minute (TPM)", "7");
        return pasoQueEscribe("Hola");
      },
    });
    const dormir = vi.fn(async () => {});

    const conEspera = esperandoLaCuota(modelo, { dormir, alEsperar: () => {} });
    await conEspera.doStream({ prompt: [] });

    expect(dormir).toHaveBeenCalledWith(7000);
    expect(llamadas).toBe(2);
  });

  it("si se acabó la cuota del día, no espera", async () => {
    const modelo = new MockLanguageModelV4({
      doStream: async () => {
        throw sinCuota("Rate limit reached on tokens per day (TPD)", "3000");
      },
    });
    const dormir = vi.fn(async () => {});

    await expect(esperandoLaCuota(modelo, { dormir, alEsperar: () => {} }).doStream({ prompt: [] })).rejects.toThrow(/per day/);
    expect(dormir).not.toHaveBeenCalled();
  });
});
