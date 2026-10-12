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
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const config = resultado.data;
