import { APICallError, type LanguageModelV4, type LanguageModelV4CallOptions } from "@ai-sdk/provider";

// La cadena de respaldo: varios modelos de IA en orden, por si uno no responde.
//
// El plan gratis de cada modelo tiene su propia cuota (tokens por minuto y por día). Cuando un modelo se queda
// sin cuota, responde 429 ("demasiados pedidos") y dice en cuántos segundos vuelve a atender. Entonces la cadena
// le pregunta al siguiente de inmediato, sin esperar, y anota que ese modelo "descansa" hasta esa hora:
// mientras tanto, los mensajes siguientes van directo al que sigue, sin perder tiempo en un pedido que va a fallar.
//
// Para el AI SDK, la cadena es un modelo más (cumple la misma interfaz, LanguageModelV4), así que el asistente
// no sabe que detrás hay varios.

// Cuánto descansa un modelo que falló sin decir cuándo vuelve (por ejemplo, un error 503 o si no contestó)
export const DESCANSO_SI_FALLA_MS = 60_000;

// Lo más que se espera a que un modelo empiece a responder. Si tarda más, se pasa al siguiente.
export const ESPERA_MAXIMA_MS = 10_000;

// Cuando todos los modelos descansan. "vuelveEnMs" es cuánto falta para que vuelva el primero.
export class SinModelosDisponibles extends Error {
  constructor(readonly vuelveEnMs: number) {
    super(`Ningún modelo de la cadena puede responder ahora (el primero vuelve en ${Math.ceil(vuelveEnMs / 1000)} s)`);
  }
}

// Los modelos de Gemini no se usan con los visitantes de algunos países (ver modelos.ts)
export function esDeGemini(modelo: LanguageModelV4) {
  return modelo.provider.startsWith("google");
}

// Cuánto descansa un modelo después de este error, o undefined si no descansa.
// Descansa si se quedó sin cuota (429), si su servicio falló (500, 503, sin conexión) o si no contestó a tiempo.
// Si el problema fue el pedido y no el modelo (por ejemplo, un 400), el modelo sigue disponible para el próximo
// mensaje; igual se le pregunta al siguiente, que puede responder bien ese mismo pedido.
function descansoDespuesDe(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return esperaQuePide(error.responseHeaders) ?? DESCANSO_SI_FALLA_MS;
    return error.isRetryable ? DESCANSO_SI_FALLA_MS : undefined;
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return DESCANSO_SI_FALLA_MS;
  return undefined;
}

// Groq dice en la cabecera "retry-after" en cuántos segundos vuelve a atender
function esperaQuePide(cabeceras: Record<string, string> | undefined) {
  const segundos = Number.parseFloat(cabeceras?.["retry-after"] ?? "");
  return Number.isFinite(segundos) && segundos >= 0 ? Math.max(segundos * 1000, 1000) : undefined;
}

// Para el log: "429 Rate limit reached for model ..." (sin el texto completo, que puede ser largo)
function motivo(error: unknown) {
  const texto = error instanceof Error ? error.message : String(error);
  const codigo = APICallError.isInstance(error) && error.statusCode ? `${error.statusCode} ` : "";
  return `${codigo}${texto}`.slice(0, 200);
}

export class CadenaDeRespaldo {
  // Hasta cuándo descansa cada modelo (en milisegundos, como Date.now())
  private readonly descansos = new Map<LanguageModelV4, number>();

  // "reloj" se puede cambiar en los tests para no esperar de verdad
  constructor(
    readonly modelos: LanguageModelV4[],
    private readonly reloj: () => number = Date.now,
  ) {}

  // Los modelos que se pueden usar con un visitante, en orden
  private modelosPara(conGemini: boolean) {
    return this.modelos.filter((modelo) => conGemini || !esDeGemini(modelo));
  }

  private descansa(modelo: LanguageModelV4) {
    return (this.descansos.get(modelo) ?? 0) > this.reloj();
  }

  // Cuánto falta para que vuelva a atender el primero de estos modelos (0 si alguno atiende ahora)
  private vuelveEnMs(modelos: LanguageModelV4[]) {
    return Math.max(0, Math.min(...modelos.map((modelo) => (this.descansos.get(modelo) ?? 0) - this.reloj())));
  }

  // Cuánto falta para que algún modelo pueda atender a este visitante: 0 si ya puede, o null si la cadena no tiene
  // ningún modelo para él (por ejemplo, si solo está Gemini y el visitante no lo puede usar)
  disponibleEn({ conGemini }: { conGemini: boolean }): number | null {
    const modelos = this.modelosPara(conGemini);
    return modelos.length === 0 ? null : this.vuelveEnMs(modelos);
  }

  // El "modelo" que recibe el asistente: por dentro, le pregunta a cada modelo de la cadena hasta que uno responda
  modeloPara({ conGemini }: { conGemini: boolean }): LanguageModelV4 {
    const modelos = this.modelosPara(conGemini);
    return {
      specificationVersion: "v4",
      provider: "volea.respaldo",
      modelId: modelos.map((modelo) => modelo.modelId).join(" > "),
      supportedUrls: {},
      doGenerate: (opciones) => this.preguntar(modelos, opciones, (modelo, conPlazo) => modelo.doGenerate(conPlazo)),
      doStream: (opciones) => this.preguntar(modelos, opciones, (modelo, conPlazo) => modelo.doStream(conPlazo)),
    };
  }

  private async preguntar<Resultado>(
    modelos: LanguageModelV4[],
    opciones: LanguageModelV4CallOptions,
    llamar: (modelo: LanguageModelV4, opciones: LanguageModelV4CallOptions) => PromiseLike<Resultado>,
  ): Promise<Resultado> {
    let ultimoError: unknown;

    for (const modelo of modelos) {
      if (this.descansa(modelo)) continue;

      // Si el modelo no empieza a responder a tiempo, se corta su pedido. Cuando empieza, el plazo se quita:
      // la respuesta puede seguir llegando de a poco sin límite (la corta solo la persona, si cierra el chat).
      const plazo = new AbortController();
      const temporizador = setTimeout(
        () => plazo.abort(new DOMException(`${modelo.modelId} no respondió en ${ESPERA_MAXIMA_MS} ms`, "TimeoutError")),
        ESPERA_MAXIMA_MS,
      );
      const senal = opciones.abortSignal ? AbortSignal.any([opciones.abortSignal, plazo.signal]) : plazo.signal;

      try {
        return await llamar(modelo, { ...opciones, abortSignal: senal });
      } catch (error) {
        // La persona cerró el chat: no tiene sentido preguntarle a otro
        if (opciones.abortSignal?.aborted) throw error;

        ultimoError = error;
        const descanso = descansoDespuesDe(error);
        if (descanso !== undefined) this.descansos.set(modelo, this.reloj() + descanso);
        console.warn(
          `El modelo ${modelo.modelId} no respondió (${motivo(error)})` +
            (descanso === undefined ? "" : `. Descansa ${Math.ceil(descanso / 1000)} s`) +
            ". Se le pregunta al siguiente.",
        );
      } finally {
        clearTimeout(temporizador);
      }
    }

    // Ninguno respondió. Si todos están descansando, se avisa cuándo vuelve el primero (la ruta decide qué decir).
    // Si alguno sigue disponible (falló por el pedido, no por la cuota), se entrega el último error.
    const vuelveEn = this.vuelveEnMs(modelos);
    if (vuelveEn > 0 || ultimoError === undefined) throw new SinModelosDisponibles(vuelveEn);
    throw ultimoError;
  }
}
