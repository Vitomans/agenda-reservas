import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { type Cartero, sinCorreos } from "./cartero.ts";
import { config } from "./config.ts";
import { documentacion } from "./documentacion.ts";
import { manejarErrores, rutaNoEncontrada } from "./middlewares/errores.ts";
import { soloDesdeLaWeb } from "./middlewares/soloDesdeLaWeb.ts";
import { crearRutasAdmin } from "./rutas/admin.ts";
import { crearRutasAuth } from "./rutas/auth.ts";
import { crearRutasHorario } from "./rutas/horario.ts";
import { crearRutasDisponibilidad, crearRutasRecursos } from "./rutas/recursos.ts";
import { crearRutasReservas } from "./rutas/reservas.ts";
import { type Avisador, sinAvisos } from "./tiempoReal.ts";

// Arma la app de Express sin ponerla a escuchar en un puerto.
// Así los tests la usan directo con Supertest, y server.ts la levanta de verdad.
// "avisador" es lo que usan las rutas para avisar en vivo (ver tiempoReal.ts),
// y "cartero", lo que usan para enviar los correos (ver cartero.ts).
// "claveDeLaWeb" hace que la API atienda solo los pedidos que pasan por la página (ver soloDesdeLaWeb.ts).
export function crearApp({
  avisador = sinAvisos,
  cartero = sinCorreos,
  claveDeLaWeb = config.CLAVE_DE_LA_WEB,
}: { avisador?: Avisador; cartero?: Cartero; claveDeLaWeb?: string } = {}) {
  const app = express();

  app.use(helmet()); // cabeceras de seguridad
  app.use(cors({ origin: config.WEB_URL, credentials: true })); // solo el frontend puede llamar a la API
  app.use(express.json()); // lee el cuerpo de los pedidos en JSON
  app.use(cookieParser()); // lee las cookies, como la de la sesión

  // Ruta para saber si la API está viva (la usan los servicios de hosting)
  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });

  // La documentación de la API: una página para leer y probar cada ruta (Swagger UI) y el archivo OpenAPI
  app.get("/docs/openapi.json", (_req, res) => {
    res.json(documentacion);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(documentacion, {
      customSiteTitle: "Documentación de la API · Volea",
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );

  // Desde aquí, todo lo de /api pide la clave de la página (si está configurada)
  app.use("/api", soloDesdeLaWeb(claveDeLaWeb));

  app.use("/api/auth", crearRutasAuth());
  app.use("/api/horario", crearRutasHorario());
  app.use("/api/recursos", crearRutasRecursos());
  app.use("/api/disponibilidad", crearRutasDisponibilidad());
  app.use("/api/reservas", crearRutasReservas(avisador, cartero));
  app.use("/api/admin", crearRutasAdmin());

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
