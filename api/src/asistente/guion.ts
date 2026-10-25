import type { LanguageModelV4, LanguageModelV4Prompt, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { diasReservables } from "../servicios/horario.ts";
import { TARIFA } from "../servicios/precios.ts";
import { nombreDelDia, pesos } from "./textos.ts";

// El asistente "de guion": un modelo de mentira que no le pregunta nada a una IA. Lee la conversación y responde
// con reglas fijas ("hay cancha" → pide los horarios libres, "reservar a las 19" → pide la reserva, "cancela" →
// busca las reservas y pide cancelar la primera).
//
// Lo usan los tests e2e (ver web/tests/e2e/asistente.spec.ts): la API arranca con ASISTENTE_DE_GUION=true y el
// chat se prueba de punta a punta sin gastar la cuota de la IA ni depender de internet. Lo único falso es el
// modelo: las herramientas son las de verdad (la base de datos, la confirmación de la persona y el aviso en vivo).
// También sirve para mirar el chat en local sin gastar cuota.

// No gasta tokens de verdad
const USO = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

// Un poco de espera antes de responder y entre palabra y palabra, como una IA de verdad: así la página muestra
// los tres puntos y la respuesta llega de a poco
const ESPERA_INICIAL_MS = 150;
const ESPERA_ENTRE_PALABRAS_MS = 15;

let llamadas = 0;

function respuesta(partes: LanguageModelV4StreamPart[]) {
  return { stream: simulateReadableStream({ chunks: partes, initialDelayInMs: ESPERA_INICIAL_MS, chunkDelayInMs: ESPERA_ENTRE_PALABRAS_MS }) };
}

// En vez de escribir, pide usar una herramienta
function pide(herramienta: string, entrada: object) {
  return respuesta([
    { type: "tool-call", toolCallId: `guion-${++llamadas}`, toolName: herramienta, input: JSON.stringify(entrada) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USO },
  ]);
}

// Escribe un texto, palabra por palabra
function escribe(texto: string) {
  return respuesta([
    { type: "text-start", id: "t1" },
    ...texto.split(/(?<= )/).map((delta) => ({ type: "text-delta", id: "t1", delta }) as const),
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USO },
  ]);
}

function textoDe(mensaje: LanguageModelV4Prompt[number] | undefined) {
  if (!mensaje || mensaje.role !== "user") return "";
  return mensaje.content.map((parte) => (parte.type === "text" ? parte.text : "")).join("");
}

// Lo que leyó el modelo de cada herramienta (el texto de toModelOutput, o por qué no se hizo)
function resultados(prompt: LanguageModelV4Prompt) {
  return prompt.flatMap((mensaje) =>
    mensaje.role === "tool"
      ? mensaje.content.flatMap((parte) => {
          if (parte.type !== "tool-result") return [];
          const { output } = parte;
          const texto = output.type === "text" ? output.value : output.type === "execution-denied" ? (output.reason ?? "") : "";
          return [{ herramienta: parte.toolName, texto }];
        })
      : [],
  );
}

// En minúsculas y sin tildes, así las reglas sirven para "Resérvame" y "cancélala"
const sinTildes = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");

// El día del que habla la persona: el que nombra ("sábado 24 de octubre", como lo escribe la página al tocar una hora),
// hoy, o mañana si no dice
function diaDelMensaje(texto: string) {
  const dias = diasReservables();
  if (/\bhoy\b/.test(texto)) return dias[0];
  return dias.find((dia) => texto.includes(sinTildes(nombreDelDia(dia)))) ?? dias[1];
}

// "las 7" son las 19:00: el club abre a las 8
const horaDelClub = (numero: string) => (Number(numero) < 8 ? Number(numero) + 12 : Number(numero));

function responder(prompt: LanguageModelV4Prompt) {
  const ultimo = prompt.at(-1);
  const pregunta = textoDe(prompt.findLast((mensaje) => mensaje.role === "user"));
  const texto = sinTildes(pregunta);

  // Acaba de llegar el resultado de una herramienta
  if (ultimo?.role === "tool") {
    const resultado = resultados([ultimo]).at(-1);
    if (resultado?.herramienta === "verMisReservas" && /cancel/.test(texto)) {
      const id = /\(id ([^)]+)\)/.exec(resultado.texto)?.[1];
      if (id) return pide("cancelarReserva", { reservaId: id });
    }
    // Repite la primera línea de lo que leyó (sin el título de la sección, si es la información del club)
    const linea = resultado?.texto.split("\n").find((l) => l && !l.startsWith("[")) ?? "";
    return escribe(resultado?.herramienta === "buscarInformacion" ? `Según la información del club: ${linea}` : linea);
  }

  if (/cancel|mis reservas/.test(texto)) return pide("verMisReservas", {});

  const fecha = diaDelMensaje(texto);
  const hora = /a las (\d{1,2})/.exec(texto)?.[1];
  if (/reserv/.test(texto) && hora) {
    const h = horaDelClub(hora);
    // La cancha que nombra, o la primera libre a esa hora en los horarios que ya mostró
    const libres = resultados(prompt)
      .filter((r) => r.herramienta === "verHorariosLibres")
      .map((r) => new RegExp(`^${String(h).padStart(2, "0")}:00 \\$[\\d.]+: ([^,\\n]+)`, "m").exec(r.texto)?.[1])
      .findLast(Boolean);
    const nombrada = /cancha (\d+)/.exec(texto)?.[1];
    return pide("reservar", { fecha, hora: h, cancha: nombrada ? `Cancha ${nombrada}` : (libres ?? "Cancha 1") });
  }

  if (/hay cancha|libre/.test(texto)) {
    const desde = /despues de las (\d{1,2})/.exec(texto)?.[1];
    return pide("verHorariosLibres", desde ? { fecha, desde: horaDelClub(desde) } : { fecha });
  }

  if (/cuanto|precio|cuesta/.test(texto)) {
    return escribe(`La hora de cancha cuesta ${pesos(TARIFA.precioNormal)}, y ${pesos(TARIFA.precioPunta)} en hora punta.`);
  }

  if (/^(hola|buenas)/.test(texto)) return escribe("¡Hola! Soy el asistente de guion de Volea.");

  return pide("buscarInformacion", { pregunta: pregunta.slice(0, 200) });
}

export function modeloDeGuion(): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "volea.guion",
    modelId: "guion",
    supportedUrls: {},
    doStream: async ({ prompt }) => responder(prompt),
    // El asistente siempre responde de a poco (ver rutas/asistente.ts)
    doGenerate: () => Promise.reject(new Error("El asistente de guion solo responde de a poco (doStream)")),
  };
}
