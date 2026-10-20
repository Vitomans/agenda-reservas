import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import {
  bloque,
  borrarDatosDePrueba,
  crearCanchaDePrueba,
  dia,
  entrarComoAdmin,
  entrarComoJugadorNuevo,
  nombreDeCanchaDePrueba,
} from "./ayudantes.ts";

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

describe("permisos", () => {
  const rutasDeAdmin = [
    { metodo: "get", url: `/api/admin/reservas?fecha=${dia(1)}` },
    { metodo: "get", url: `/api/admin/resumen?fecha=${dia(1)}` },
    { metodo: "get", url: "/api/admin/recursos" },
    { metodo: "post", url: "/api/admin/recursos" },
    { metodo: "patch", url: "/api/admin/recursos/cualquiera" },
  ] as const;

  it("las rutas de admin responden 401 sin sesión", async () => {
    const app = crearApp();

    for (const { metodo, url } of rutasDeAdmin) {
      const respuesta = await request(app)[metodo](url);
      expect(respuesta.status, `${metodo} ${url}`).toBe(401);
    }
  });

  it("las rutas de admin responden 403 a un cliente", async () => {
    const { navegador } = await entrarComoJugadorNuevo(crearApp());

    for (const { metodo, url } of rutasDeAdmin) {
      const respuesta = await navegador[metodo](url).send({ nombre: nombreDeCanchaDePrueba() });
      expect(respuesta.status, `${metodo} ${url}`).toBe(403);
      expect(respuesta.body).toEqual({ error: "No tienes permiso para hacer esto" });
    }
  });

  it("reservar y ver 'mis reservas' son solo para clientes", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const admin = await entrarComoAdmin(app);

    const reservar = await admin.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });
    const mias = await admin.get("/api/reservas/mias");

    expect(reservar.status).toBe(403);
    expect(mias.status).toBe(403);
  });
});

describe("GET /api/admin/reservas", () => {
  it("muestra las reservas del día de todos los clientes, con su estado", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const ana = await entrarComoJugadorNuevo(app);
    const beto = await entrarComoJugadorNuevo(app);
    const admin = await entrarComoAdmin(app);

    await beto.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 12) });
    const cancelada = await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 9) });
    await ana.navegador.delete(`/api/reservas/${cancelada.body.reserva.id}`);
    await ana.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(2, 9) }); // otro día

    const respuesta = await admin.get(`/api/admin/reservas?fecha=${dia(1)}`);

    expect(respuesta.status).toBe(200);
    // Se miran solo las de la cancha de este test, porque puede haber otras reservas ese día
    const deEstaCancha = respuesta.body.reservas.filter((r: { recurso: { id: string } }) => r.recurso.id === cancha.id);
    expect(deEstaCancha).toEqual([
      expect.objectContaining({ inicio: bloque(1, 9), estado: "CANCELADA", usuario: expect.objectContaining({ id: ana.usuario.id }) }),
      expect.objectContaining({ inicio: bloque(1, 12), estado: "CONFIRMADA", usuario: expect.objectContaining({ id: beto.usuario.id }) }),
    ]);
    expect(deEstaCancha[0].usuario).not.toHaveProperty("passwordHash");
  });

  it("permite mirar días pasados, pero pide una fecha válida", async () => {
    const admin = await entrarComoAdmin(crearApp());

    expect((await admin.get(`/api/admin/reservas?fecha=${dia(-30)}`)).status).toBe(200);
    expect((await admin.get("/api/admin/reservas?fecha=ayer")).status).toBe(400);
  });
});

describe("canchas (admin)", () => {
  it("crea una cancha y los clientes la ven", async () => {
    const app = crearApp();
    const admin = await entrarComoAdmin(app);
    const { navegador } = await entrarComoJugadorNuevo(app);
    const nombre = nombreDeCanchaDePrueba();

    const respuesta = await admin.post("/api/admin/recursos").send({ nombre: `  ${nombre} ` });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.recurso).toEqual({ id: expect.any(String), nombre, activo: true });
    const recursos = (await navegador.get("/api/recursos")).body.recursos;
    expect(recursos.map((r: { nombre: string }) => r.nombre)).toContain(nombre);
  });

  it("responde 409 si ya existe una cancha con ese nombre y 400 si falta el nombre", async () => {
    const admin = await entrarComoAdmin(crearApp());

    expect((await admin.post("/api/admin/recursos").send({ nombre: "Cancha 1" })).status).toBe(409);
    expect((await admin.post("/api/admin/recursos").send({ nombre: "   " })).status).toBe(400);
  });

  it("desactiva una cancha: los clientes dejan de verla y no se puede reservar", async () => {
    const app = crearApp();
    const admin = await entrarComoAdmin(app);
    const { navegador } = await entrarComoJugadorNuevo(app);
    const cancha = await crearCanchaDePrueba();

    const respuesta = await admin.patch(`/api/admin/recursos/${cancha.id}`).send({ activo: false });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.recurso.activo).toBe(false);
    const recursos = (await navegador.get("/api/recursos")).body.recursos;
    expect(recursos.map((r: { id: string }) => r.id)).not.toContain(cancha.id);
    const reservar = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) });
    expect(reservar.status).toBe(404);

    // El admin sí la sigue viendo, para poder activarla de nuevo
    const todas = (await admin.get("/api/admin/recursos")).body.recursos;
    expect(todas).toContainEqual({ id: cancha.id, nombre: cancha.nombre, activo: false });
  });

  it("cambia el nombre de una cancha", async () => {
    const admin = await entrarComoAdmin(crearApp());
    const cancha = await crearCanchaDePrueba();
    const nombreNuevo = nombreDeCanchaDePrueba();

    const respuesta = await admin.patch(`/api/admin/recursos/${cancha.id}`).send({ nombre: nombreNuevo });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.recurso).toEqual({ id: cancha.id, nombre: nombreNuevo, activo: true });
  });

  it("responde 404 si la cancha no existe y 409 si el nombre nuevo ya está usado", async () => {
    const admin = await entrarComoAdmin(crearApp());
    const cancha = await crearCanchaDePrueba();

    expect((await admin.patch("/api/admin/recursos/no-existe").send({ activo: false })).status).toBe(404);
    expect((await admin.patch(`/api/admin/recursos/${cancha.id}`).send({ nombre: "Cancha 1" })).status).toBe(409);
  });
});
