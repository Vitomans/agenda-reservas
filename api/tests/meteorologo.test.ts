import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESCANSO_MS,
  IDENTIFICACION,
  leerRespuestaDeMet,
  leerSimbolo,
  meteorologoDeEjemplo,
  meteorologoDeMetNorway,
  VIGENCIA_MAXIMA_MS,
} from "../src/meteorologo.ts";
import { diasReservables } from "../src/servicios/horario.ts";
import { pronosticoDelDia } from "../src/servicios/pronostico.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// Una respuesta de MET Norway, corta y con la misma forma que la de verdad: hora por hora al principio,
// y después en bloques de 6 horas
const RESPUESTA_DE_MET = {
  type: "Feature",
  properties: {
    meta: { updated_at: "2026-10-26T12:00:00Z" },
    timeseries: [
      {
        time: "2026-10-26T21:00:00Z", // 18:00 en Chile
        data: {
          instant: { details: { air_temperature: 18.4, wind_speed: 2.1 } },
          next_1_hours: { summary: { symbol_code: "partlycloudy_day" }, details: { precipitation_amount: 0 } },
          next_6_hours: { summary: { symbol_code: "lightrain_night" }, details: { precipitation_amount: 1.2 } },
        },
      },
      {
        time: "2026-10-26T22:00:00Z",
        data: {
          instant: { details: { air_temperature: 17.6 } },
          next_1_hours: { summary: { symbol_code: "lightrain_day" }, details: { precipitation_amount: 0.4 } },
        },
      },
      {
        time: "2026-10-26T23:00:00Z",
        data: {
          instant: { details: { air_temperature: 16.5 } },
          next_1_hours: { summary: { symbol_code: "lightrain_night" }, details: { precipitation_amount: 0.3 } },
        },
      },
      {
        time: "2026-10-27T00:00:00Z", // 21:00 en Chile
        data: {
          instant: { details: { air_temperature: 15 } },
          next_6_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0 } },
        },
      },
      { time: "2026-10-27T06:00:00Z", data: { instant: { details: { air_temperature: 9 } } } },
    ],
  },
};

const MINUTO = 60 * 1000;

// Un reloj que los tests adelantan a mano
function relojDePrueba(inicio = "2026-10-26T15:00:00Z") {
  let ahora = new Date(inicio).getTime();
  return {
    reloj: () => new Date(ahora),
    adelantar: (ms: number) => {
      ahora += ms;
    },
  };
}

function respuestaDeMet({ expira = "2026-10-26T15:30:00Z", modificado = "Mon, 26 Oct 2026 14:55:00 GMT" } = {}) {
  return new Response(JSON.stringify(RESPUESTA_DE_MET), {
    status: 200,
    headers: { "content-type": "application/json", expires: new Date(expira).toUTCString(), "last-modified": modificado },
  });
}

describe("leerSimbolo", () => {
  it("pasa los nombres de MET Norway a un cielo en español, y dice si es de noche", () => {
    expect(leerSimbolo("clearsky_day")).toEqual({ cielo: "despejado", deNoche: false });
    expect(leerSimbolo("fair_night")).toEqual({ cielo: "poco-nublado", deNoche: true });
    expect(leerSimbolo("partlycloudy_polartwilight")).toEqual({ cielo: "parcial", deNoche: false });
    expect(leerSimbolo("cloudy")).toEqual({ cielo: "nublado", deNoche: false });
    expect(leerSimbolo("fog")).toEqual({ cielo: "niebla", deNoche: false });
    expect(leerSimbolo("lightrainshowers_day")?.cielo).toBe("lluvia-ligera");
    expect(leerSimbolo("rain")?.cielo).toBe("lluvia");
    expect(leerSimbolo("heavyrainshowers_night")?.cielo).toBe("lluvia-fuerte");
    expect(leerSimbolo("sleet")?.cielo).toBe("aguanieve");
    expect(leerSimbolo("lightsnow")?.cielo).toBe("nieve");
  });

  it("lo más fuerte manda: con truenos es tormenta, aunque la lluvia sea ligera", () => {
    expect(leerSimbolo("lightrainandthunder")?.cielo).toBe("tormenta");
    // Así viene escrito en MET Norway (con "ss")
    expect(leerSimbolo("lightssleetshowersandthunder_day")?.cielo).toBe("tormenta");
  });

  it("un nombre que no conoce no es ningún cielo", () => {
    expect(leerSimbolo("arcoiris_day")).toBeUndefined();
  });
});

describe("leerRespuestaDeMet", () => {
  it("guarda la temperatura de cada momento y el cielo de cada período, de 1 y de 6 horas", () => {
    const { temperaturas, periodos } = leerRespuestaDeMet(RESPUESTA_DE_MET);

    expect(temperaturas.map((t) => t.grados)).toEqual([18.4, 17.6, 16.5, 15, 9]);
    expect(periodos[0]).toEqual({
      inicio: new Date("2026-10-26T21:00:00Z"),
      fin: new Date("2026-10-26T22:00:00Z"),
      cielo: "parcial",
      deNoche: false,
    });
    expect(periodos[1]).toEqual({
      inicio: new Date("2026-10-26T21:00:00Z"),
      fin: new Date("2026-10-27T03:00:00Z"),
      cielo: "lluvia-ligera",
      deNoche: true,
    });
    expect(periodos).toHaveLength(5);
  });

  it("lanza un error si la respuesta tiene otra forma", () => {
    expect(() => leerRespuestaDeMet({ properties: {} })).toThrow();
  });
});

describe("meteorologoDeMetNorway", () => {
  it("pide el pronóstico de Santiago identificándose, como pide MET Norway", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => respuestaDeMet());
    const { reloj } = relojDePrueba();

    const datos = await meteorologoDeMetNorway({ fetch, reloj }).datos();

    expect(datos?.temperaturas).toHaveLength(5);
    const [url, opciones] = fetch.mock.calls[0];
    // El centro de Santiago, con 4 decimales como máximo (con más, MET responde 403)
    expect(String(url)).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-33.4489&lon=-70.6693&altitude=570");
    expect(new Headers(opciones?.headers).get("user-agent")).toBe(IDENTIFICACION);
    expect(IDENTIFICACION).toContain("github.com/Vitomans/agenda-reservas");
  });

  it("no vuelve a preguntar hasta la hora que dice Expires, y después pregunta si cambió (If-Modified-Since)", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => respuestaDeMet());
    const { reloj, adelantar } = relojDePrueba();
    const meteorologo = meteorologoDeMetNorway({ fetch, reloj });

    const primeros = await meteorologo.datos();
    adelantar(29 * MINUTO);
    expect(await meteorologo.datos()).toBe(primeros);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Pasó la hora de Expires: pregunta de nuevo. Como no cambió, MET responde 304 sin datos, y sirve lo guardado
    adelantar(2 * MINUTO);
    fetch.mockResolvedValueOnce(new Response(null, { status: 304, headers: { expires: new Date("2026-10-26T16:00:00Z").toUTCString() } }));
    expect(await meteorologo.datos()).toBe(primeros);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(fetch.mock.calls[1][1]?.headers).get("if-modified-since")).toBe("Mon, 26 Oct 2026 14:55:00 GMT");

    // El 304 trae una hora nueva de Expires
    adelantar(20 * MINUTO);
    await meteorologo.datos();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("si dos visitantes preguntan a la vez, hace una sola consulta", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => respuestaDeMet());
    const meteorologo = meteorologoDeMetNorway({ fetch, reloj: relojDePrueba().reloj });

    const [uno, dos] = await Promise.all([meteorologo.datos(), meteorologo.datos()]);

    expect(uno).toBe(dos);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("si MET falla, sigue con el último pronóstico y no le vuelve a preguntar en 1 minuto", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn<typeof globalThis.fetch>(async () => respuestaDeMet());
    const { reloj, adelantar } = relojDePrueba();
    const meteorologo = meteorologoDeMetNorway({ fetch, reloj });
    const primeros = await meteorologo.datos();

    adelantar(31 * MINUTO);
    fetch.mockResolvedValue(new Response("Too Many Requests", { status: 429 }));
    expect(await meteorologo.datos()).toBe(primeros);
    expect(error).toHaveBeenCalledWith("Pronóstico: MET Norway no respondió bien:", "respondió 429");

    adelantar(DESCANSO_MS - 1);
    await meteorologo.datos();
    expect(fetch).toHaveBeenCalledTimes(2);

    adelantar(1);
    await meteorologo.datos();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it(`el último pronóstico sirve hasta ${VIGENCIA_MAXIMA_MS / (60 * MINUTO)} horas sin poder actualizarlo`, async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn<typeof globalThis.fetch>(async () => respuestaDeMet());
    const { reloj, adelantar } = relojDePrueba();
    const meteorologo = meteorologoDeMetNorway({ fetch, reloj });
    await meteorologo.datos();
    fetch.mockRejectedValue(new TypeError("fetch failed"));

    adelantar(VIGENCIA_MAXIMA_MS - MINUTO);
    expect(await meteorologo.datos()).not.toBeNull();
    adelantar(2 * MINUTO);
    expect(await meteorologo.datos()).toBeNull();
  });

  it("sin nada guardado, si MET no responde a tiempo o responde otra cosa, no hay pronóstico (y no se cae)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Un fetch que nunca responde: solo termina cuando se cancela por el tiempo
    const lento = vi.fn<typeof globalThis.fetch>(
      (_url, opciones) =>
        new Promise((_resolver, rechazar) => opciones?.signal?.addEventListener("abort", () => rechazar(opciones.signal?.reason))),
    );
    expect(await meteorologoDeMetNorway({ fetch: lento, esperaMaximaMs: 20 }).datos()).toBeNull();

    const raro = vi.fn<typeof globalThis.fetch>(async () => Response.json({ hola: "mundo" }));
    expect(await meteorologoDeMetNorway({ fetch: raro }).datos()).toBeNull();
  });
});

describe("meteorologoDeEjemplo", () => {
  it("inventa un pronóstico para todas las horas de los días que se pueden reservar, sin internet", async () => {
    const datos = await meteorologoDeEjemplo().datos();
    const ultimoDia = diasReservables().at(-1)!;

    const horas = pronosticoDelDia(datos!, ultimoDia);

    expect(horas).toHaveLength(15);
    expect(horas[0]).toMatchObject({ hora: "08:00", grados: 12, cielo: "despejado" });
    expect(horas.find((h) => h.hora === "16:00")).toMatchObject({ grados: 22, cielo: "parcial" });
    expect(horas.at(-1)).toMatchObject({ hora: "22:00", cielo: "lluvia-ligera", deNoche: true });
  });
});
