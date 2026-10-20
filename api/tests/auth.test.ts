import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import {
  bloque,
  borrarDatosDePrueba,
  cookieDeSesion,
  crearCanchaDePrueba,
  emailNuevo,
  entrarComoJugadorNuevo,
} from "./ayudantes.ts";

// Estos tests usan la base de datos de verdad (la de Docker en local y la del CI)
// y los usuarios demo del seed.

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

describe("POST /api/auth/registro", () => {
  it("crea la cuenta como cliente y deja la sesión iniciada", async () => {
    // Un "agent" guarda las cookies entre pedidos, como lo haría el navegador
    const navegador = request.agent(crearApp());
    const email = emailNuevo();

    const respuesta = await navegador
      .post("/api/auth/registro")
      .send({ nombre: "  Ana Pérez ", email: email.toUpperCase(), password: "clave-segura" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario).toEqual({
      id: expect.any(String),
      nombre: "Ana Pérez",
      email, // se guardó en minúsculas
      rol: "CLIENTE",
    });
    expect(respuesta.body.usuario).not.toHaveProperty("passwordHash");

    const cookie = cookieDeSesion(respuesta);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const yo = await navegador.get("/api/auth/yo");
    expect(yo.status).toBe(200);
    expect(yo.body.usuario.email).toBe(email);
  });

  it("no deja registrarse como admin aunque se mande el rol", async () => {
    const respuesta = await request(crearApp())
      .post("/api/auth/registro")
      .send({ nombre: "Intruso", email: emailNuevo(), password: "clave-segura", rol: "ADMIN" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario.rol).toBe("CLIENTE");
  });

  it("responde 409 si el email ya tiene cuenta, aunque cambien las mayúsculas", async () => {
    const respuesta = await request(crearApp())
      .post("/api/auth/registro")
      .send({ nombre: "Otra persona", email: "Cliente@Example.com", password: "clave-segura" });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: "Ya existe una cuenta con ese email" });
  });

  it("responde 400 y dice qué campos están mal", async () => {
    const respuesta = await request(crearApp())
      .post("/api/auth/registro")
      .send({ nombre: "A", email: "no-es-un-email", password: "corta" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe("Datos inválidos");
    expect(Object.keys(respuesta.body.detalles).sort()).toEqual(["email", "nombre", "password"]);
  });
});

describe("POST /api/auth/login", () => {
  it("con los datos correctos devuelve el usuario y deja la cookie de sesión", async () => {
    const respuesta = await request(crearApp())
      .post("/api/auth/login")
      .send({ email: "cliente@example.com", password: "demo1234" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario).toMatchObject({ email: "cliente@example.com", rol: "CLIENTE" });
    expect(respuesta.body.usuario).not.toHaveProperty("passwordHash");
    expect(cookieDeSesion(respuesta)).toContain("HttpOnly");
  });

  it("responde lo mismo si la contraseña está mal o si el email no existe", async () => {
    const app = crearApp();
    const malaPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@example.com", password: "otra-clave" });
    const emailInexistente = await request(app)
      .post("/api/auth/login")
      .send({ email: emailNuevo(), password: "demo1234" });

    for (const respuesta of [malaPassword, emailInexistente]) {
      expect(respuesta.status).toBe(401);
      expect(respuesta.body).toEqual({ error: "Email o contraseña incorrectos" });
      expect(cookieDeSesion(respuesta)).toBeUndefined();
    }
  });

  it("después de 20 intentos responde 429 (demasiados intentos)", async () => {
    const app = crearApp();
    const intentar = () => request(app).post("/api/auth/login").send({ email: emailNuevo(), password: "x" });

    for (let i = 0; i < 20; i++) {
      expect((await intentar()).status).toBe(401);
    }

    const respuesta = await intentar();
    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error).toMatch(/Demasiados intentos/);
  });
});

describe("POST /api/auth/invitado", () => {
  it("crea un jugador invitado nuevo y deja la sesión iniciada", async () => {
    const navegador = request.agent(crearApp());

    const respuesta = await navegador.post("/api/auth/invitado");

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario).toEqual({
      id: expect.any(String),
      nombre: expect.stringMatching(/^Invitado [0-9A-F]{4}$/),
      email: expect.stringMatching(/@invitados\.example\.com$/),
      rol: "CLIENTE",
    });
    expect((await navegador.get("/api/auth/yo")).body.usuario.id).toBe(respuesta.body.usuario.id);
  });

  it("cada visitante recibe su propio jugador", async () => {
    const app = crearApp();

    const [primero, segundo] = await Promise.all([
      request(app).post("/api/auth/invitado"),
      request(app).post("/api/auth/invitado"),
    ]);

    expect(primero.body.usuario.id).not.toBe(segundo.body.usuario.id);
  });

  it("al crear uno nuevo, borra los invitados de más de un día con sus reservas", async () => {
    const app = crearApp();
    const haceDosDias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Un invitado viejo con una reserva
    const viejo = (await request(app).post("/api/auth/invitado")).body.usuario;
    const cancha = await crearCanchaDePrueba();
    await db.reserva.create({
      data: { recursoId: cancha.id, usuarioId: viejo.id, inicio: bloque(1, 10), fin: bloque(1, 11), precio: 12_000 },
    });
    await db.usuario.update({ where: { id: viejo.id }, data: { creadoEn: haceDosDias } });

    // Un jugador registrado igual de antiguo, y un invitado reciente: ninguno de los dos se borra
    const { usuario: registrado } = await entrarComoJugadorNuevo(app);
    await db.usuario.update({ where: { id: registrado.id }, data: { creadoEn: haceDosDias } });
    const reciente = (await request(app).post("/api/auth/invitado")).body.usuario;

    await request(app).post("/api/auth/invitado");

    expect(await db.usuario.findUnique({ where: { id: viejo.id } })).toBeNull();
    expect(await db.reserva.count({ where: { usuarioId: viejo.id } })).toBe(0);
    expect(await db.usuario.findUnique({ where: { id: registrado.id } })).not.toBeNull();
    expect(await db.usuario.findUnique({ where: { id: reciente.id } })).not.toBeNull();
  });
});

describe("GET /api/auth/yo", () => {
  it("sin sesión responde 200 con usuario null (no es un error)", async () => {
    const respuesta = await request(crearApp()).get("/api/auth/yo");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ usuario: null });
    expect(cookieDeSesion(respuesta)).toBeUndefined();
  });

  it("no reconoce un token editado para hacerse admin, y borra esa cookie", async () => {
    const app = crearApp();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@example.com", password: "demo1234" });

    // Un JWT tiene 3 partes separadas por puntos: cabecera, datos y firma.
    // Se cambian los datos (rol CLIENTE → ADMIN) y se deja la firma original.
    const token = cookieDeSesion(login)?.split(";")[0].replace("sesion=", "") ?? "";
    const [cabecera, datos, firma] = token.split(".");
    const datosEditados = { ...JSON.parse(Buffer.from(datos, "base64url").toString()), rol: "ADMIN" };
    const tokenFalso = [cabecera, Buffer.from(JSON.stringify(datosEditados)).toString("base64url"), firma].join(".");

    const respuesta = await request(app).get("/api/auth/yo").set("Cookie", `sesion=${tokenFalso}`);

    // La firma ya no coincide con los datos, así que el token no sirve
    expect(respuesta.body).toEqual({ usuario: null });
    expect(cookieDeSesion(respuesta)).toContain("Expires=Thu, 01 Jan 1970");
  });
});

describe("POST /api/auth/logout", () => {
  it("borra la cookie y la sesión deja de servir", async () => {
    const navegador = request.agent(crearApp());
    await navegador.post("/api/auth/login").send({ email: "admin@example.com", password: "demo1234" });
    expect((await navegador.get("/api/auth/yo")).body.usuario.rol).toBe("ADMIN");

    const respuesta = await navegador.post("/api/auth/logout");

    expect(respuesta.status).toBe(204);
    expect(cookieDeSesion(respuesta)).toContain("Expires=Thu, 01 Jan 1970");
    expect((await navegador.get("/api/auth/yo")).body).toEqual({ usuario: null });
  });
});
