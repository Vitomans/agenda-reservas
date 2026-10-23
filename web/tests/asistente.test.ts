import { describe, expect, it } from "vitest";
import {
  cambiaronLasReservas,
  debeEnviarseSolo,
  errorDelAsistente,
  estadoDeLaTarjeta,
  type MensajeDelAsistente,
  type ParteQueConfirma,
  pedidoDeCancelacion,
  pedidoDeHora,
  reservasCanceladas,
} from "@/lib/asistente";

describe("errorDelAsistente", () => {
  it("muestra el mensaje que mandó la API cuando rechaza el pedido", () => {
    const error = new Error(JSON.stringify({ error: "Le escribiste muchos mensajes seguidos al asistente." }));

    expect(errorDelAsistente(error)).toEqual({ mensaje: "Le escribiste muchos mensajes seguidos al asistente.", cerrarElChat: false });
  });

  it("dice que el chat se cierra cuando la API lo pide (el asistente está descansando)", () => {
    const error = new Error(JSON.stringify({ error: "El asistente está descansando.", cerrarElChat: true }));

    expect(errorDelAsistente(error)).toEqual({ mensaje: "El asistente está descansando.", cerrarElChat: true });
  });

  it("avisa cuando no hay conexión", () => {
    expect(errorDelAsistente(new TypeError("Failed to fetch")).mensaje).toMatch(/No se pudo conectar/);
  });

  it("cualquier otro error se muestra como un mensaje general en español, sin cerrar el chat", () => {
    for (const error of [new Error("Failed to fetch the chat response."), new Error(JSON.stringify({ otra: "cosa" }))]) {
      expect(errorDelAsistente(error)).toEqual({ mensaje: expect.stringMatching(/tuvo un problema/), cerrarElChat: false });
    }
  });
});

describe("pedidoDeHora", () => {
  it("es lo que se le escribe al asistente al tocar una hora libre, con el día completo", () => {
    expect(pedidoDeHora("2026-10-23", "19:00")).toBe("Quiero reservar el viernes 23 de octubre a las 19:00");
  });
});

describe("pedidoDeCancelacion", () => {
  it("es lo que se le escribe al asistente al tocar 'Cancelar' en una de las reservas que mostró", () => {
    const reserva = { id: "r-1", cancha: "Cancha 2", fecha: "2026-10-23", hora: "19:00", precio: 16_000 };

    expect(pedidoDeCancelacion(reserva)).toBe("Quiero cancelar mi reserva de la Cancha 2 del viernes 23 de octubre a las 19:00");
  });
});

// Una herramienta "reservar" en cada estado, como la guarda useChat
const PEDIDO = { fecha: "2026-10-23", hora: 19, cancha: "Cancha 2" };
const RESERVA = { id: "r-1", cancha: "Cancha 2", fecha: "2026-10-23", hora: "19:00", precio: 16_000 };

function parte(estado: Partial<ParteQueConfirma>): ParteQueConfirma {
  return { type: "tool-reservar", toolCallId: "llamada-1", input: PEDIDO, ...estado } as ParteQueConfirma;
}

const pidiendo = parte({ state: "approval-requested", approval: { id: "c-1", requestReason: "Cancha 2 · ..." } });
const confirmada = parte({ state: "approval-responded", approval: { id: "c-1", approved: true } });
const rechazada = parte({ state: "approval-responded", approval: { id: "c-1", approved: false } });

describe("estadoDeLaTarjeta", () => {
  const enElUltimo = { esElUltimo: true, respondiendo: false, fallo: false };

  it("espera la respuesta de la persona solo en el último mensaje; si escribió otra cosa, queda vencida", () => {
    expect(estadoDeLaTarjeta(pidiendo, enElUltimo)).toBe("pendiente");
    expect(estadoDeLaTarjeta(pidiendo, { ...enElUltimo, esElUltimo: false })).toBe("vencida");
  });

  it("después de confirmar, muestra que la está haciendo; si el pedido falló, que no se pudo", () => {
    expect(estadoDeLaTarjeta(confirmada, enElUltimo)).toBe("confirmando");
    expect(estadoDeLaTarjeta(confirmada, { ...enElUltimo, fallo: true })).toBe("no-se-pudo");
    expect(estadoDeLaTarjeta(rechazada, enElUltimo)).toBe("rechazada");
  });

  it("al terminar, dice si se hizo o no según lo que devolvió la API", () => {
    const aprobacion = { id: "c-1", approved: true } as const;
    expect(estadoDeLaTarjeta(parte({ state: "output-available", output: { reserva: RESERVA }, approval: aprobacion }), enElUltimo)).toBe(
      "hecha",
    );
    expect(
      estadoDeLaTarjeta(parte({ state: "output-available", output: { aviso: "Ese horario ya está reservado" }, approval: aprobacion }), enElUltimo),
    ).toBe("no-se-pudo");
    // La persona confirmó, pero al revisar de nuevo la API vio que otra persona tomó la hora
    expect(estadoDeLaTarjeta(parte({ state: "output-denied", approval: { id: "c-1", approved: false } }), enElUltimo)).toBe("no-se-pudo");
  });

  it("si la API la rechazó sola (por ejemplo, una hora ocupada), no hay tarjeta: lo explica el asistente", () => {
    const automatica = { id: "c-1", approved: false, isAutomatic: true } as const;

    expect(estadoDeLaTarjeta(parte({ state: "output-denied", approval: automatica }), enElUltimo)).toBeNull();
  });

  it("mientras la API la revisa, muestra que está revisando, y nada si se detuvo", () => {
    const revisando = parte({ state: "input-available" });

    expect(estadoDeLaTarjeta(revisando, { ...enElUltimo, respondiendo: true })).toBe("revisando");
    expect(estadoDeLaTarjeta(revisando, enElUltimo)).toBeNull();
  });
});

function delAsistente(...partes: ParteQueConfirma[]): MensajeDelAsistente {
  return { id: "a1", role: "assistant", parts: [{ type: "step-start" }, ...partes] };
}

describe("debeEnviarseSolo", () => {
  it("manda la conversación sola cuando la persona confirmó, pero no cuando dijo que no (no hace falta la IA)", () => {
    expect(debeEnviarseSolo({ messages: [delAsistente(confirmada)] })).toBe(true);
    expect(debeEnviarseSolo({ messages: [delAsistente(rechazada)] })).toBe(false);
    expect(debeEnviarseSolo({ messages: [delAsistente(pidiendo)] })).toBe(false);
  });
});

describe("cambiaronLasReservas", () => {
  it("es true si el mensaje trae una reserva hecha o una cancelación hecha", () => {
    const hecha = parte({ state: "output-available", output: { reserva: RESERVA }, approval: { id: "c-1", approved: true } });
    const noSePudo = parte({ state: "output-available", output: { aviso: "No" }, approval: { id: "c-1", approved: true } });
    const cancelada = {
      type: "tool-cancelarReserva",
      toolCallId: "llamada-2",
      state: "output-available",
      input: { reservaId: "r-1" },
      output: { cancelada: RESERVA },
    } as ParteQueConfirma;

    expect(cambiaronLasReservas(delAsistente(hecha))).toBe(true);
    expect(cambiaronLasReservas(delAsistente(cancelada))).toBe(true);
    expect(cambiaronLasReservas(delAsistente(noSePudo))).toBe(false);
    expect(cambiaronLasReservas(delAsistente(pidiendo))).toBe(false);
  });
});

describe("reservasCanceladas", () => {
  it("junta los ids de las reservas que se cancelaron en la conversación", () => {
    const cancelada = {
      type: "tool-cancelarReserva",
      toolCallId: "llamada-2",
      state: "output-available",
      input: { reservaId: "r-1" },
      output: { cancelada: RESERVA },
    } as ParteQueConfirma;
    const noSePudo = { ...cancelada, toolCallId: "llamada-3", output: { aviso: "Esa reserva ya empezó" } } as ParteQueConfirma;

    expect(reservasCanceladas([delAsistente(pidiendo), delAsistente(cancelada, noSePudo)])).toEqual(new Set(["r-1"]));
  });
});
