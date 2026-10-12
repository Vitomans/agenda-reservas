import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.ts";
import { manejarErrores, rutaNoEncontrada } from "./middlewares/errores.ts";

// Arma la app de Express sin ponerla a escuchar en un puerto.
// Así los tests la usan directo con Supertest, y server.ts la levanta de verdad.
export function crearApp() {
  const app = express();

  app.use(helmet()); // cabeceras de seguridad
  app.use(cors({ origin: config.WEB_URL, credentials: true })); // solo el frontend puede llamar a la API
  app.use(express.json()); // lee el cuerpo de los pedidos en JSON

  // Ruta para saber si la API está viva (la usan los servicios de hosting)
  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
