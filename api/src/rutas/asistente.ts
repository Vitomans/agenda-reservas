import { type LanguageModel, pipeAgentUIStreamToResponse } from "ai";
import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { crearAsistente } from "../asistente/asistente.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { sesionOpcional } from "../middlewares/sesion.ts";
import { ipDelVisitante } from "../middlewares/soloDesdeLaWeb.ts";
import { conversacionValida } from "../validacion/asistente.ts";

// Ruta de /api/asistente: recibe la conversación y responde de a poco (streaming),
// a medida que el modelo va escribiendo, como en los chats de IA.

export const MENSAJES_CADA_10_MINUTOS = 20;
export const MENSAJES_AL_DIA = 60;

// Lo que ve la persona si la IA falla a mitad de la respuesta. El detalle queda en el log y nunca llega a la página.
export const MENSAJE_DE_ERROR = "El asistente tuvo un problema y no pudo responder. Prueba de nuevo en unos segundos.";

// Los mensajes se cuentan por visitante, igual que los intentos del login (ver rutas/auth.ts)
function limiteDeMensajes(minutos: number, limite: number, error: string) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: limite,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error },
    keyGenerator: (req) => ipKeyGenerator(ipDelVisitante(req)),
    validate: { xForwardedForHeader: false },
  });
}

// "modelo" es null cuando no hay clave de la IA: la ruta existe, pero responde que el asistente no está disponible.
// Es una función por la misma razón que crearRutasAuth: cada app de los tests tiene sus propios contadores.
export function crearRutasAsistente(modelo: LanguageModel | null) {
  const rutas = Router();

  // El plan gratis de la IA tiene una cuota diaria: así una sola persona no se la gasta toda
  const porRato = limiteDeMensajes(
    10,
    MENSAJES_CADA_10_MINUTOS,
    "Le escribiste muchos mensajes seguidos al asistente. Espera unos minutos y vuelve a probar.",
  );
  const porDia = limiteDeMensajes(
    24 * 60,
    MENSAJES_AL_DIA,
    "Llegaste al máximo de mensajes al asistente por hoy. Puedes seguir reservando en la grilla.",
  );

  // Se puede conversar sin entrar, como se ven los horarios. Con sesión, el asistente ve las reservas propias.
  rutas.post("/", porRato, porDia, sesionOpcional, async (req, res) => {
    if (!modelo) {
      throw new ErrorHttp(503, "El asistente no está disponible en este momento");
    }

    const asistente = crearAsistente(modelo, { usuarioId: req.usuario?.id });
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
      onError: (error) => {
        console.error("Error del asistente:", error);
        return MENSAJE_DE_ERROR;
      },
    });
  });

  return rutas;
}
