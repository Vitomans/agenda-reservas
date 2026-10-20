import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { CABECERA_CLAVE, CABECERA_IP } from "../src/middlewares/soloDesdeLaWeb.ts";
import { borrarDatosDePrueba, emailNuevo } from "./ayudantes.ts";

// En la demo publicada la API solo atiende los pedidos que pasan por la página (web/proxy.ts),
// que les agrega la clave compartida y la IP del visitante.

const CLAVE = "clave-de-la-web-solo-para-estos-tests-0123456789";

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

// Un intento de login con una contraseña mala, como si llegara por la página desde esa IP
const intentarDesde = (app: ReturnType<typeof crearApp>, ip: string, clave = CLAVE) =>
  request(app)
    .post("/api/auth/login")
    .set(CABECERA_CLAVE, clave)
    .set(CABECERA_IP, ip)
    .send({ email: emailNuevo(), password: "x" });

describe("con la clave de la página (como en la demo publicada)", () => {
  it("responde 403 a los pedidos que no traen la clave o traen otra", async () => {
    const app = crearApp({ claveDeLaWeb: CLAVE });

    const sinClave = await request(app).get("/api/recursos");
    const conOtraClave = await request(app).get("/api/recursos").set(CABECERA_CLAVE, "otra-clave");

    for (const respuesta of [sinClave, conOtraClave]) {
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error).toMatch(/solo atiende los pedidos que llegan desde la página/);
    }
  });

  it("atiende los pedidos que traen la clave", async () => {
    const app = crearApp({ claveDeLaWeb: CLAVE });

    const respuesta = await request(app).get("/api/recursos").set(CABECERA_CLAVE, CLAVE);

    expect(respuesta.status).toBe(200);
  });

  it("/api/salud y la documentación no piden la clave", async () => {
    const app = crearApp({ claveDeLaWeb: CLAVE });

    expect((await request(app).get("/api/salud")).status).toBe(200);
    expect((await request(app).get("/docs/openapi.json")).status).toBe(200);
  });

  it("cuenta los intentos del login por la IP que manda la página", async () => {
    const app = crearApp({ claveDeLaWeb: CLAVE });

    for (let i = 0; i < 20; i++) {
      expect((await intentarDesde(app, "203.0.113.1")).status).toBe(401);
    }

    expect((await intentarDesde(app, "203.0.113.1")).status).toBe(429);
    // Otra persona que también llega por la página todavía puede intentar
    expect((await intentarDesde(app, "203.0.113.2")).status).toBe(401);
  });
});

describe("sin la clave (en local)", () => {
  it("escribir la cabecera de la IP a mano no sirve para saltarse el límite", async () => {
    const app = crearApp({ claveDeLaWeb: undefined });
    const intentar = (ip: string) =>
      request(app).post("/api/auth/login").set(CABECERA_IP, ip).send({ email: emailNuevo(), password: "x" });

    for (let i = 0; i < 20; i++) {
      expect((await intentar(`203.0.113.${i}`)).status).toBe(401);
    }

    // Sin la clave, la API no le cree a esa cabecera: todos los intentos vienen de la misma conexión
    expect((await intentar("203.0.113.99")).status).toBe(429);
  });
});
