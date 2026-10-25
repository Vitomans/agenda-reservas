import { defineConfig, devices } from "@playwright/test";

// Los tests e2e usan la app completa: la base de datos, la API y la página, como un visitante de verdad.
// Antes de correrlos en local: Docker Desktop abierto ("docker compose up -d") y la base de datos con el seed.

// En GitHub Actions la variable CI vale "true"
const enCI = Boolean(process.env.CI);

// La misma clave para la página y la API, así los tests también prueban que la API solo atienda a la página.
// No es secreta: solo sirve en los computadores donde corren los tests.
const CLAVE_DE_LA_WEB = process.env.CLAVE_DE_LA_WEB ?? "clave-de-la-web-solo-para-los-tests-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  // Corren de a uno: todos reservan en la misma base de datos, y dos tests a la vez podrían elegir la misma hora
  workers: 1,
  // En CI, si alguien deja un test.only por error, el CI falla en vez de saltarse los demás
  forbidOnly: enCI,
  // En CI se reintenta una vez, por si algo tarda más de la cuenta
  retries: enCI ? 1 : 0,
  reporter: enCI ? "github" : "list",
  // En local la página se compila la primera vez que se abre, y eso puede tardar unos segundos
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-CL",
    // La traza (capturas y pasos) sirve para ver qué pasó cuando un test falla
    trace: enCI ? "on-first-retry" : "retain-on-failure",
  },
  // Los mismos tests corren en una pantalla de escritorio y en un celular chico (360 × 740)
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Galaxy S8"] } },
  ],
  // Playwright levanta la API y la página antes de los tests. En CI usa las versiones ya compiladas
  // (los build corren antes); en local, las de desarrollo. Siempre las levanta él (si ya hay una abierta en
  // el mismo puerto, avisa): así corren sin socios simulados y con la clave de la página.
  webServer: [
    {
      // En local, tsx corre la API sin compilarla. Sin "watch": no hace falta reiniciarla con cada cambio
      command: enCI ? "npm start" : "npx tsx src/server.ts",
      cwd: "../api",
      url: "http://localhost:4000/api/salud",
      reuseExistingServer: false,
      // Sin socios simulados: así nadie más reserva mientras corren los tests.
      // El asistente responde con un guion fijo, sin IA: los tests no gastan la cuota ni dependen de internet.
      env: { SIMULAR_CLUB: "false", CLAVE_DE_LA_WEB, ASISTENTE_DE_GUION: "true" },
    },
    {
      command: enCI ? "npm start" : "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      env: { CLAVE_DE_LA_WEB },
    },
  ],
});
