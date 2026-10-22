import { describe, expect, it } from "vitest";
import { mensajeDelError, textoDelMensaje } from "@/lib/asistente";

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

describe("textoDelMensaje", () => {
  it("junta las partes de texto y deja fuera las demás", () => {
    const mensaje = {
      id: "m1",
      role: "assistant" as const,
      parts: [
        { type: "step-start" as const },
        { type: "text" as const, text: "Abrimos " },
        { type: "text" as const, text: "a las 08:00." },
      ],
    };

    expect(textoDelMensaje(mensaje)).toBe("Abrimos a las 08:00.");
  });
});
