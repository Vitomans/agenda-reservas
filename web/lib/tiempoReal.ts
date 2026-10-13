import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { claves } from "./consultas";
import type { CambioEnVivo } from "./tipos";

// Socket.io se conecta directo a la API: el puente de next.config.ts sirve para los pedidos normales,
// pero no para una conexión que queda abierta. Los avisos no necesitan la cookie de sesión,
// porque solo dicen qué cancha y qué horario cambió.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Los mismos eventos que en api/src/tiempoReal.ts
type EventosDelServidor = {
  "reserva:creada": (cambio: CambioEnVivo) => void;
  "reserva:cancelada": (cambio: CambioEnVivo) => void;
};
type EventosDelCliente = {
  "canchas:seguir": (recursoIds: string[]) => void;
};

// Escucha los avisos en vivo de esas canchas y devuelve si la conexión está activa.
// Cuando alguien reserva o cancela, marca como viejos los datos de esa cancha
// y TanStack Query los vuelve a pedir solo: la grilla se actualiza sin recargar la página.
export function useTiempoReal(recursoIds: string[]) {
  const queryClient = useQueryClient();
  // La conexión se prepara una sola vez, pero se abre recién cuando el componente aparece en pantalla
  const [conexion] = useState<Socket<EventosDelServidor, EventosDelCliente>>(() =>
    io(API_URL, { autoConnect: false }),
  );
  const [conectado, setConectado] = useState(false);

  // En cada render llega una lista nueva, aunque traiga las mismas canchas.
  // El texto solo cambia si cambian las canchas, así el efecto de abajo no se repite por nada.
  const canchas = recursoIds.join(",");

  // 1. Abre la conexión al entrar a la pantalla y la cierra al salir
  useEffect(() => {
    const alConectar = () => setConectado(true);
    const alDesconectar = () => setConectado(false);

    // Marca como viejos los datos de las reservas: los de una cancha, o los de todas si no se dice cuál
    function ponerAlDia(recursoId?: string) {
      queryClient.invalidateQueries({
        queryKey: recursoId ? [...claves.disponibilidad, recursoId] : claves.disponibilidad,
      });
      queryClient.invalidateQueries({ queryKey: claves.misReservas });
      queryClient.invalidateQueries({ queryKey: claves.reservasDelDia });
    }

    const alCambiarUnaReserva = ({ recursoId }: CambioEnVivo) => ponerAlDia(recursoId);
    // Mientras la conexión estuvo cortada pudimos perder avisos: al volver se pide todo de nuevo
    const alReconectar = () => ponerAlDia();

    conexion.on("connect", alConectar);
    conexion.on("disconnect", alDesconectar);
    conexion.on("reserva:creada", alCambiarUnaReserva);
    conexion.on("reserva:cancelada", alCambiarUnaReserva);
    conexion.io.on("reconnect", alReconectar);
    conexion.connect();

    return () => {
      conexion.off("connect", alConectar);
      conexion.off("disconnect", alDesconectar);
      conexion.off("reserva:creada", alCambiarUnaReserva);
      conexion.off("reserva:cancelada", alCambiarUnaReserva);
      conexion.io.off("reconnect", alReconectar);
      conexion.disconnect();
    };
  }, [conexion, queryClient]);

  // 2. Le dice al servidor qué canchas seguir. Se repite al cambiar de cancha y en cada reconexión,
  //    porque el servidor no recuerda las salas de una conexión que se cortó.
  useEffect(() => {
    const ids = canchas ? canchas.split(",") : [];
    const seguir = () => conexion.emit("canchas:seguir", ids);

    if (conexion.connected) seguir();
    conexion.on("connect", seguir);

    return () => {
      conexion.off("connect", seguir);
    };
  }, [conexion, canchas]);

  return conectado;
}
