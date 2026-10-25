import type { TextStreamPart, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import { filtroSinVoseo, sinVoseo } from "../src/asistente/voseo.ts";

describe("sinVoseo", () => {
  it("cambia las palabras de 'vos' por las de 'tú', también las chilenas", () => {
    // Lo que escribió el modelo en las evals del 2026-10-25
    expect(sinVoseo("Con lluvia no se juega, y podís cancelar la reserva sin costo.")).toBe(
      "Con lluvia no se juega, y puedes cancelar la reserva sin costo.",
    );
    expect(sinVoseo("Si tenés alguna consulta sobre el club, con gusto te ayudo.")).toBe(
      "Si tienes alguna consulta sobre el club, con gusto te ayudo.",
    );
    expect(sinVoseo("Decime qué hora querés y tocá el botón.")).toBe("Dime qué hora quieres y toca el botón.");
  });

  it("respeta la mayúscula del principio", () => {
    expect(sinVoseo("Podés reservar hasta 7 días antes.")).toBe("Puedes reservar hasta 7 días antes.");
  });

  it("no toca lo que ya está de 'tú', ni las palabras que solo se parecen", () => {
    const bien = "Puedes jugar tenis de mesa. Te muestro la que elegí para ti: ¿la quieres? Fíjate en la hora.";
    expect(sinVoseo(bien)).toBe(bien);
  });
});

// Pasa los pedazos por el filtro, como llegan de la IA, y devuelve lo que sale
async function filtrar(partes: TextStreamPart<ToolSet>[]) {
  const salida: TextStreamPart<ToolSet>[] = [];
  const entrada = new ReadableStream<TextStreamPart<ToolSet>>({
    start(controlador) {
      for (const parte of partes) controlador.enqueue(parte);
      controlador.close();
    },
  });
  const filtro = filtroSinVoseo<ToolSet>()({ tools: {}, stopStream: () => {} });
  for await (const parte of entrada.pipeThrough(filtro)) salida.push(parte);
  return salida;
}

const textoDe = (partes: TextStreamPart<ToolSet>[]) =>
  partes.map((parte) => (parte.type === "text-delta" ? parte.text : "")).join("");

describe("filtroSinVoseo", () => {
  it("encuentra la palabra aunque llegue cortada en dos pedazos", async () => {
    const salida = await filtrar([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "Si llueve, pod" },
      { type: "text-delta", id: "t1", text: "ís cancelar sin costo. ¿Ten" },
      { type: "text-delta", id: "t1", text: "és" },
      { type: "text-delta", id: "t1", text: " dudas?" },
      { type: "text-end", id: "t1" },
    ]);

    expect(textoDe(salida)).toBe("Si llueve, puedes cancelar sin costo. ¿Tienes dudas?");
    expect(salida[0].type).toBe("text-start");
    expect(salida.at(-1)?.type).toBe("text-end");
  });

  it("si el texto termina en medio de una palabra, la suelta antes del fin del texto", async () => {
    const salida = await filtrar([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "Lo que " },
      { type: "text-delta", id: "t1", text: "querés" },
      { type: "text-end", id: "t1" },
    ]);

    expect(salida.map((parte) => (parte.type === "text-delta" ? parte.text : parte.type))).toEqual([
      "text-start",
      "Lo que ",
      "quieres",
      "text-end",
    ]);
  });

  it("los pedazos que terminan entre palabras pasan tal como llegan", async () => {
    const salida = await filtrar([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "¡Hola! " },
      { type: "text-delta", id: "t1", text: "¿En qué te ayudo?" },
      { type: "text-end", id: "t1" },
    ]);

    expect(salida.filter((parte) => parte.type === "text-delta").map((parte) => parte.text)).toEqual([
      "¡Hola! ",
      "¿En qué te ayudo?",
    ]);
  });
});
