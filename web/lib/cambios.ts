import { useEffect, useState } from "react";
import type { Casilla } from "./casillas";

// Cuando la grilla se actualiza en vivo, compara las casillas de antes con las nuevas
// para avisar qué cambió ("Alguien acaba de reservar la Cancha 2 a las 19:00") y resaltar esas horas un momento.

export type CambioEnLaGrilla = {
  inicio: string;
  hora: string;
  cancha: string; // el nombre de la cancha
  tipo: "reservada" | "liberada";
};

// Cuánto tiempo se muestra el aviso y se resaltan las horas que cambiaron
export const DURACION_AVISO_MS = 4000;

// Cada casilla se reconoce por su cancha y su hora de inicio
const claveDe = (casilla: Casilla) => `${casilla.cancha.id}|${casilla.inicio}`;

// Solo cuentan los cambios hechos por otras personas: de libre a ocupada y de ocupada a libre.
// Lo que hace uno mismo (pasa a "Tu reserva" o deja de serlo) y las horas que pasan no se avisan.
export function cambiosEntre(antes: Casilla[], despues: Casilla[]): CambioEnLaGrilla[] {
  const estadoAntes = new Map(antes.map((casilla) => [claveDe(casilla), casilla.estado]));

  return despues.flatMap((casilla): CambioEnLaGrilla[] => {
    const anterior = estadoAntes.get(claveDe(casilla));
    const cambio = { inicio: casilla.inicio, hora: casilla.hora, cancha: casilla.cancha.nombre };
    if (anterior === "libre" && casilla.estado === "ocupado") {
      return [{ ...cambio, tipo: "reservada" }];
    }
    if (anterior === "ocupado" && casilla.estado === "libre") {
      return [{ ...cambio, tipo: "liberada" }];
    }
    return [];
  });
}

// El texto del aviso. Si cambiaron varias horas a la vez, se dice cuántas.
export function textoDelCambio(cambios: CambioEnLaGrilla[]) {
  if (cambios.length === 0) return null;
  if (cambios.length > 1) return `Se actualizaron ${cambios.length} horarios`;

  const [cambio] = cambios;
  return cambio.tipo === "reservada"
    ? `Alguien acaba de reservar la ${cambio.cancha} a las ${cambio.hora}`
    : `Se acaba de liberar la ${cambio.cancha} a las ${cambio.hora}`;
}

// Devuelve los cambios más recientes de lo que se está mirando, y los borra después de unos segundos.
// "clave" identifica qué se mira (la vista, la cancha y el día): si cambia, no se compara con lo de antes,
// porque elegir otra cancha no es un cambio en vivo.
// Ojo: "casillas" tiene que ser el mismo arreglo mientras los datos no cambien (por ejemplo, con useMemo).
export function useCambiosEnVivo(casillas: Casilla[] | undefined, clave: string) {
  const [anterior, setAnterior] = useState({ casillas, clave });
  const [cambios, setCambios] = useState<CambioEnLaGrilla[]>([]);

  // Se compara durante el render, que es como React recomienda reaccionar a un dato que cambió.
  // TanStack Query entrega el mismo arreglo si la API devolvió lo mismo, así que esto solo pasa con datos nuevos.
  if (casillas !== anterior.casillas || clave !== anterior.clave) {
    setAnterior({ casillas, clave });

    if (clave !== anterior.clave) {
      setCambios([]);
    } else if (anterior.casillas && casillas) {
      const nuevos = cambiosEntre(anterior.casillas, casillas);
      if (nuevos.length > 0) setCambios(nuevos);
    }
  }

  useEffect(() => {
    if (cambios.length === 0) return;
    const temporizador = setTimeout(() => setCambios([]), DURACION_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [cambios]);

  return cambios;
}
