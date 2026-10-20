import { Server } from "socket.io";
import { z } from "zod";
import { config } from "./config.ts";

// Avisos en vivo con Socket.io. Cuando alguien reserva o cancela, la API avisa a los navegadores
// que están mirando esa cancha, y cada uno vuelve a pedir su grilla. Así nadie tiene que recargar.
//
// Los avisos no llevan datos privados (ni quién reservó): solo dicen qué cancha y qué horario cambió.
// Por eso no piden sesión, y la página se conecta directo a la API (los rewrites de Next.js no sirven
// para conexiones que quedan abiertas).

// Lo que viaja en cada aviso
export type CambioEnVivo = { recursoId: string; inicio: string };

// Eventos que el servidor manda a los navegadores
type EventosDelServidor = {
  "reserva:creada": (cambio: CambioEnVivo) => void;
  "reserva:cancelada": (cambio: CambioEnVivo) => void;
};

// Eventos que los navegadores le mandan al servidor
type EventosDelCliente = {
  // "Avísame de estas canchas". Llega como unknown porque viene de afuera y hay que revisarlo.
  // "listo" es opcional: si el navegador lo manda, se le responde cuando ya quedó en las salas.
  "canchas:seguir": (recursoIds: unknown, listo?: () => void) => void;
};

// Lo que las rutas necesitan para avisar. En los tests se puede usar uno falso.
export type Avisador = {
  reservaCreada(reserva: { recursoId: string; inicio: Date }): void;
  reservaCancelada(reserva: { recursoId: string; inicio: Date }): void;
};

// Avisador que no hace nada: el que usa la app si no se le pasa otro (por ejemplo, en los tests)
export const sinAvisos: Avisador = {
  reservaCreada() {},
  reservaCancelada() {},
};

const esquemaCanchas = z.array(z.uuid()).max(50);

// Cada cancha tiene su "sala": un grupo de conexiones que reciben los mismos avisos
const PREFIJO_SALA = "recurso:";

function salaDeCancha(recursoId: string) {
  return `${PREFIJO_SALA}${recursoId}`;
}

// Crea el servidor de Socket.io. Todavía no escucha: server.ts lo engancha al servidor HTTP con attach().
export function crearTiempoReal() {
  const io = new Server<EventosDelCliente, EventosDelServidor>({
    cors: { origin: config.WEB_URL }, // igual que la API: solo el frontend se puede conectar
  });

  io.on("connection", (socket) => {
    socket.on("canchas:seguir", async (recursoIds, listo) => {
      const resultado = esquemaCanchas.safeParse(recursoIds);
      if (!resultado.success) return; // si llega algo raro, se ignora

      // Sale de las salas de antes y entra a las nuevas (por ejemplo, si el jugador cambió de cancha)
      for (const sala of [...socket.rooms]) {
        if (sala.startsWith(PREFIJO_SALA)) await socket.leave(sala);
      }
      await socket.join(resultado.data.map(salaDeCancha));

      if (typeof listo === "function") listo();
    });
  });

  function avisar(evento: keyof EventosDelServidor, { recursoId, inicio }: { recursoId: string; inicio: Date }) {
    io.to(salaDeCancha(recursoId)).emit(evento, { recursoId, inicio: inicio.toISOString() });
  }

  const avisador: Avisador = {
    reservaCreada: (reserva) => avisar("reserva:creada", reserva),
    reservaCancelada: (reserva) => avisar("reserva:cancelada", reserva),
  };

  // Las canchas que alguien está mirando ahora, repetidas una vez por cada conexión que la mira.
  // La usa el simulador del club (simulador.ts): las canchas con más gente mirando se mueven más.
  function canchasMiradas() {
    const ids: string[] = [];
    for (const [sala, conexiones] of io.of("/").adapter.rooms) {
      if (!sala.startsWith(PREFIJO_SALA)) continue; // cada conexión también tiene una sala propia
      for (let i = 0; i < conexiones.size; i++) ids.push(sala.slice(PREFIJO_SALA.length));
    }
    return ids;
  }

  return { io, avisador, canchasMiradas };
}
