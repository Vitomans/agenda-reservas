import "dotenv/config";
import { z } from "zod";

// Variables de entorno que usa la API. Se revisan una sola vez al arrancar:
// si falta una o tiene un valor raro, la API no parte y dice cuál es.
const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const config = resultado.data;
