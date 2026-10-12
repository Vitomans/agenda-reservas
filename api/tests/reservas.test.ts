import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { HORA_APERTURA, HORA_CIERRE } from "../src/servicios/horario.ts";
import {
  bloque,
  borrarDatosDePrueba,
  crearCanchaDePrueba,
  dia,
  entrarComoAdmin,
  entrarComoJugadorNuevo,
} from "./ayudantes.ts";

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

describe("GET /api/recursos", () => {
  it("responde 401 si no hay sesión", async () => {
    const respuesta = await request(crearApp()).get("/api/recursos");

    expect(respuesta.status).toBe(401);
  });

  it("lista las canchas activas y no las desactivadas", async () => {
    const app = crearApp();
    const { navegador } = await entrarComoJugadorNuevo(app);
    const desactivada = await crearCanchaDePrueba({ activo: false });

    const respuesta = await navegador.get("/api/recursos");

    expect(respuesta.status).toBe(200);
    const nombres = respuesta.body.recursos.map((recurso: { nombre: string }) => recurso.nombre);
    expect(nombres).toEqual(expect.arrayContaining(["Cancha 1", "Cancha 2", "Cancha 3", "Cancha 4"]));
    expect(nombres).not.toContain(desactivada.nombre);
  });
});

describe("GET /api/recursos/:id/disponibilidad", () => {
  it("devuelve los bloques del día marcando los libres, los ocupados y los míos", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 11) });

    const respuesta = await ana.navegador.get(`/api/recursos/${cancha.id}/disponibilidad?fecha=${dia(1)}`);

    expect(respuesta.status).toBe(200);
    const { bloques } = respuesta.body;
    expect(bloques).toHaveLength(HORA_CIERRE - HORA_APERTURA);
    expect(bloques[0].hora).toBe("08:00");
    expect(bloques.at(-1).hora).toBe("22:00");

    const estadoDe = (hora: string) => bloques.find((b: { hora: string }) => b.hora === hora).estado;
    expect(estadoDe("09:00")).toBe("libre");
    expect(estadoDe("10:00")).toBe("mio");
    expect(estadoDe("11:00")).toBe("ocupado");
  });

  it("marca como pasados los bloques de hoy que ya empezaron", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    const respuesta = await navegador.get(`/api/recursos/${cancha.id}/disponibilidad?fecha=${dia(0)}`);

    expect(respuesta.status).toBe(200);
    const ahora = new Date();
    for (const b of respuesta.body.bloques) {
      expect(b.estado).toBe(new Date(b.inicio) <= ahora ? "pasado" : "libre");
    }
  });

  it("responde 400 si la fecha falta, está mal escrita o queda fuera de los próximos 7 días", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);
    const url = `/api/recursos/${cancha.id}/disponibilidad`;

    for (const consulta of ["", "?fecha=13-10-2026", `?fecha=${dia(-1)}`, `?fecha=${dia(7)}`]) {
      expect((await navegador.get(url + consulta)).status).toBe(400);
    }
  });

  it("responde 404 si la cancha no existe o está desactivada", async () => {
    const app = crearApp();
    const desactivada = await crearCanchaDePrueba({ activo: false });
    const { navegador } = await entrarComoJugadorNuevo(app);

    for (const id of ["no-existe", desactivada.id]) {
      const respuesta = await navegador.get(`/api/recursos/${id}/disponibilidad?fecha=${dia(1)}`);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({ error: "La cancha no existe" });
    }
  });
});

describe("POST /api/reservas", () => {
  it("reserva un bloque libre de 1 hora", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.reserva).toMatchObject({
      inicio: bloque(1, 10),
      fin: bloque(1, 11),
      estado: "CONFIRMADA",
      recurso: { id: cancha.id, nombre: cancha.nombre },
    });
  });

  it("responde 401 si no hay sesión", async () => {
    const cancha = await crearCanchaDePrueba();

    const respuesta = await request(crearApp())
      .post("/api/reservas")
      .send({ recursoId: cancha.id, inicio: bloque(1, 10) });

    expect(respuesta.status).toBe(401);
  });

  it("responde 409 si el horario ya está ocupado", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });

    const respuesta = await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: "Ese horario ya está reservado" });
  });

  it("si dos personas reservan el mismo bloque al mismo tiempo, solo una lo consigue", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const pedido = { recursoId: cancha.id, inicio: bloque(2, 18) };

    // Los dos pedidos salen juntos, sin esperar uno al otro
    const respuestas = await Promise.all([
      ana.navegador.post("/api/reservas").send(pedido),
      beto.navegador.post("/api/reservas").send(pedido),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.reserva.count({ where: { recursoId: cancha.id, estado: "CONFIRMADA" } })).toBe(1);
  });

  it("no deja reservar en el pasado", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(-1, 10) });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: "No se puede reservar en el pasado" });
  });

  it("solo acepta bloques a la hora en punto dentro del horario del club", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    for (const inicio of [bloque(1, 10, 30), bloque(1, HORA_APERTURA - 1), bloque(1, HORA_CIERRE)]) {
      const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio });
      expect(respuesta.status).toBe(400);
    }
  });

  it("no deja reservar más allá de los próximos 7 días", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(7, 10) });

    expect(respuesta.status).toBe(400);
  });

  it("responde 400 si faltan datos", async () => {
    const { navegador } = await entrarComoJugadorNuevo(crearApp());

    const respuesta = await navegador.post("/api/reservas").send({});

    expect(respuesta.status).toBe(400);
    expect(Object.keys(respuesta.body.detalles).sort()).toEqual(["inicio", "recursoId"]);
  });

  it("permite como máximo 2 reservas activas por persona, aunque las pida todas a la vez", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    const respuestas = await Promise.all(
      [10, 11, 12].map((hora) => navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, hora) })),
    );

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 201, 409]);
    const rechazada = respuestas.find((r) => r.status === 409)!;
    expect(rechazada.body.error).toMatch(/Ya tienes 2 reservas activas/);
  });
});

describe("GET /api/reservas/mias", () => {
  it("devuelve mis próximas reservas ordenadas, sin las de otros ni las canceladas", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);

    const tarde = await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(3, 20) });
    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(3, 9) });
    await ana.navegador.delete(`/api/reservas/${tarde.body.reserva.id}`);
    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 9) });
    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(2, 9) });

    const respuesta = await ana.navegador.get("/api/reservas/mias");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.reservas.map((r: { inicio: string }) => r.inicio)).toEqual([bloque(1, 9), bloque(3, 9)]);
  });
});

describe("DELETE /api/reservas/:id", () => {
  it("el dueño la cancela y el horario vuelve a quedar libre para otra persona", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const pedido = { recursoId: cancha.id, inicio: bloque(1, 15) };
    const creada = await ana.navegador.post("/api/reservas").send(pedido);

    const respuesta = await ana.navegador.delete(`/api/reservas/${creada.body.reserva.id}`);

    expect(respuesta.status).toBe(204);
    expect((await beto.navegador.post("/api/reservas").send(pedido)).status).toBe(201);
  });

  it("otro cliente no la puede cancelar (403)", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const creada = await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 15) });

    const respuesta = await beto.navegador.delete(`/api/reservas/${creada.body.reserva.id}`);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: "Solo puedes cancelar tus propias reservas" });
  });

  it("un admin puede cancelar la reserva de cualquiera", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const admin = await entrarComoAdmin(app);
    const creada = await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 15) });

    const respuesta = await admin.delete(`/api/reservas/${creada.body.reserva.id}`);

    expect(respuesta.status).toBe(204);
  });

  it("responde 409 si ya estaba cancelada y 404 si no existe", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);
    const creada = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 15) });
    await navegador.delete(`/api/reservas/${creada.body.reserva.id}`);

    expect((await navegador.delete(`/api/reservas/${creada.body.reserva.id}`)).status).toBe(409);
    expect((await navegador.delete("/api/reservas/no-existe")).status).toBe(404);
  });

  it("no deja cancelar una reserva que ya empezó", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const { navegador, usuario } = await entrarComoJugadorNuevo(app);
    // Se crea directo en la base de datos, porque por la API no se puede reservar en el pasado
    const pasada = await db.reserva.create({
      data: { recursoId: cancha.id, usuarioId: usuario.id, inicio: bloque(-1, 10), fin: bloque(-1, 11) },
    });

    const respuesta = await navegador.delete(`/api/reservas/${pasada.id}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: "No se puede cancelar una reserva que ya empezó" });
  });
});
