import { DateTime } from "luxon";
import { ZONA_HORARIA } from "../servicios/horario.ts";

// Cómo se escriben los datos del club en los textos que lee el modelo (las instrucciones y los resultados
// de las herramientas). Así el modelo los ve siempre igual y los repite igual.

// 16000 → "$16.000"
export const pesos = (monto: number) => `$${monto.toLocaleString("es-CL")}`;

// 19 → "19:00"
export const horaEnPunto = (h: number) => `${String(h).padStart(2, "0")}:00`;

// "2026-10-23" → "viernes 23 de octubre"
export function nombreDelDia(fecha: string) {
  return DateTime.fromISO(fecha, { zone: ZONA_HORARIA }).setLocale("es").toFormat("cccc d 'de' LLLL");
}
