import { createServer } from "node:http";
import { crearApp } from "./app.ts";
import { config } from "./config.ts";
import { iniciarSimulador } from "./simulador.ts";
import { crearTiempoReal } from "./tiempoReal.ts";

// Un solo servidor HTTP para las dos cosas: Express atiende las rutas /api
// y Socket.io atiende las conexiones en vivo (en /socket.io).
const { io, avisador, canchasMiradas } = crearTiempoReal();
const servidorHttp = createServer(crearApp({ avisador }));
io.attach(servidorHttp);

if (config.SIMULAR_CLUB) {
  iniciarSimulador({ canchasMiradas, avisador });
}

servidorHttp.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
});
