import type { LanguageModelV4 } from "@ai-sdk/provider";
import { type EmbeddingModel, pipeAgentUIStreamToResponse } from "ai";
import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { crearAsistente } from "../asistente/asistente.ts";
import { crearAnotadorDelGasto } from "../asistente/gasto.ts";
import { puedeUsarGemini } from "../asistente/modelos.ts";
import { CadenaDeRespaldo, SinModelosDisponibles } from "../asistente/respaldo.ts";
import type { Cartero } from "../cartero.ts";
import type { Meteorologo } from "../meteorologo.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { sesionOpcional } from "../middlewares/sesion.ts";
import { ipDelVisitante } from "../middlewares/soloDesdeLaWeb.ts";
import type { Avisador } from "../tiempoReal.ts";
import { conversacionValida } from "../validacion/asistente.ts";

// Ruta de /api/asistente: recibe la conversación y responde de a poco (streaming),
// a medida que el modelo va escribiendo, como en los chats de IA.

// Por visitante
export const MENSAJES_CADA_10_MINUTOS = 20;
export const MENSAJES_AL_DIA = 30;

// Entre todos los visitantes. Se midió con Groq que cada pedido a la IA lleva unos 1.470 tokens solo de
// instrucciones y herramientas, y que una respuesta que consulta los horarios son 2 pedidos: unos 3.300 tokens,
// y más a medida que crece la conversación. Con 200.000 tokens al día por modelo, los 3 modelos de Groq alcanzan
// para unas 140 respuestas al día (Qwen cuenta las palabras de otra forma, y el mismo pedido le pesa un 40 % más).
// Se dejan 120: el resto queda de margen para las conversaciones largas y las pruebas con la IA de verdad.
// Cada visitante puede usar un cuarto (MENSAJES_AL_DIA).
export const MENSAJES_DEL_CLUB_AL_DIA = 120;

// Lo que ve la persona si la IA falla a mitad de la respuesta. El detalle queda en el log y nunca llega a la página.
export const MENSAJE_DE_ERROR = "El asistente tuvo un problema y no pudo responder. Prueba de nuevo en unos segundos.";

// Cuando ningún modelo puede responder (ver asistente/respaldo.ts). Si alguno vuelve pronto, la persona
// puede reintentar en unos segundos; si no, el chat se cierra y se le ofrece la grilla, que funciona sin IA.
export const ASISTENTE_OCUPADO = "El asistente está atendiendo muchas consultas. Prueba de nuevo en unos segundos.";
export const ASISTENTE_DESCANSANDO = "El asistente está descansando. Mientras tanto, puedes reservar en la grilla.";
const ESPERA_CORTA_MS = 60_000;

// Lo que recibe la página cuando el asistente no puede responder. Llega siempre con la misma forma,
// { error, cerrarElChat? }, tanto si se sabe antes de empezar (una respuesta 503) como si pasa a mitad de la respuesta.
export function sinAsistente(vuelveEnMs: number) {
  return vuelveEnMs <= ESPERA_CORTA_MS ? { error: ASISTENTE_OCUPADO } : { error: ASISTENTE_DESCANSANDO, cerrarElChat: true };
}

// Los mensajes se cuentan por visitante, igual que los intentos del login (ver rutas/auth.ts).
// "respuesta" es lo que recibe la página al pasarse, con la misma forma que los demás errores del asistente.
function limiteDeMensajes(minutos: number, limite: number, respuesta: { error: string; cerrarElChat?: boolean }) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: limite,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: respuesta,
    keyGenerator: (req) => ipKeyGenerator(ipDelVisitante(req)),
    validate: { xForwardedForHeader: false },
  });
}

// "modelos" son los de la cadena de respaldo, en orden. Sin ninguno (no hay claves de la IA), la ruta existe,
// pero responde que el asistente no está disponible.
// "modeloDeVectores" es null cuando no hay clave de Gemini: el asistente busca en la información del club por palabras.
// "avisador" y "cartero" son los mismos de las rutas de las reservas: al reservar por el chat se avisa en vivo
// y se envía el correo, igual que al reservar en la grilla.
// "meteorologo" trae el pronóstico del tiempo: el mismo de la barra para reservar, así los dos usan la misma consulta.
// Es una función por la misma razón que crearRutasAuth: cada app de los tests tiene sus propios contadores.
export function crearRutasAsistente({
  modelos,
  modeloDeVectores,
  avisador,
  cartero,
  meteorologo,
}: {
  modelos: LanguageModelV4[];
  modeloDeVectores: EmbeddingModel | null;
  avisador: Avisador;
  cartero: Cartero;
  meteorologo: Meteorologo;
}) {
  const rutas = Router();
  // Una sola cadena para todos los mensajes: así recuerda qué modelos están descansando
  const cadena = new CadenaDeRespaldo(modelos);
  const anotarGasto = crearAnotadorDelGasto();

  // El plan gratis de la IA tiene una cuota diaria: así una sola persona no se la gasta toda
  const porRato = limiteDeMensajes(10, MENSAJES_CADA_10_MINUTOS, {
    error: "Le escribiste muchos mensajes seguidos al asistente. Espera unos minutos y vuelve a probar.",
  });
  // Por hoy ya no puede escribir más: el chat se cierra y se le ofrece la grilla
  const porDia = limiteDeMensajes(24 * 60, MENSAJES_AL_DIA, {
    error: "Llegaste al máximo de mensajes al asistente por hoy. Puedes seguir reservando en la grilla.",
    cerrarElChat: true,
  });
  // El total del día entre todos los visitantes, para no gastar toda la cuota gratis (ver MENSAJES_DEL_CLUB_AL_DIA)
  const delClub = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: MENSAJES_DEL_CLUB_AL_DIA,
    statusCode: 503,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: ASISTENTE_DESCANSANDO, cerrarElChat: true },
    // Todos los visitantes suman en el mismo contador
    keyGenerator: () => "todo-el-club",
    // Los mensajes rechazados (una conversación inválida, o cuando ningún modelo puede responder) no cuentan
    skipFailedRequests: true,
  });

  // Se puede conversar sin entrar, como se ven los horarios. Con sesión, el asistente ve las reservas propias
  // y reserva a nombre de quien conversa.
  rutas.post("/", porRato, porDia, delClub, sesionOpcional, async (req, res) => {
    // A los visitantes de algunos países no se les pregunta nada a Gemini (ver asistente/modelos.ts)
    const conGemini = puedeUsarGemini(req.paisDelVisitante);

    const disponibleEn = cadena.disponibleEn({ conGemini });
    if (disponibleEn === null) {
      throw new ErrorHttp(503, "El asistente no está disponible en este momento");
    }
    // Si todos los modelos están descansando, se responde de inmediato, sin hacerle un pedido a la IA que va a fallar
    if (disponibleEn > 0) {
      res
        .status(503)
        .set("Retry-After", String(Math.ceil(disponibleEn / 1000)))
        .json(sinAsistente(disponibleEn));
      return;
    }

    const asistente = crearAsistente(cadena.modeloPara({ conGemini }), {
      usuario: req.usuario,
      modeloDeVectores: conGemini ? modeloDeVectores : null,
      avisador,
      cartero,
      meteorologo,
      alTerminar: anotarGasto,
    });
    const mensajes = await conversacionValida(req.body, asistente.tools);

    // Si la persona cierra el chat o la página a mitad de la respuesta, se deja de pedirle a la IA (y de gastar cuota)
    const cancelar = new AbortController();
    res.on("close", () => cancelar.abort());

    await pipeAgentUIStreamToResponse({
      response: res,
      agent: asistente,
      uiMessages: mensajes,
      abortSignal: cancelar.signal,
      // "no-transform" les pide a los intermediarios (el puente de la página) que no toquen la respuesta.
      // Sin esto, Next.js la comprime con gzip, y para comprimir espera a tenerla entera: llegaba toda de una vez.
      headers: { "Cache-Control": "no-cache, no-transform" },
      // El modelo "razona" antes de responder; la página solo necesita la respuesta
      sendReasoning: false,
      // La página lee el error como JSON, igual que las respuestas de error de antes de empezar
      onError: (error) => {
        if (error instanceof SinModelosDisponibles) return JSON.stringify(sinAsistente(error.vuelveEnMs));
        console.error("Error del asistente:", error);
        return JSON.stringify({ error: MENSAJE_DE_ERROR });
      },
    });
  });

  return rutas;
}
