import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { modeloDeGuion } from "../src/asistente/guion.ts";
import { db } from "../src/db.ts";
import { meteorologoDeEjemplo } from "../src/meteorologo.ts";
import { diasReservables } from "../src/servicios/horario.ts";
import { escribirle, eventos, mensajeDeLaPersona } from "./ayudantesDelAsistente.ts";

// El asistente de guion es el que usan los tests e2e (ver src/asistente/guion.ts). Si una de sus reglas falla,
// el e2e falla lejos del motivo; aquí se ve directo qué pidió.

afterAll(async () => {
  await db.$disconnect();
});

async function preguntar(texto: string) {
  const app = crearApp({ modelos: [modeloDeGuion()], meteorologo: meteorologoDeEjemplo() });
  const respuesta = await escribirle(app, [mensajeDeLaPersona(texto)]);
  const todos = eventos(respuesta.body as string);
  return {
    herramientas: todos.filter((e) => e.type === "tool-input-available").map((e) => ({ herramienta: e.toolName, entrada: e.input })),
    texto: todos.map((e) => (e.type === "text-delta" ? e.delta : "")).join(""),
  };
}

describe("asistente de guion", () => {
  const manana = diasReservables()[1];

  it("busca las horas libres de mañana desde la hora que dice la persona", async () => {
    const { herramientas } = await preguntar("¿Hay cancha mañana después de las 7?");

    expect(herramientas).toEqual([{ herramienta: "verHorariosLibres", entrada: { fecha: manana, desde: 19 } }]);
  });

  it("pide la reserva con el día, la hora y la cancha, aunque el mensaje tenga tildes", async () => {
    const { herramientas } = await preguntar("Resérvame la cancha 2 mañana a las 20");

    expect(herramientas[0]).toEqual({ herramienta: "reservar", entrada: { fecha: manana, hora: 20, cancha: "Cancha 2" } });
  });

  it("busca las reservas de la persona para cancelar", async () => {
    const { herramientas } = await preguntar("Cancélala, por favor");

    expect(herramientas).toEqual([{ herramienta: "verMisReservas", entrada: {} }]);
  });

  it("responde los precios sin herramientas", async () => {
    const { herramientas, texto } = await preguntar("¿Cuánto cuesta una hora de cancha?");

    expect(herramientas).toEqual([]);
    expect(texto).toBe("La hora de cancha cuesta $12.000, y $16.000 en hora punta.");
  });

  it("pide el pronóstico del día (y de la hora, si la dice) y repite el primer tramo", async () => {
    const { herramientas, texto } = await preguntar("¿Va a llover mañana a las 7?");

    expect(herramientas).toEqual([{ herramienta: "verPronostico", entrada: { fecha: manana, desde: 19, hasta: 19 } }]);
    expect(texto).toBe("En Santiago, de 19:00 a 20:00: parcialmente nublado, 18 °C.");
    expect((await preguntar("¿Qué tiempo hará mañana?")).herramientas).toEqual([{ herramienta: "verPronostico", entrada: { fecha: manana } }]);
  });

  it("lo demás lo busca en la información del club", async () => {
    const { herramientas, texto } = await preguntar("¿Arriendan paletas?");

    expect(herramientas).toEqual([{ herramienta: "buscarInformacion", entrada: { pregunta: "¿Arriendan paletas?" } }]);
    expect(texto).toMatch(/^Según la información del club: Si no tienes paleta/);
  });
});
