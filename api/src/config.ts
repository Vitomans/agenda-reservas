import "dotenv/config";
import { z } from "zod";

// Variables de entorno que usa la API. Se revisan una sola vez al arrancar:
// si falta una o tiene un valor raro, la API no parte y dice cuál es.
const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  // Clave con la que se firman los tokens de sesión. Si alguien la conoce, puede falsificar sesiones.
  JWT_SECRET: z.string().min(32, { error: "Debe tener al menos 32 caracteres" }),
  // Cuántos intermediarios (proxies) hay entre el navegador y la API. En local no hay ninguno.
  // Publicada hay varios (Vercel y el balanceador del hosting), y sin este número la API
  // creería que todos los pedidos vienen de la misma IP. Ver crearApp en app.ts.
  PROXIES_CONFIABLES: z.coerce.number().int().min(0).default(0),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const config = resultado.data;
