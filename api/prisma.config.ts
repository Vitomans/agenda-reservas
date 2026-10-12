import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuración de la CLI de Prisma: dónde están el esquema, las migraciones y el seed.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Se lee directo de process.env (y no con env() de Prisma, que falla si no existe)
    // para que "prisma generate" funcione aunque todavía no haya un .env
    url: process.env.DATABASE_URL,
  },
});
