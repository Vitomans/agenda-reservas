import { DateTime } from "luxon";
import { z } from "zod";
import { ZONA_HORARIA } from "../servicios/horario.ts";

// Cómo se escriben los datos del club en los textos que lee el modelo (las instrucciones y los resultados
// de las herramientas). Así el modelo los ve siempre igual y los repite igual.

// 16000 → "$16.000"
export const pesos = (monto: number) => `$${monto.toLocaleString("es-CL")}`;

// 19 → "19:00"
export const horaEnPunto = (h: number) => `${String(h).padStart(2, "0")}:00`;

// Cómo escribe el modelo un día cuando pide una herramienta: "2026-10-23".
// Solo se revisa la forma. z.iso.date() también revisa que el día exista, pero para eso le agrega al pedido una regla
// larguísima (por los años bisiestos): con Groq se midieron unos 120 tokens más en cada pedido a la IA, por cada
// herramienta que la usa.
// No hace falta: las herramientas comparan el día con los que se pueden reservar, y un "2026-02-30" recibe el mismo
// aviso que un día lejano.
export const esquemaDeFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("El día, en formato AAAA-MM-DD");

// "2026-10-23" → "viernes 23 de octubre"
export function nombreDelDia(fecha: string) {
  return DateTime.fromISO(fecha, { zone: ZONA_HORARIA }).setLocale("es").toFormat("cccc d 'de' LLLL");
}
