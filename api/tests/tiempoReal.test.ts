import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as conectar, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { crearTiempoReal } from "../src/tiempoReal.ts";
import { bloque, borrarDatosDePrueba, crearCanchaDePrueba, entrarComoJugadorNuevo } from "./ayudantes.ts";

// Un servidor igual al de server.ts (Express + Socket.io), escuchando en un puerto libre
const { io, avisador } = crearTiempoReal();
const app = crearApp({ avisador });
const servidorHttp = createServer(app);
io.attach(servidorHttp);

let direccion = "";
const conexiones: Socket[] = [];

beforeAll(async () => {
  await new Promise<void>((listo) => servidorHttp.listen(0, listo)); // 0 = cualquier puerto libre
  direccion = `http://localhost:${(servidorHttp.address() as AddressInfo).port}`;
});

afterAll(async () => {
  conexiones.forEach((conexion) => conexion.disconnect());
  await io.close(); // también cierra el servidor HTTP
  await borrarDatosDePrueba();
  await db.$disconnect();
});

// Conecta un "navegador" en vivo y espera a que quede siguiendo esas canchas
async function seguirCanchas(recursoIds: string[]) {
  const conexion = conectar(direccion, { transports: ["websocket"] });
  conexiones.push(conexion);
  await conexion.emitWithAck("canchas:seguir", recursoIds);
  return conexion;
}

function esperarAviso(conexion: Socket, evento: "reserva:creada" | "reserva:cancelada") {
  return new Promise((resolver) => conexion.once(evento, resolver));
}

describe("avisos en vivo", () => {
  it("avisa a quien mira la cancha cuando alguien reserva", async () => {
    const cancha = await crearCanchaDePrueba();
    const mirando = await seguirCanchas([cancha.id]);
    const aviso = esperarAviso(mirando, "reserva:creada");

    const { navegador } = await entrarComoJugadorNuevo(app);
    await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) }).expect(201);

    expect(await aviso).toEqual({ recursoId: cancha.id, inicio: bloque(1, 10) });
  });

  it("avisa cuando se cancela una reserva", async () => {
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);
    const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 12) });
    const mirando = await seguirCanchas([cancha.id]);
    const aviso = esperarAviso(mirando, "reserva:cancelada");

    await navegador.delete(`/api/reservas/${respuesta.body.reserva.id}`).expect(204);

    expect(await aviso).toEqual({ recursoId: cancha.id, inicio: bloque(1, 12) });
  });

  it("no avisa a quien mira otra cancha", async () => {
    const canchaA = await crearCanchaDePrueba();
    const canchaB = await crearCanchaDePrueba();
    const mirandoA = await seguirCanchas([canchaA.id]);
    const mirandoB = await seguirCanchas([canchaB.id]);
    const avisosDeB = vi.fn();
    mirandoB.on("reserva:creada", avisosDeB);
    const avisoDeA = esperarAviso(mirandoA, "reserva:creada");

    const { navegador } = await entrarComoJugadorNuevo(app);
    await navegador.post("/api/reservas").send({ recursoId: canchaA.id, inicio: bloque(1, 14) }).expect(201);
    await avisoDeA;
    // Una vuelta más con B: si el servidor le hubiera mandado el aviso, ya le habría llegado
    await mirandoB.emitWithAck("canchas:seguir", [canchaB.id]);

    expect(avisosDeB).not.toHaveBeenCalled();
  });

  it("al cambiar de cancha deja de recibir los avisos de la anterior", async () => {
    const anterior = await crearCanchaDePrueba();
    const nueva = await crearCanchaDePrueba();
    const conexion = await seguirCanchas([anterior.id]);
    await conexion.emitWithAck("canchas:seguir", [nueva.id]);
    const avisos = vi.fn();
    conexion.on("reserva:creada", avisos);
    const avisoDeLaNueva = esperarAviso(conexion, "reserva:creada");

    const { navegador } = await entrarComoJugadorNuevo(app);
    await navegador.post("/api/reservas").send({ recursoId: anterior.id, inicio: bloque(1, 16) }).expect(201);
    await navegador.post("/api/reservas").send({ recursoId: nueva.id, inicio: bloque(1, 16) }).expect(201);
    await avisoDeLaNueva;

    expect(avisos).toHaveBeenCalledTimes(1);
    expect(avisos).toHaveBeenCalledWith({ recursoId: nueva.id, inicio: bloque(1, 16) });
  });

  it("no avisa si la reserva no se pudo hacer", async () => {
    const avisadorFalso = { reservaCreada: vi.fn(), reservaCancelada: vi.fn() };
    const appConAvisadorFalso = crearApp({ avisador: avisadorFalso });
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(appConAvisadorFalso);
    const beto = await entrarComoJugadorNuevo(appConAvisadorFalso);

    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 18) }).expect(201);
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 18) }).expect(409);

    expect(avisadorFalso.reservaCreada).toHaveBeenCalledTimes(1);
  });
});
