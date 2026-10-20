import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { type Cartero, sinCorreos } from "./cartero.ts";
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
// "avisador" es lo que usan las rutas para avisar en vivo (ver tiempoReal.ts),
// y "cartero", lo que usan para enviar los correos (ver cartero.ts).
export function crearApp({
  avisador = sinAvisos,
  cartero = sinCorreos,
  proxiesConfiables = config.PROXIES_CONFIABLES,
}: { avisador?: Avisador; cartero?: Cartero; proxiesConfiables?: number } = {}) {
  const app = express();

  // Cada intermediario anota en la cabecera X-Forwarded-For la IP de quien le habló.
  // Express confía en los últimos "proxiesConfiables" intermediarios y toma como req.ip la IP
  // que anotaron ellos, que es la del visitante (la usa el límite de intentos). El resto de la
  // cabecera se ignora, porque cualquiera la puede escribir a mano.
  app.set("trust proxy", proxiesConfiables);

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
  app.use("/api/reservas", crearRutasReservas(avisador, cartero));
  app.use("/api/admin", crearRutasAdmin());

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
