import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { dia } from "./ayudantes.ts";

describe("GET /api/salud", () => {
  it("responde que la API está funcionando", async () => {
    const respuesta = await request(crearApp()).get("/api/salud");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });
});

describe("rutas que no existen", () => {
  it("responden 404 con un mensaje en JSON", async () => {
    const respuesta = await request(crearApp()).get("/api/no-existe");

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: "Ruta no encontrada" });
  });
});

describe("pedidos con un JSON mal escrito", () => {
  it("responden 400 en vez de un error interno", async () => {
    const respuesta = await request(crearApp())
      .post("/api/salud")
      .set("Content-Type", "application/json")
      .send("{ esto no es json");

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: "El cuerpo del pedido no es un JSON válido" });
  });
});

describe("GET /api/horario", () => {
  it("dice la zona horaria del club y los 7 días que se pueden reservar, desde hoy", async () => {
    const respuesta = await request(crearApp()).get("/api/horario");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      zonaHoraria: "America/Santiago",
      horaApertura: 8,
      horaCierre: 23,
      dias: [0, 1, 2, 3, 4, 5, 6].map((n) => dia(n)),
    });
  });
});
