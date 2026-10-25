import { DateTime } from "luxon";
import { z } from "zod";
import { DIAS_DE_ANTICIPACION, ZONA_HORARIA } from "./servicios/horario.ts";

// El "meteorólogo" es el que trae el pronóstico del tiempo. Igual que el cartero (cartero.ts),
// la app lo recibe desde afuera, así cada lugar usa el que le sirve:
// - en la demo publicada (y en local), meteorologoDeMetNorway, que le pregunta al instituto de meteorología de Noruega
// - en los tests e2e (PRONOSTICO_DE_EJEMPLO=true), meteorologoDeEjemplo, con un pronóstico inventado y sin internet
// - en los tests, sinPronostico o uno con datos fijos
//
// Las 4 canchas son al aire libre y con lluvia no se juega: el pronóstico sirve para elegir la hora, pero nunca
// bloquea una reserva (si llueve, la persona la cancela sin costo).
// Lo que se hace con los datos (el tiempo de cada hora del club) está en servicios/pronostico.ts.

const HORA_MS = 60 * 60 * 1000;

// Cómo va a estar el cielo, en grupos como los de los íconos de MET Norway
export const CIELOS = [
  "despejado",
  "poco-nublado",
  "parcial",
  "nublado",
  "niebla",
  "lluvia-ligera",
  "lluvia",
  "lluvia-fuerte",
  "aguanieve",
  "nieve",
  "tormenta",
] as const;

export type Cielo = (typeof CIELOS)[number];

// Lo que se sabe del tiempo en el club:
// - la temperatura en distintos momentos: cada 1 hora en los próximos 2 o 3 días, y después cada 6 horas
// - cómo va a estar el cielo en cada período (de 1 o de 6 horas), y si es de noche (para el ícono de la página)
export type DatosDelTiempo = {
  temperaturas: { momento: Date; grados: number }[];
  periodos: { inicio: Date; fin: Date; cielo: Cielo; deNoche: boolean }[];
};

export type Meteorologo = {
  // null si no hay pronóstico (por ejemplo, si el servicio no responde). Nunca lanza un error: sin pronóstico,
  // la página y el asistente siguen funcionando igual.
  datos(): Promise<DatosDelTiempo | null>;
};

// El meteorólogo que no sabe nada: el que usa la app si no se le pasa otro (por ejemplo, en los tests)
export const sinPronostico: Meteorologo = {
  async datos() {
    return null;
  },
};

// ---------- MET Norway ----------

// MET Norway nombra cada pronóstico como sus íconos (https://github.com/metno/weathericons): el estado del cielo y,
// al final, si es de día o de noche. Por ejemplo, "lightrainshowers_day" o "clearsky_night".
const SIN_LLUVIA: Record<string, Cielo> = {
  clearsky: "despejado",
  fair: "poco-nublado",
  partlycloudy: "parcial",
  cloudy: "nublado",
  fog: "niebla",
};

export function leerSimbolo(simbolo: string): { cielo: Cielo; deNoche: boolean } | undefined {
  const [nombre, momento] = simbolo.split("_");
  const deNoche = momento === "night";

  // Lo más fuerte manda: "lightrainandthunder" es tormenta, y "heavysleetshowers", aguanieve
  if (nombre.includes("thunder")) return { cielo: "tormenta", deNoche };
  if (nombre.includes("sleet")) return { cielo: "aguanieve", deNoche };
  if (nombre.includes("snow")) return { cielo: "nieve", deNoche };
  if (nombre.includes("rain")) {
    const cielo = nombre.startsWith("light") ? "lluvia-ligera" : nombre.startsWith("heavy") ? "lluvia-fuerte" : "lluvia";
    return { cielo, deNoche };
  }

  const cielo = SIN_LLUVIA[nombre];
  return cielo && { cielo, deNoche };
}

// La respuesta de MET Norway (https://api.met.no/weatherapi/locationforecast/2.0/documentation).
// Solo se revisa lo que se usa. Si algún día cambia de forma, no hay pronóstico, pero la API no se cae.
const esquemaPeriodoDeMet = z.object({ summary: z.object({ symbol_code: z.string() }) });

const esquemaRespuestaDeMet = z.object({
  properties: z.object({
    timeseries: z.array(
      z.object({
        time: z.iso.datetime(),
        data: z.object({
          instant: z.object({ details: z.object({ air_temperature: z.number().optional() }) }),
          next_1_hours: esquemaPeriodoDeMet.optional(),
          next_6_hours: esquemaPeriodoDeMet.optional(),
        }),
      }),
    ),
  }),
});

// Cada momento de la respuesta trae la temperatura en ese momento y el cielo de la hora siguiente (next_1_hours),
// de las 6 horas siguientes (next_6_hours) o de las dos. Se guardan los dos períodos: para cada hora del club
// se usa el más corto, que es el más preciso (ver servicios/pronostico.ts).
export function leerRespuestaDeMet(json: unknown): DatosDelTiempo {
  const datos: DatosDelTiempo = { temperaturas: [], periodos: [] };

  for (const { time, data } of esquemaRespuestaDeMet.parse(json).properties.timeseries) {
    const momento = new Date(time);
    const grados = data.instant.details.air_temperature;
    if (grados !== undefined) datos.temperaturas.push({ momento, grados });

    for (const [horas, periodo] of [
      [1, data.next_1_hours],
      [6, data.next_6_hours],
    ] as const) {
      const simbolo = periodo && leerSimbolo(periodo.summary.symbol_code);
      if (simbolo) datos.periodos.push({ inicio: momento, fin: new Date(momento.getTime() + horas * HORA_MS), ...simbolo });
    }
  }

  return datos;
}

// El club está en Santiago Centro (su dirección es inventada), así que se usa la Plaza de Armas.
// MET Norway pide como mucho 4 decimales, y la altura (570 m) le sirve para calcular bien la temperatura.
export const URL_DE_MET = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-33.4489&lon=-70.6693&altitude=570";

// MET Norway pide que cada consulta diga quién pregunta: el nombre de la app y dónde encontrar a quien la hizo.
// A quien no se identifica (o lo hace con un nombre genérico o falso) lo bloquea.
export const IDENTIFICACION = "Volea/1.0 github.com/Vitomans/agenda-reservas";

// Si MET Norway responde un error o no responde, no se le vuelve a preguntar en 1 minuto
// (así no se hace esperar a cada visitante) y se sigue usando el último pronóstico, si es de las últimas 6 horas
export const DESCANSO_MS = 60 * 1000;
export const VIGENCIA_MAXIMA_MS = 6 * HORA_MS;
// Si la respuesta no dice hasta cuándo sirve (la cabecera Expires), se guarda 30 minutos
const VIGENCIA_POR_DEFECTO_MS = 30 * 60 * 1000;

// Le pregunta a MET Norway, gratis y sin clave (sus condiciones: https://api.met.no/doc/TermsOfService),
// y guarda la respuesta en memoria hasta la hora que dice su cabecera Expires (unos 30 minutos). Así todos los
// visitantes usan la misma consulta, responde rápido y se cumplen sus condiciones: no volver a preguntar antes.
// Al volver a preguntar, manda If-Modified-Since: si el pronóstico no cambió, MET responde 304, sin los datos.
//
// "fetch", "reloj" y "esperaMaximaMs" (lo más que se espera la respuesta) se cambian en los tests.
export function meteorologoDeMetNorway({
  fetch = globalThis.fetch,
  reloj = () => new Date(),
  esperaMaximaMs = 3000,
}: {
  fetch?: typeof globalThis.fetch;
  reloj?: () => Date;
  esperaMaximaMs?: number;
} = {}): Meteorologo {
  // "modificado" es la cabecera Last-Modified, que se devuelve en If-Modified-Since
  let guardado: { datos: DatosDelTiempo; venceEl: number; recibidoEl: number; modificado: string | null } | null = null;
  // Si dos visitantes preguntan a la vez, los dos esperan la misma consulta
  let enCamino: Promise<DatosDelTiempo | null> | null = null;
  let descansaHasta = 0;

  const loGuardado = (ahora: number) => (guardado && ahora - guardado.recibidoEl < VIGENCIA_MAXIMA_MS ? guardado.datos : null);

  function venceEl(respuesta: Response, ahora: number) {
    const expira = Date.parse(respuesta.headers.get("expires") ?? "");
    // Si dice una hora que ya pasó, igual se espera un poco antes de volver a preguntar
    return Number.isNaN(expira) ? ahora + VIGENCIA_POR_DEFECTO_MS : Math.max(expira, ahora + DESCANSO_MS);
  }

  async function preguntar() {
    const ahora = reloj().getTime();
    try {
      const respuesta = await fetch(URL_DE_MET, {
        headers: { "User-Agent": IDENTIFICACION, ...(guardado?.modificado && { "If-Modified-Since": guardado.modificado }) },
        signal: AbortSignal.timeout(esperaMaximaMs),
      });

      if (respuesta.status === 304 && guardado) {
        guardado = { ...guardado, venceEl: venceEl(respuesta, ahora), recibidoEl: ahora };
        return guardado.datos;
      }
      if (!respuesta.ok) throw new Error(`respondió ${respuesta.status}`);

      const datos = leerRespuestaDeMet(await respuesta.json());
      guardado = { datos, venceEl: venceEl(respuesta, ahora), recibidoEl: ahora, modificado: respuesta.headers.get("last-modified") };
      return datos;
    } catch (error) {
      console.error("Pronóstico: MET Norway no respondió bien:", error instanceof Error ? error.message : error);
      descansaHasta = ahora + DESCANSO_MS;
      return loGuardado(ahora);
    }
  }

  return {
    async datos() {
      const ahora = reloj().getTime();
      if (guardado && ahora < guardado.venceEl) return guardado.datos;
      if (ahora < descansaHasta) return loGuardado(ahora);

      enCamino ??= preguntar().finally(() => {
        enCamino = null;
      });
      return enCamino;
    },
  };
}

// ---------- El de ejemplo ----------

// Un pronóstico inventado, hora por hora, para los días que se pueden reservar: despejado en la mañana, parcialmente
// nublado en la tarde y lluvia ligera desde las 20:00, con 12 °C a las 08:00 y 22 °C a las 16:00.
// Lo usan los tests e2e (PRONOSTICO_DE_EJEMPLO=true), que no deben depender de internet.
export function meteorologoDeEjemplo(): Meteorologo {
  return {
    async datos() {
      const desde = DateTime.now().setZone(ZONA_HORARIA).startOf("hour");
      const datos: DatosDelTiempo = { temperaturas: [], periodos: [] };

      for (let i = 0; i <= (DIAS_DE_ANTICIPACION + 1) * 24; i++) {
        const momento = desde.plus({ hours: i });
        const { hour } = momento;
        const cielo: Cielo = hour >= 8 && hour < 12 ? "despejado" : hour >= 12 && hour < 20 ? "parcial" : "lluvia-ligera";
        datos.temperaturas.push({ momento: momento.toJSDate(), grados: 22 - Math.min(Math.abs(hour - 16), 8) * 1.25 });
        datos.periodos.push({
          inicio: momento.toJSDate(),
          fin: momento.plus({ hours: 1 }).toJSDate(),
          cielo,
          deNoche: hour >= 21 || hour < 7,
        });
      }

      return datos;
    },
  };
}
