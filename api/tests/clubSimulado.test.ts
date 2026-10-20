import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as conectar, type Socket } from "socket.io-client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import {
  DOMINIO_SOCIOS,
  diaParaMover,
  emailDeSocio,
  moverElClub,
  probabilidadDeOcupacion,
  rellenarDias,
} from "../src/servicios/clubSimulado.ts";
import { iniciarSimulador } from "../src/simulador.ts";
import { crearTiempoReal } from "../src/tiempoReal.ts";
import { bloque, borrarDatosDePrueba, crearCanchaDePrueba, dia, entrarComoJugadorNuevo } from "./ayudantes.ts";

// Los socios simulados los crea el seed (npm run db:seed), igual que los usuarios demo.

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

function avisadorFalso() {
  return { reservaCreada: vi.fn(), reservaCancelada: vi.fn() };
}

function reservasDeLaCancha(recursoId: string) {
  return db.reserva.findMany({
    where: { recursoId },
    orderBy: { inicio: "asc" },
    select: { inicio: true, estado: true, usuario: { select: { id: true, email: true } } },
  });
}

describe("probabilidadDeOcupacion", () => {
  const miercoles = "2026-10-21";
  const sabado = "2026-10-24";

  it("entre semana, la noche se llena más que la mañana", () => {
    expect(probabilidadDeOcupacion(miercoles, 19, 0)).toBeGreaterThan(probabilidadDeOcupacion(miercoles, 9, 0));
  });

  it("el fin de semana se juega más en la mañana que entre semana", () => {
    expect(probabilidadDeOcupacion(sabado, 10, 0)).toBeGreaterThan(probabilidadDeOcupacion(miercoles, 10, 0));
  });

  it("los días lejanos tienen menos reservas", () => {
    expect(probabilidadDeOcupacion(miercoles, 19, 6)).toBeLessThan(probabilidadDeOcupacion(miercoles, 19, 0));
  });
});

describe("rellenarDias", () => {
  it("llena la cancha con reservas confirmadas de socios", async () => {
    const cancha = await crearCanchaDePrueba();

    await rellenarDias({ dias: [dia(1), dia(2), dia(3)], recursoIds: [cancha.id] });

    const reservas = await reservasDeLaCancha(cancha.id);
    expect(reservas.length).toBeGreaterThan(0);
    for (const reserva of reservas) {
      expect(reserva.usuario.email.endsWith(DOMINIO_SOCIOS)).toBe(true);
      expect(reserva.estado).toBe("CONFIRMADA");
    }
  });

  it("no vuelve a rellenar un día que ya tiene reservas de socios", async () => {
    const cancha = await crearCanchaDePrueba();
    const dias = [dia(1), dia(2), dia(3)];

    await rellenarDias({ dias, recursoIds: [cancha.id] });
    const despuesDeLaPrimera = (await reservasDeLaCancha(cancha.id)).length;
    await rellenarDias({ dias, recursoIds: [cancha.id] });

    expect((await reservasDeLaCancha(cancha.id)).length).toBe(despuesDeLaPrimera);
  });

  it("no les quita la hora a los jugadores que ya reservaron", async () => {
    const cancha = await crearCanchaDePrueba();
    const { navegador, usuario } = await entrarComoJugadorNuevo(crearApp());
    // Las 19:00 y las 20:00 son las horas que más se llenan
    for (const hora of [19, 20]) {
      await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, hora) }).expect(201);
    }

    await rellenarDias({ dias: [dia(1)], recursoIds: [cancha.id] });

    const reservas = await reservasDeLaCancha(cancha.id);
    for (const hora of [19, 20]) {
      const deEsaHora = reservas.filter((r) => r.inicio.toISOString() === bloque(1, hora));
      expect(deEsaHora).toEqual([expect.objectContaining({ usuario: expect.objectContaining({ id: usuario.id }) })]);
    }
  });
});

describe("moverElClub", () => {
  // Mañana a las 07:00, antes de que abra el club: todas las horas de mañana están por jugar
  const mananaTemprano = () => new Date(bloque(1, 7));

  it("si hoy ya terminó, mueve el club de mañana", () => {
    expect(diaParaMover(new Date(bloque(0, 9)))).toBe(dia(0));
    expect(diaParaMover(new Date(bloque(0, 22, 30)))).toBe(dia(1));
  });

  it("un socio reserva una hora libre y avisa en vivo", async () => {
    const cancha = await crearCanchaDePrueba();
    const avisador = avisadorFalso();

    const movimiento = await moverElClub(cancha.id, avisador, { azar: () => 0.5, ahora: mananaTemprano() });

    expect(movimiento).toMatchObject({ tipo: "reserva", recursoId: cancha.id });
    const reservas = await reservasDeLaCancha(cancha.id);
    expect(reservas).toHaveLength(1);
    expect(reservas[0]).toMatchObject({ inicio: movimiento!.inicio, estado: "CONFIRMADA" });
    expect(reservas[0].usuario.email.endsWith(DOMINIO_SOCIOS)).toBe(true);
    expect(avisador.reservaCreada).toHaveBeenCalledWith({ recursoId: cancha.id, inicio: movimiento!.inicio });
  });

  it("cancela la reserva de un socio, nunca la de un jugador", async () => {
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(crearApp());
    await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) }).expect(201);
    const socio = await db.usuario.findUniqueOrThrow({ where: { email: emailDeSocio(1) } });
    await db.reserva.create({
      data: { recursoId: cancha.id, usuarioId: socio.id, inicio: new Date(bloque(1, 11)), fin: new Date(bloque(1, 12)) },
    });
    const avisador = avisadorFalso();

    // Con azar 0 el socio prefiere cancelar
    const movimiento = await moverElClub(cancha.id, avisador, { azar: () => 0, ahora: mananaTemprano() });

    expect(movimiento).toEqual({ tipo: "cancelacion", recursoId: cancha.id, inicio: new Date(bloque(1, 11)) });
    const reservas = await reservasDeLaCancha(cancha.id);
    expect(reservas.map((r) => [r.inicio.toISOString(), r.estado])).toEqual([
      [bloque(1, 10), "CONFIRMADA"],
      [bloque(1, 11), "CANCELADA"],
    ]);
    expect(avisador.reservaCancelada).toHaveBeenCalledWith({ recursoId: cancha.id, inicio: new Date(bloque(1, 11)) });
  });

  it("no mueve las canchas desactivadas", async () => {
    const cancha = await crearCanchaDePrueba({ activo: false });
    const avisador = avisadorFalso();

    expect(await moverElClub(cancha.id, avisador, { ahora: mananaTemprano() })).toBeNull();
    expect(avisador.reservaCreada).not.toHaveBeenCalled();
  });
});

describe("simulador", () => {
  it("si nadie está mirando, no hace nada", async () => {
    const canchasMiradas = vi.fn(() => []);
    const avisador = avisadorFalso();
    const simulador = iniciarSimulador({ canchasMiradas, avisador, esperaMs: [5, 10] });

    await new Promise((listo) => setTimeout(listo, 100));
    simulador.detener();

    expect(canchasMiradas).toHaveBeenCalled(); // sí dio vueltas...
    expect(avisador.reservaCreada).not.toHaveBeenCalled(); // ...pero no movió nada
    expect(avisador.reservaCancelada).not.toHaveBeenCalled();
  });

  it("con alguien mirando una cancha, le llegan avisos sin que ningún jugador reserve", async () => {
    // Un servidor igual al de server.ts, pero con el simulador mucho más rápido.
    // Ojo: la primera vuelta también rellena la semana de las demás canchas activas.
    const { io, avisador, canchasMiradas } = crearTiempoReal();
    const servidorHttp = createServer(crearApp({ avisador }));
    io.attach(servidorHttp);
    await new Promise<void>((listo) => servidorHttp.listen(0, listo));
    const simulador = iniciarSimulador({ canchasMiradas, avisador, esperaMs: [20, 50] });

    const cancha = await crearCanchaDePrueba();
    const conexion: Socket = conectar(`http://localhost:${(servidorHttp.address() as AddressInfo).port}`, {
      transports: ["websocket"],
    });
    const avisos: unknown[] = [];
    const dosAvisos = new Promise<void>((listo) => {
      const anotar = (aviso: unknown) => {
        if (avisos.push(aviso) === 2) listo();
      };
      conexion.on("reserva:creada", anotar);
      conexion.on("reserva:cancelada", anotar);
    });
    await conexion.emitWithAck("canchas:seguir", [cancha.id]);

    // El primer aviso es del relleno de la semana, y el segundo, de un socio que reservó o canceló
    await dosAvisos;
    simulador.detener();
    conexion.disconnect();
    await io.close();

    expect(avisos).toEqual([
      { recursoId: cancha.id, inicio: expect.any(String) },
      { recursoId: cancha.id, inicio: expect.any(String) },
    ]);
  });
});
