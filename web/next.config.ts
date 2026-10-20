import type { NextConfig } from "next";

// El puente que le pasa a la API lo que la página pide en /api/... está en proxy.ts

const nextConfig: NextConfig = {
  // No generar el archivo AGENTS.md (instrucciones para asistentes de IA) al correr "next dev"
  agentRules: false,
  turbopack: {
    rules: {
      // Procesa los archivos CSS con Tailwind
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
