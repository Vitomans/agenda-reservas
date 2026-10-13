import type { NextConfig } from "next";

// Dirección de la API. En local es la que levanta "npm run dev" dentro de api/.
// La misma variable la usa la conexión en vivo (lib/tiempoReal.ts).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  // La página le pasa a la API todo lo que pide en /api/... (funciona como un puente).
  // Así el navegador cree que la API está en el mismo sitio que la página: no hay problemas
  // de CORS y la cookie de sesión es "propia", así que ningún navegador la bloquea.
  async rewrites() {
    return [{ source: "/api/:ruta*", destination: `${API_URL}/api/:ruta*` }];
  },
};

export default nextConfig;
