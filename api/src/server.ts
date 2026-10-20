import { createServer } from "node:http";
import { crearApp } from "./app.ts";
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

const servidorHttp = createServer(crearApp({ avisador, cartero }));
io.attach(servidorHttp);

if (config.SIMULAR_CLUB) {
  iniciarSimulador({ canchasMiradas, avisador });
}

servidorHttp.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
});
