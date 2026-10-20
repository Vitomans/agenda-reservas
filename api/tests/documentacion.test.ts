import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { borrarDatosDePrueba, dia } from "./ayudantes.ts";

// Probar las rutas crea algún jugador invitado: se borran al final
afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

type Documentacion = { paths: Record<string, Record<string, unknown>> };

describe("documentación de la API", () => {
  it("GET /docs muestra la página de Swagger UI", async () => {
    const app = crearApp();

    const respuesta = await request(app).get("/docs");

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain("Documentación de la API · Volea");
    // Sus archivos se piden con la ruta completa, y existen
    expect(respuesta.text).toContain('href="/docs/swagger-ui.css"');
    expect((await request(app).get("/docs/swagger-ui.css")).status).toBe(200);
    expect((await request(app).get("/docs/swagger-ui-init.js")).text).toContain("API de Volea");
  });

  it("GET /docs/openapi.json entrega el archivo OpenAPI", async () => {
    const respuesta = await request(crearApp()).get("/docs/openapi.json");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.openapi).toBe("3.1.0");
    // Los cuerpos salen de los esquemas de Zod: el registro pide al menos 8 caracteres de contraseña
    const registro = respuesta.body.paths["/api/auth/registro"].post.requestBody.content["application/json"].schema;
    expect(registro.properties.password.minLength).toBe(8);
  });

  it("cada ruta documentada existe en la API", async () => {
    const app = crearApp();
    const { paths } = (await request(app).get("/docs/openapi.json")).body as Documentacion;

    for (const [ruta, metodos] of Object.entries(paths)) {
      for (const metodo of Object.keys(metodos) as ("get" | "post" | "patch" | "delete")[]) {
        // Se llama sin sesión y con datos de mentira: puede responder 400, 401 o 404 "La cancha no existe",
        // pero nunca "Ruta no encontrada"
        const url = `${ruta.replace("{id}", randomUUID())}?fecha=${dia(1)}`;
        const respuesta = await request(app)[metodo](url);

        expect(respuesta.body, `${metodo.toUpperCase()} ${ruta}`).not.toEqual({ error: "Ruta no encontrada" });
      }
    }
  });
});
