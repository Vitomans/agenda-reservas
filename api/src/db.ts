import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.ts";
import { Prisma, PrismaClient } from "./generated/prisma/client.ts";

// Cliente de Prisma para hablar con PostgreSQL. Se crea una sola vez y lo comparte toda la API.
// El adaptador usa el driver "pg" para conectarse a la base de datos.
const adaptador = new PrismaPg({ connectionString: config.DATABASE_URL });

export const db = new PrismaClient({ adapter: adaptador });

// Códigos de error de Prisma que la API convierte en respuestas para el cliente:
// P2002 = se repitió un valor que debe ser único (un email, el nombre de una cancha, un horario)
// P2025 = no se encontró el registro que se quería modificar
export function esErrorDePrisma(error: unknown, codigo: "P2002" | "P2025") {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === codigo;
}
