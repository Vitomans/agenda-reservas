import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Todos los archivos de tests usan la misma base de datos, así que corren de a uno:
    // si corrieran a la vez, la limpieza de un archivo podría borrar datos que otro está usando.
    fileParallelism: false,
  },
});
