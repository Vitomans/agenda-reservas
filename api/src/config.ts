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
  // Clave que comparten la página y la API. Si está, la API solo atiende los pedidos que pasan por la página,
  // que le dice además la IP de cada visitante (ver middlewares/soloDesdeLaWeb.ts). En local no hace falta.
  CLAVE_DE_LA_WEB: z.string().min(32, { error: "Debe tener al menos 32 caracteres" }).optional(),
  // Socios simulados que reservan y cancelan mientras alguien mira la demo (ver simulador.ts).
  // En un club de verdad se apaga con SIMULAR_CLUB=false.
  SIMULAR_CLUB: z.stringbool().default(true),
  // Clave de la API de Brevo para enviar los correos de verdad. Sin ella, los correos solo se anotan en la consola.
  BREVO_API_KEY: z.string().min(1).optional(),
  // Desde qué dirección salen los correos. Brevo pide confirmarla antes de poder usarla.
  CORREO_REMITENTE: z.email().default("reservas@volea.example.com"),
  // Clave de Groq (plan gratis), el servicio de IA con el que conversa el asistente. Sin ella, el asistente no atiende.
  GROQ_API_KEY: z.string().min(1).optional(),
  // Clave de Gemini (plan gratis), con la que el asistente busca en la información del club por significado.
  // Sin ella, busca por palabras.
  GEMINI_API_KEY: z.string().min(1).optional(),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const config = resultado.data;
