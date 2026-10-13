import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // El mismo atajo que usa Next.js: "@/lib/fechas" apunta a "./lib/fechas"
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    // jsdom simula un navegador para poder probar los componentes sin abrir uno de verdad
    environment: "jsdom",
    setupFiles: ["tests/preparar.ts"],
  },
});
