import { MockLanguageModelV4 } from "ai/test";
import { DateTime } from "luxon";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { crearApp } from "../src/app.ts";
import type { MisReservasDelChat, ResultadoDeCancelacion, ResultadoDeReserva } from "../src/asistente/reservas.ts";
import { nombreDelDia, pesos } from "../src/asistente/textos.ts";
import type { Cartero } from "../src/cartero.ts";
import { db } from "../src/db.ts";
import { ZONA_HORARIA } from "../src/servicios/horario.ts";
import { precioDelBloque } from "../src/servicios/precios.ts";
import {
  bloque,
  borrarDatosDePrueba,
  crearCanchaDePrueba,
  dia,
  entrarComoAdmin,
  entrarComoJugadorConCorreo,
  entrarComoJugadorNuevo,
} from "./ayudantes.ts";
import { escribirle, eventos, mensajeDeLaPersona, pasoQueEscribe, pasoQuePide, resultadoDeLaHerramienta } from "./ayudantesDelAsistente.ts";

// Reservar y cancelar por el chat, con la confirmación de la persona.
//
// Cada conversación son dos pedidos a la API, como en la página:
// 1) La persona escribe "resérvame...", el modelo pide la herramienta y la API responde con una tarjeta para confirmar.
// 2) La persona toca "Confirmar", la página vuelve a mandar la conversación con la respuesta y la API reserva.

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

type Ana = Awaited<ReturnType<typeof entrarComoJugadorNuevo>>;

// Un modelo falso que primero pide la herramienta y, en el pedido siguiente (después de confirmar), escribe
function modeloQuePide(herramienta: string, entrada: object, despues = "¡Listo!") {
  return new MockLanguageModelV4({ doStream: [pasoQuePide(herramienta, entrada), pasoQueEscribe(despues)] });
}

function avisadorFalso() {
  return { reservaCreada: vi.fn(), reservaCancelada: vi.fn() };
}

// La tarjeta que pidió la API: el evento con el pedido de confirmación
function pedidoDeConfirmacion(texto: string) {
  return eventos(texto).find((evento) => evento.type === "tool-approval-request");
}

// Así queda en la página el mensaje del asistente cuando la persona responde la tarjeta: la herramienta
// con lo que pidió el modelo y la respuesta de la persona ("approved"). La página lo manda en el pedido siguiente.
function respuestaALaTarjeta(herramienta: string, entrada: object, approved: boolean, idDeLaConfirmacion = "confirmacion-1") {
  return {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "step-start" },
      {
        type: `tool-${herramienta}`,
        toolCallId: "llamada-1",
        state: "approval-responded",
        input: entrada,
        approval: { id: idDeLaConfirmacion, approved },
      },
    ],
  };
}

function reservasDe(usuarioId: string) {
  return db.reserva.findMany({ where: { usuarioId, estado: "CONFIRMADA" } });
}

describe("reservar por el chat", () => {
  it("primero muestra una tarjeta para confirmar, con lo que arma la API, y no reserva nada todavía", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const modelo = modeloQuePide("reservar", pedido);
    const app = crearApp({ modelos: [modelo] });
    const ana = await entrarComoJugadorNuevo(app);

    const respuesta = await escribirle(app, [mensajeDeLaPersona("Resérvame mañana a las 10")], ana.navegador);

    expect(respuesta.status).toBe(200);
    const tarjeta = pedidoDeConfirmacion(respuesta.body);
    const precio = pesos(precioDelBloque(new Date(bloque(1, 10))));
    expect(tarjeta?.reason).toBe(`${cancha.nombre} · ${nombreDelDia(dia(1))} · 10:00 a 11:00 · ${precio}`);
    expect(tarjeta?.isAutomatic).toBeUndefined();
    // La API se detuvo a esperar a la persona: no le volvió a preguntar al modelo ni reservó
    expect(modelo.doStreamCalls).toHaveLength(1);
    expect(await reservasDe(ana.usuario.id)).toEqual([]);
  });

  it("al confirmar, reserva a nombre de quien conversa, avisa en vivo y el modelo lo cuenta", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const modelo = modeloQuePide("reservar", pedido, "¡Listo, quedó reservada!");
    const avisador = avisadorFalso();
    const app = crearApp({ modelos: [modelo], avisador });
    const ana = await entrarComoJugadorNuevo(app);
    const pregunta = mensajeDeLaPersona("Resérvame mañana a las 10");

    // 1) La tarjeta. Se usan los mismos ids que mandó la API, como hace la página.
    const primera = await escribirle(app, [pregunta], ana.navegador);
    const { approvalId } = pedidoDeConfirmacion(primera.body)!;

    // 2) La persona toca "Confirmar"
    const segunda = await escribirle(app, [pregunta, respuestaALaTarjeta("reservar", pedido, true, approvalId)], ana.navegador);

    expect(segunda.status).toBe(200);
    const [reserva] = await reservasDe(ana.usuario.id);
    expect(reserva).toMatchObject({ recursoId: cancha.id, inicio: new Date(bloque(1, 10)) });
    expect(avisador.reservaCreada).toHaveBeenCalledWith({ recursoId: cancha.id, inicio: reserva.inicio });

    // La página recibe la reserva hecha, para mostrarla en la tarjeta
    const resultado = resultadoDeLaHerramienta<ResultadoDeReserva>(segunda.body);
    expect(resultado?.reserva).toMatchObject({ id: reserva.id, cancha: cancha.nombre, fecha: dia(1), hora: "10:00" });

    // El modelo lee que quedó reservada, y con eso responde
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain(`Quedó reservada: ${cancha.nombre} · `);
    expect(segunda.body).toContain("¡Listo, quedó reservada!");
  });

  it("si la persona no confirma, no reserva y el modelo recibe que no se aprobó", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const modelo = modeloQuePide("reservar", pedido, "Bueno, no la reservo.");
    const app = crearApp({ modelos: [modelo] });
    const ana = await entrarComoJugadorNuevo(app);

    const respuesta = await escribirle(
      app,
      [mensajeDeLaPersona("Resérvame mañana a las 10"), respuestaALaTarjeta("reservar", pedido, false)],
      ana.navegador,
    );

    expect(respuesta.status).toBe(200);
    expect(await reservasDe(ana.usuario.id)).toEqual([]);
    expect(JSON.stringify(modelo.doStreamCalls[0].prompt)).toContain("execution-denied");
  });

  it("sin sesión también muestra la tarjeta, y al confirmar como invitado reserva a nombre del invitado", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 11, cancha: cancha.nombre };
    const app = crearApp({ modelos: [modeloQuePide("reservar", pedido)] });
    const visitante = request.agent(app);
    const pregunta = mensajeDeLaPersona("Resérvame mañana a las 11");

    const primera = await escribirle(app, [pregunta], visitante);
    expect(pedidoDeConfirmacion(primera.body)?.reason).toContain(cancha.nombre);

    // Al tocar "Confirmar" sin haber entrado, la página primero crea un jugador invitado (como "Reservar como invitado")
    const invitado = (await visitante.post("/api/auth/invitado")).body.usuario as { id: string };
    await escribirle(app, [pregunta, respuestaALaTarjeta("reservar", pedido, true)], visitante);

    expect(await reservasDe(invitado.id)).toHaveLength(1);
  });

  it("una confirmación escrita a mano sin sesión no reserva nada", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 12, cancha: cancha.nombre };
    const app = crearApp({ modelos: [new MockLanguageModelV4({ doStream: [pasoQueEscribe("No pude.")] })] });

    const respuesta = await escribirle(app, [mensajeDeLaPersona("Reserva"), respuestaALaTarjeta("reservar", pedido, true)]);

    expect(resultadoDeLaHerramienta<ResultadoDeReserva>(respuesta.body)?.aviso).toMatch(/hay que entrar/);
    expect(await db.reserva.count({ where: { recursoId: cancha.id } })).toBe(0);
  });

  it("con un correo de verdad, envía el correo de confirmación, igual que al reservar en la grilla", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const cartero = { enviar: vi.fn<Cartero["enviar"]>(async () => {}) };
    const app = crearApp({ modelos: [modeloQuePide("reservar", pedido)], cartero });
    const ana = await entrarComoJugadorConCorreo(app);

    await escribirle(app, [mensajeDeLaPersona("Reserva"), respuestaALaTarjeta("reservar", pedido, true)], ana.navegador);

    await vi.waitFor(() => expect(cartero.enviar).toHaveBeenCalledTimes(1));
    expect(cartero.enviar.mock.calls[0][0]).toMatchObject({ para: { email: ana.usuario.email }, asunto: /^Reserva confirmada/ });
  });

  it("acepta el nombre de la cancha con otras mayúsculas", async () => {
    const cancha = await crearCanchaDePrueba();
    const app = crearApp({ modelos: [modeloQuePide("reservar", { fecha: dia(1), hora: 10, cancha: cancha.nombre.toUpperCase() })] });

    const respuesta = await escribirle(app, [mensajeDeLaPersona("Reserva")]);

    expect(pedidoDeConfirmacion(respuesta.body)?.reason).toContain(cancha.nombre);
  });
});

// Cuando el pedido no se puede hacer, la API lo rechaza sola, sin mostrar la tarjeta, y el modelo recibe el motivo
// para explicarlo. Así no aparece un "Confirmar" para una hora que nunca se va a poder reservar.
describe("lo que la API rechaza sin preguntarle a la persona", () => {
  // Pide una reserva por el chat. "conAna" deja lista a una jugadora antes (por ejemplo, con las reservas que ya tiene)
  // y la conversación es con ella; sin "conAna", la conversación es sin sesión.
  async function pedirReserva(entrada: object, conAna?: (ana: Ana) => Promise<unknown>) {
    const modelo = modeloQuePide("reservar", entrada, "No se pudo.");
    const app = crearApp({ modelos: [modelo] });
    const ana = conAna ? await entrarComoJugadorNuevo(app) : undefined;
    if (ana) await conAna?.(ana);

    const respuesta = await escribirle(app, [mensajeDeLaPersona("Reserva")], ana?.navegador ?? request(app));
    const tarjeta = pedidoDeConfirmacion(respuesta.body);
    return { tarjeta, rechazo: eventos(respuesta.body).find((e) => e.type === "tool-approval-response"), modelo };
  }

  it("una hora ocupada", async () => {
    const cancha = await crearCanchaDePrueba();
    const app = crearApp();
    const beto = await entrarComoJugadorNuevo(app);
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });

    const { tarjeta, rechazo, modelo } = await pedirReserva({ fecha: dia(1), hora: 10, cancha: cancha.nombre });

    expect(tarjeta?.isAutomatic).toBe(true);
    expect(rechazo).toMatchObject({ approved: false, reason: expect.stringMatching(/ya está reservada/) });
    // El modelo sigue y explica el motivo
    expect(modelo.doStreamCalls).toHaveLength(2);
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain(`La ${cancha.nombre} ya está reservada`);
  });

  it("si la persona ya tiene 2 reservas activas", async () => {
    const cancha = await crearCanchaDePrueba();

    const { rechazo } = await pedirReserva({ fecha: dia(1), hora: 12, cancha: cancha.nombre }, async (ana) => {
      await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });
      await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 11) });
    });

    expect(rechazo?.reason).toMatch(/ya tiene 2 reservas activas/);
  });

  it("si la persona ya tiene otra reserva a esa misma hora", async () => {
    const [cancha, otra] = [await crearCanchaDePrueba(), await crearCanchaDePrueba()];

    const { rechazo } = await pedirReserva({ fecha: dia(1), hora: 10, cancha: cancha.nombre }, (ana) =>
      ana.navegador.post("/api/reservas").send({ recursoId: otra.id, inicio: bloque(1, 10) }),
    );

    expect(rechazo?.reason).toBe(`La persona ya tiene una reserva a esa hora, en la ${otra.nombre}.`);
  });

  it("un día que no se puede reservar, una hora fuera del horario o que ya pasó, y una cancha que no existe", async () => {
    const cancha = await crearCanchaDePrueba();
    const casos: [object, RegExp][] = [
      [{ fecha: dia(7), hora: 10, cancha: cancha.nombre }, /Ese día no se puede reservar/],
      [{ fecha: dia(1), hora: 23, cancha: cancha.nombre }, /la última reserva empieza a las 22:00/],
      [{ fecha: dia(1), hora: 10, cancha: "Cancha 99" }, /No hay ninguna cancha llamada "Cancha 99"\. Las canchas son: /],
    ];
    // Una hora de hoy que ya pasó (antes de las 09:00 todavía no hay ninguna)
    const horaQuePaso = DateTime.now().setZone(ZONA_HORARIA).hour - 1;
    if (horaQuePaso >= 8) casos.push([{ fecha: dia(0), hora: Math.min(horaQuePaso, 22), cancha: cancha.nombre }, /Esa hora ya pasó/]);

    for (const [entrada, motivo] of casos) {
      const { tarjeta, rechazo } = await pedirReserva(entrada);
      expect(tarjeta?.isAutomatic, JSON.stringify(entrada)).toBe(true);
      expect(rechazo?.reason, JSON.stringify(entrada)).toMatch(motivo);
    }
  });

  it("un administrador (en la página no ve el asistente, pero la API también lo revisa)", async () => {
    const cancha = await crearCanchaDePrueba();
    const app = crearApp({ modelos: [modeloQuePide("reservar", { fecha: dia(1), hora: 10, cancha: cancha.nombre })] });
    const admin = await entrarComoAdmin(app);

    const respuesta = await escribirle(app, [mensajeDeLaPersona("Reserva")], admin);

    expect(eventos(respuesta.body).find((e) => e.type === "tool-approval-response")?.reason).toMatch(/administradores no reservan/);
  });

  it("si otra persona tomó la hora mientras se decidía, la confirmación ya no sirve", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const modelo = modeloQuePide("reservar", pedido, "Justo la tomaron.");
    const app = crearApp({ modelos: [modelo] });
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const pregunta = mensajeDeLaPersona("Resérvame mañana a las 10");

    const primera = await escribirle(app, [pregunta], ana.navegador);
    expect(pedidoDeConfirmacion(primera.body)?.isAutomatic).toBeUndefined();
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });
    const segunda = await escribirle(app, [pregunta, respuestaALaTarjeta("reservar", pedido, true)], ana.navegador);

    expect(eventos(segunda.body).some((e) => e.type === "tool-output-denied")).toBe(true);
    expect(await reservasDe(ana.usuario.id)).toEqual([]);
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain("ya está reservada");
  });
});

describe("ver y cancelar mis reservas por el chat", () => {
  it("verMisReservas le da al modelo las reservas propias con su id, y a la página la lista", async () => {
    const cancha = await crearCanchaDePrueba();
    const app = crearApp({
      modelos: [new MockLanguageModelV4({ doStream: [pasoQuePide("verMisReservas", {}), pasoQueEscribe("Tienes una.")] })],
    });
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const { reserva } = (await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) })).body;
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 11) });

    const respuesta = await escribirle(app, [mensajeDeLaPersona("¿Qué reservas tengo?")], ana.navegador);

    const lista = resultadoDeLaHerramienta<MisReservasDelChat>(respuesta.body);
    expect(lista?.reservas).toEqual([
      { id: reserva.id, cancha: cancha.nombre, fecha: dia(1), hora: "10:00", precio: reserva.precio },
    ]);
  });

  it("sin sesión, verMisReservas avisa que la persona no ha entrado", async () => {
    const modelo = new MockLanguageModelV4({ doStream: [pasoQuePide("verMisReservas", {}), pasoQueEscribe("No tienes.")] });

    await escribirle(crearApp({ modelos: [modelo] }), [mensajeDeLaPersona("¿Qué reservas tengo?")]);

    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain("La persona no ha entrado");
  });

  it("cancelar también pide confirmación, y al confirmar cancela, avisa en vivo y libera la hora", async () => {
    const cancha = await crearCanchaDePrueba();
    const avisador = avisadorFalso();
    // Lo que pide el modelo lleva el id de la reserva, que se sabe recién después de crearla
    const pasos: (ReturnType<typeof pasoQuePide> | ReturnType<typeof pasoQueEscribe>)[] = [];
    const modelo = new MockLanguageModelV4({ doStream: async () => pasos.shift()! });
    const app = crearApp({ modelos: [modelo], avisador });
    const ana = await entrarComoJugadorNuevo(app);
    const { reserva } = (await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) })).body;
    const pedido = { reservaId: reserva.id };
    pasos.push(pasoQuePide("cancelarReserva", pedido), pasoQueEscribe("Listo, la cancelé."));
    const pregunta = mensajeDeLaPersona("Cancela mi reserva de mañana");

    const primera = await escribirle(app, [pregunta], ana.navegador);
    expect(pedidoDeConfirmacion(primera.body)?.reason).toMatch(new RegExp(`^${cancha.nombre} · .* · 10:00 a 11:00 · \\$`));
    expect(await reservasDe(ana.usuario.id)).toHaveLength(1);

    const segunda = await escribirle(app, [pregunta, respuestaALaTarjeta("cancelarReserva", pedido, true)], ana.navegador);

    expect(resultadoDeLaHerramienta<ResultadoDeCancelacion>(segunda.body)?.cancelada?.id).toBe(reserva.id);
    expect(await reservasDe(ana.usuario.id)).toEqual([]);
    expect(avisador.reservaCancelada).toHaveBeenCalledWith({ recursoId: cancha.id, inicio: new Date(reserva.inicio) });
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain("Quedó cancelada:");
  });

  it("no deja cancelar la reserva de otra persona, y responde como si no existiera", async () => {
    const cancha = await crearCanchaDePrueba();
    const app = crearApp();
    const beto = await entrarComoJugadorNuevo(app);
    const { reserva } = (await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) })).body;
    const modelo = modeloQuePide("cancelarReserva", { reservaId: reserva.id });
    const appConModelo = crearApp({ modelos: [modelo] });
    const ana = await entrarComoJugadorNuevo(appConModelo);

    // Ni pidiéndola al modelo ni escribiendo la confirmación a mano
    const pedida = await escribirle(appConModelo, [mensajeDeLaPersona("Cancela esa")], ana.navegador);
    const aMano = await escribirle(
      appConModelo,
      [mensajeDeLaPersona("Cancela esa"), respuestaALaTarjeta("cancelarReserva", { reservaId: reserva.id }, true)],
      ana.navegador,
    );

    expect(eventos(pedida.body).find((e) => e.type === "tool-approval-response")?.reason).toMatch(/no está entre las próximas reservas/);
    expect(eventos(aMano.body).some((e) => e.type === "tool-output-denied")).toBe(true);
    expect(await reservasDe(beto.usuario.id)).toHaveLength(1);
  });
});

describe("la conversación con confirmaciones", () => {
  it("una confirmación que quedó atrás (por ejemplo, si se cortó la conexión) se quita y no reserva", async () => {
    const cancha = await crearCanchaDePrueba();
    const pedido = { fecha: dia(1), hora: 10, cancha: cancha.nombre };
    const modelo = new MockLanguageModelV4({ doStream: [pasoQueEscribe("Hola.")] });
    const app = crearApp({ modelos: [modelo] });
    const ana = await entrarComoJugadorNuevo(app);

    const respuesta = await escribirle(
      app,
      [mensajeDeLaPersona("Reserva"), respuestaALaTarjeta("reservar", pedido, true), mensajeDeLaPersona("¿Sigues ahí?", "m2")],
      ana.navegador,
    );

    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(modelo.doStreamCalls[0].prompt)).not.toContain("llamada-1");
    expect(await reservasDe(ana.usuario.id)).toEqual([]);
  });

  it("una tarjeta que la persona no respondió (escribió otra cosa) tampoco llega al modelo", async () => {
    const cancha = await crearCanchaDePrueba();
    const modelo = new MockLanguageModelV4({ doStream: [pasoQueEscribe("Claro.")] });
    const sinResponder = {
      type: "tool-reservar",
      toolCallId: "llamada-1",
      state: "approval-requested",
      input: { fecha: dia(1), hora: 10, cancha: cancha.nombre },
      approval: { id: "confirmacion-1" },
    };

    const respuesta = await escribirle(crearApp({ modelos: [modelo] }), [
      mensajeDeLaPersona("Reserva"),
      { id: "a1", role: "assistant", parts: [{ type: "step-start" }, sinResponder] },
      mensajeDeLaPersona("Mejor a las 11", "m2"),
    ]);

    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(modelo.doStreamCalls[0].prompt)).not.toContain("llamada-1");
  });

  it("responde 400 si una confirmación trae datos con otra forma", async () => {
    const app = crearApp({ modelos: [new MockLanguageModelV4({ doStream: [pasoQueEscribe("Ok")] })] });

    const respuesta = await request(app)
      .post("/api/asistente")
      .send({ messages: [mensajeDeLaPersona("Reserva"), respuestaALaTarjeta("reservar", { fecha: "mañana", hora: "10" }, true)] });

    expect(respuesta.status).toBe(400);
  });
});
