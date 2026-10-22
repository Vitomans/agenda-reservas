import { createServer } from "node:http";
import { crearApp } from "./app.ts";
import { indiceDelClub } from "./asistente/conocimiento.ts";
import { MODELO_DE_GROQ, MODELO_DE_VECTORES, modeloDeGroq, modeloDeVectores } from "./asistente/modelos.ts";
import { carteroDeBrevo, carteroDeConsola, conLimiteDiario, MAXIMO_CORREOS_AL_DIA } from "./cartero.ts";
import { config } from "./config.ts";
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

// Con la clave de Groq el asistente conversa; sin ella, responde que no está disponible
const modelo = config.GROQ_API_KEY ? modeloDeGroq(config.GROQ_API_KEY) : null;
// Con la clave de Gemini busca en la información del club por significado; sin ella, por palabras
const vectores = config.GEMINI_API_KEY ? modeloDeVectores(config.GEMINI_API_KEY) : null;
// Se lee el índice al arrancar: si el archivo está roto, la API no parte (y Render deja la versión anterior)
const { pedazos } = indiceDelClub();

const servidorHttp = createServer(crearApp({ avisador, cartero, modelo, modeloDeVectores: vectores }));
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
  console.log(modelo ? `Asistente con Groq (${MODELO_DE_GROQ})` : "Asistente apagado (falta GROQ_API_KEY)");
  console.log(
    `Información del club: ${pedazos.length} secciones, ` +
      (vectores ? `búsqueda por significado con ${MODELO_DE_VECTORES}` : "búsqueda por palabras (falta GEMINI_API_KEY)"),
  );
});
