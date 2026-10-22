import { describe, expect, it } from "vitest";
import { mensajeDelError, pedidoDeHora } from "@/lib/asistente";

describe("mensajeDelError", () => {
  it("muestra el mensaje que mandó la API cuando rechaza el pedido", () => {
    const error = new Error(JSON.stringify({ error: "Le escribiste muchos mensajes seguidos al asistente." }));

    expect(mensajeDelError(error)).toBe("Le escribiste muchos mensajes seguidos al asistente.");
  });

  it("avisa cuando no hay conexión", () => {
    expect(mensajeDelError(new TypeError("Failed to fetch"))).toMatch(/No se pudo conectar/);
  });

  it("cualquier otro error se muestra como un mensaje general en español", () => {
    expect(mensajeDelError(new Error("Failed to fetch the chat response."))).toMatch(/tuvo un problema/);
    expect(mensajeDelError(new Error(JSON.stringify({ otra: "cosa" })))).toMatch(/tuvo un problema/);
  });
});

describe("pedidoDeHora", () => {
  it("es lo que se le escribe al asistente al tocar una hora libre, con el día completo", () => {
    expect(pedidoDeHora("2026-10-23", "19:00")).toBe("Quiero reservar el viernes 23 de octubre a las 19:00");
  });
});
