import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.ts";
import { PrismaClient } from "./generated/prisma/client.ts";

// Cliente de Prisma para hablar con PostgreSQL. Se crea una sola vez y lo comparte toda la API.
// El adaptador usa el driver "pg" para conectarse a la base de datos.
const adaptador = new PrismaPg({ connectionString: config.DATABASE_URL });

export const db = new PrismaClient({ adapter: adaptador });
