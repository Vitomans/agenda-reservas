import type { LanguageModelUsage } from "ai";
import { DateTime } from "luxon";
import { ZONA_HORARIA } from "../servicios/horario.ts";

// Lo que gasta el asistente en la IA. Después de cada respuesta deja una línea en el log (en Render, en "Logs"):
//
// Asistente: 2 pedidos a openai/gpt-oss-120b, 3.412 tokens de entrada y 120 de salida. Hoy: 12 respuestas y 41.230 tokens.
//
// Así se ve cuánto de la cuota gratis se está usando, y los límites se pueden ajustar con datos de verdad.

// Un paso de la respuesta es un pedido a la IA (por ejemplo, 1) pedir los horarios y 2) responder con ellos)
export type Paso = { response: { modelId: string }; usage: LanguageModelUsage };

const numero = (n: number) => n.toLocaleString("es-CL");

// "reloj" se puede cambiar en los tests. El día se cuenta en la hora del club.
export function crearAnotadorDelGasto(reloj = () => new Date()) {
  let hoy = { dia: "", respuestas: 0, tokens: 0 };

  return function anotarGasto(pasos: Paso[]) {
    const dia = DateTime.fromJSDate(reloj(), { zone: ZONA_HORARIA }).toISODate();
    if (dia !== hoy.dia) hoy = { dia: dia ?? "", respuestas: 0, tokens: 0 };

    const entrada = pasos.reduce((suma, paso) => suma + (paso.usage.inputTokens ?? 0), 0);
    const salida = pasos.reduce((suma, paso) => suma + (paso.usage.outputTokens ?? 0), 0);
    hoy.respuestas += 1;
    hoy.tokens += entrada + salida;

    // El modelo que respondió cada paso (si uno se quedó sin cuota, pueden ser dos distintos)
    const modelos = [...new Set(pasos.map((paso) => paso.response.modelId))].join(" y ");
    console.log(
      `Asistente: ${pasos.length} ${pasos.length === 1 ? "pedido" : "pedidos"} a ${modelos}, ` +
        `${numero(entrada)} tokens de entrada y ${numero(salida)} de salida. ` +
        `Hoy: ${numero(hoy.respuestas)} ${hoy.respuestas === 1 ? "respuesta" : "respuestas"} y ${numero(hoy.tokens)} tokens.`,
    );
  };
}
