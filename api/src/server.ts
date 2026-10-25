import { createServer } from "node:http";
import { crearApp } from "./app.ts";
import { indiceDelClub } from "./asistente/conocimiento.ts";
import { modeloDeGuion } from "./asistente/guion.ts";
import { MODELO_DE_VECTORES, modeloDeVectores, modelosParaConversar } from "./asistente/modelos.ts";
import { carteroDeBrevo, carteroDeConsola, conLimiteDiario, MAXIMO_CORREOS_AL_DIA } from "./cartero.ts";
import { config } from "./config.ts";
import { meteorologoDeEjemplo, meteorologoDeMetNorway } from "./meteorologo.ts";
import { iniciarSimulador } from "./simulador.ts";
import { crearTiempoReal } from "./tiempoReal.ts";

// Un solo servidor HTTP para las dos cosas: Express atiende las rutas /api
// y Socket.io atiende las conexiones en vivo (en /socket.io).
const { io, avisador, canchasMiradas } = crearTiempoReal();

// Con la clave de Brevo los correos se envían de verdad; sin ella (por ejemplo, en local) solo se anotan en la consola
const cartero = conLimiteDiario(
  config.BREVO_API_KEY
    ? carteroDeBrevo({ apiKey: config.BREVO_API_KEY, remitente: { email: config.CORREO_REMITENTE, nombre: "Club Volea" } })
    : carteroDeConsola(),
  MAXIMO_CORREOS_AL_DIA,
);

// Con las claves de Groq y Gemini el asistente conversa (con los modelos de Groq y, de último respaldo, Gemini);
// sin ninguna, responde que no está disponible. En los tests e2e responde con un guion fijo, sin IA.
const deGuion = config.ASISTENTE_DE_GUION;
const modelos = deGuion
  ? [modeloDeGuion()]
  : modelosParaConversar({ groq: config.GROQ_API_KEY, gemini: config.GEMINI_API_KEY });
// Con la clave de Gemini busca en la información del club por significado; sin ella (o con el guion), por palabras
const vectores = config.GEMINI_API_KEY && !deGuion ? modeloDeVectores(config.GEMINI_API_KEY) : null;
// Se lee el índice al arrancar: si el archivo está roto, la API no parte (y Render deja la versión anterior)
const { pedazos } = indiceDelClub();

// El pronóstico del tiempo se le pide a MET Norway (gratis y sin clave). En los tests e2e, uno inventado.
const meteorologo = config.PRONOSTICO_DE_EJEMPLO ? meteorologoDeEjemplo() : meteorologoDeMetNorway();

const servidorHttp = createServer(crearApp({ avisador, cartero, modelos, modeloDeVectores: vectores, meteorologo }));
io.attach(servidorHttp);

if (config.SIMULAR_CLUB) {
  iniciarSimulador({ canchasMiradas, avisador });
}

servidorHttp.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
  // Así se ve en el log de Render si los correos salen de verdad, sin mostrar la clave
  console.log(
    config.BREVO_API_KEY
      ? `Correos con Brevo, desde ${config.CORREO_REMITENTE}`
      : "Correos solo en la consola (falta BREVO_API_KEY)",
  );
  console.log(
    deGuion
      ? "Asistente de guion: responde siempre igual, sin IA (ASISTENTE_DE_GUION, solo para los tests e2e)"
      : modelos.length > 0
        ? `Asistente con ${modelos.map((modelo) => modelo.modelId).join(", ")} (en ese orden)`
        : "Asistente apagado (faltan GROQ_API_KEY y GEMINI_API_KEY)",
  );
  console.log(
    `Información del club: ${pedazos.length} secciones, ` +
      (vectores
        ? `búsqueda por significado con ${MODELO_DE_VECTORES}`
        : `búsqueda por palabras (${deGuion ? "asistente de guion" : "falta GEMINI_API_KEY"})`),
  );
  console.log(
    config.PRONOSTICO_DE_EJEMPLO
      ? "Pronóstico del tiempo de ejemplo: inventado, sin internet (PRONOSTICO_DE_EJEMPLO, solo para los tests e2e)"
      : "Pronóstico del tiempo de MET Norway (api.met.no)",
  );
});
