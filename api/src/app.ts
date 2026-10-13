import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.ts";
import { manejarErrores, rutaNoEncontrada } from "./middlewares/errores.ts";
import { crearRutasAdmin } from "./rutas/admin.ts";
import { crearRutasAuth } from "./rutas/auth.ts";
import { crearRutasHorario } from "./rutas/horario.ts";
import { crearRutasRecursos } from "./rutas/recursos.ts";
import { crearRutasReservas } from "./rutas/reservas.ts";
import { type Avisador, sinAvisos } from "./tiempoReal.ts";

// Arma la app de Express sin ponerla a escuchar en un puerto.
// Así los tests la usan directo con Supertest, y server.ts la levanta de verdad.
// "avisador" es lo que usan las rutas para avisar en vivo (ver tiempoReal.ts).
export function crearApp({ avisador = sinAvisos }: { avisador?: Avisador } = {}) {
  const app = express();

  app.use(helmet()); // cabeceras de seguridad
  app.use(cors({ origin: config.WEB_URL, credentials: true })); // solo el frontend puede llamar a la API
  app.use(express.json()); // lee el cuerpo de los pedidos en JSON
  app.use(cookieParser()); // lee las cookies, como la de la sesión

  // Ruta para saber si la API está viva (la usan los servicios de hosting)
  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });

  app.use("/api/auth", crearRutasAuth());
  app.use("/api/horario", crearRutasHorario());
  app.use("/api/recursos", crearRutasRecursos());
  app.use("/api/reservas", crearRutasReservas(avisador));
  app.use("/api/admin", crearRutasAdmin());

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
