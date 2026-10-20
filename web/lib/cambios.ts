import { useEffect, useState } from "react";
import type { Bloque } from "./tipos";

// Cuando la grilla se actualiza en vivo, compara los horarios de antes con los nuevos
// para avisar qué cambió ("Alguien reservó las 19:00") y resaltar esas horas un momento.

export type CambioEnLaGrilla = {
  inicio: string;
  hora: string;
  tipo: "reservada" | "liberada";
};

// Cuánto tiempo se muestra el aviso y se resaltan las horas que cambiaron
export const DURACION_AVISO_MS = 4000;

// Solo cuentan los cambios hechos por otras personas: de libre a ocupada y de ocupada a libre.
// Lo que hace uno mismo (pasa a "Tu reserva" o deja de serlo) y las horas que pasan no se avisan.
export function cambiosEntre(antes: Bloque[], despues: Bloque[]): CambioEnLaGrilla[] {
  const estadoAntes = new Map(antes.map((bloque) => [bloque.inicio, bloque.estado]));

  return despues.flatMap((bloque): CambioEnLaGrilla[] => {
    const anterior = estadoAntes.get(bloque.inicio);
    if (anterior === "libre" && bloque.estado === "ocupado") {
      return [{ inicio: bloque.inicio, hora: bloque.hora, tipo: "reservada" }];
    }
    if (anterior === "ocupado" && bloque.estado === "libre") {
      return [{ inicio: bloque.inicio, hora: bloque.hora, tipo: "liberada" }];
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
    ? `Alguien acaba de reservar las ${cambio.hora}`
    : `Se acaba de liberar la hora de las ${cambio.hora}`;
}

// Devuelve los cambios más recientes de la grilla que se está mirando, y los borra después de unos segundos.
// "clave" identifica qué se mira (la cancha y el día): si cambia, no se compara con lo de antes,
// porque elegir otra cancha no es un cambio en vivo.
export function useCambiosEnVivo(bloques: Bloque[] | undefined, clave: string) {
  const [anterior, setAnterior] = useState({ bloques, clave });
  const [cambios, setCambios] = useState<CambioEnLaGrilla[]>([]);

  // Se compara durante el render, que es como React recomienda reaccionar a un dato que cambió.
  // TanStack Query entrega el mismo arreglo si la API devolvió lo mismo, así que esto solo pasa con datos nuevos.
  if (bloques !== anterior.bloques || clave !== anterior.clave) {
    setAnterior({ bloques, clave });

    if (clave !== anterior.clave) {
      setCambios([]);
    } else if (anterior.bloques && bloques) {
      const nuevos = cambiosEntre(anterior.bloques, bloques);
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
