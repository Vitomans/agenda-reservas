import { DateTime } from "luxon";
import { ZONA_HORARIA } from "./horario.ts";

// Tarifas del club, en pesos chilenos por una hora de cancha. Son iguales para todas las canchas.
// La hora punta es cuando más gente quiere jugar: de lunes a viernes desde las 18:00, y todo el fin de semana.
// En un club de verdad el dueño las cambiaría desde el panel; en este demo están fijas en el código.
export const TARIFA = {
  precioNormal: 12_000,
  precioPunta: 16_000,
  inicioPuntaEntreSemana: 18,
} as const;

export function esHoraPunta(inicio: Date) {
  const local = DateTime.fromJSDate(inicio, { zone: ZONA_HORARIA });
  const finDeSemana = local.weekday >= 6; // 6 = sábado, 7 = domingo
  return finDeSemana || local.hour >= TARIFA.inicioPuntaEntreSemana;
}

// Lo que cuesta reservar el bloque que empieza a esa hora
export function precioDelBloque(inicio: Date) {
  return esHoraPunta(inicio) ? TARIFA.precioPunta : TARIFA.precioNormal;
}
