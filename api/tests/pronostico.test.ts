import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { type Cielo, type DatosDelTiempo, type Meteorologo, meteorologoDeEjemplo } from "../src/meteorologo.ts";
import { describirTramo, pronosticoDelDia, TEXTO_DEL_CIELO, tramosDelPronostico } from "../src/servicios/pronostico.ts";
import { dia } from "./ayudantes.ts";

// Lo que podría traer MET Norway el lunes 26 de octubre (en Chile, 3 horas menos que en UTC):
// hora por hora de 18:00 a 21:00, y después un bloque de 6 horas
const LUNES: DatosDelTiempo = {
  temperaturas: [
    { momento: new Date("2026-10-26T21:00:00Z"), grados: 18.4 }, // 18:00 en Chile
    { momento: new Date("2026-10-26T22:00:00Z"), grados: 17.6 },
    { momento: new Date("2026-10-26T23:00:00Z"), grados: 16.5 },
    { momento: new Date("2026-10-27T00:00:00Z"), grados: 15 }, // 21:00
    { momento: new Date("2026-10-27T06:00:00Z"), grados: 9 }, // 03:00
  ],
  periodos: [
    { inicio: new Date("2026-10-26T21:00:00Z"), fin: new Date("2026-10-26T22:00:00Z"), cielo: "parcial", deNoche: false },
    // Un período de 6 horas que se cruza con los de 1 hora: para cada hora se usa el más corto
    { inicio: new Date("2026-10-26T21:00:00Z"), fin: new Date("2026-10-27T03:00:00Z"), cielo: "lluvia", deNoche: true },
    { inicio: new Date("2026-10-26T22:00:00Z"), fin: new Date("2026-10-26T23:00:00Z"), cielo: "lluvia-ligera", deNoche: false },
    { inicio: new Date("2026-10-26T23:00:00Z"), fin: new Date("2026-10-27T00:00:00Z"), cielo: "lluvia-ligera", deNoche: true },
    { inicio: new Date("2026-10-27T00:00:00Z"), fin: new Date("2026-10-27T06:00:00Z"), cielo: "nublado", deNoche: true },
  ],
};

const EN_LA_MANANA = new Date("2026-10-26T12:00:00Z"); // 09:00 en Chile

describe("pronosticoDelDia", () => {
  it("da el tiempo de cada hora del club que tiene pronóstico, con el período más corto que la incluye", () => {
    const horas = pronosticoDelDia(LUNES, "2026-10-26", EN_LA_MANANA);

    expect(horas.map((h) => h.hora)).toEqual(["18:00", "19:00", "20:00", "21:00", "22:00"]);
    expect(horas[0]).toEqual({ hora: "18:00", grados: 18, cielo: "parcial", descripcion: "parcialmente nublado", deNoche: false });
    expect(horas[1]).toMatchObject({ hora: "19:00", cielo: "lluvia-ligera", descripcion: "lluvia ligera" });
  });

  it("si a esa hora no hay un dato de temperatura, la calcula entre los dos más cercanos", () => {
    const horas = pronosticoDelDia(LUNES, "2026-10-26", EN_LA_MANANA);

    // 22:00 está a 1 hora de las 21:00 (15 °C) y a 5 de las 03:00 (9 °C): 15 − 6 × 1/6 = 14 °C
    expect(horas.at(-1)).toEqual({ hora: "22:00", grados: 14, cielo: "nublado", descripcion: "nublado", deNoche: true });
  });

  it("no incluye las horas que ya terminaron", () => {
    const aLas19ConMedia = new Date("2026-10-26T22:30:00Z");

    expect(pronosticoDelDia(LUNES, "2026-10-26", aLas19ConMedia).map((h) => h.hora)).toEqual(["19:00", "20:00", "21:00", "22:00"]);
  });
});

describe("tramosDelPronostico", () => {
  it("junta las horas seguidas con el mismo cielo, con la temperatura más baja y la más alta", () => {
    const tramos = tramosDelPronostico(pronosticoDelDia(LUNES, "2026-10-26", EN_LA_MANANA));

    expect(tramos.map(describirTramo)).toEqual([
      "18:00 a 19:00: parcialmente nublado, 18 °C",
      "19:00 a 21:00: lluvia ligera, 17 a 18 °C",
      "21:00 a 23:00: nublado, 14 a 15 °C",
    ]);
  });

  it("junta las horas seguidas de lluvia aunque cambie la fuerza, y dice cuánta", () => {
    const hora = (h: number, cielo: Cielo) => ({ hora: `${h}:00`, grados: 15, cielo, descripcion: TEXTO_DEL_CIELO[cielo], deNoche: false });

    const conFuerte = tramosDelPronostico([hora(13, "lluvia"), hora(14, "lluvia-ligera"), hora(15, "lluvia-fuerte"), hora(16, "lluvia"), hora(17, "nublado")]);
    expect(conFuerte.map(describirTramo)).toEqual(["13:00 a 17:00: lluvia, a ratos fuerte, 15 °C", "17:00 a 18:00: nublado, 15 °C"]);
    expect(conFuerte[0].cielo).toBe("lluvia-fuerte");

    expect(tramosDelPronostico([hora(13, "lluvia-ligera"), hora(14, "lluvia")]).map(describirTramo)).toEqual(["13:00 a 15:00: lluvia, 15 °C"]);
    expect(tramosDelPronostico([hora(13, "lluvia-fuerte"), hora(14, "lluvia-fuerte")]).map(describirTramo)).toEqual([
      "13:00 a 15:00: lluvia fuerte, 15 °C",
    ]);
  });

  it("no junta dos horas con el mismo cielo si entre ellas falta una", () => {
    const horas = pronosticoDelDia(LUNES, "2026-10-26", EN_LA_MANANA).filter((h) => h.hora !== "20:00");

    expect(tramosDelPronostico(horas).map((t) => `${t.desde}-${t.hasta}`)).toEqual(["18:00-19:00", "19:00-20:00", "21:00-23:00"]);
  });
});

// Un meteorólogo que siempre trae el pronóstico de ejemplo (el mismo de los tests e2e)
const conPronostico: Meteorologo = meteorologoDeEjemplo();

describe("GET /api/pronostico", () => {
  it("responde el tiempo de cada hora del día, sin iniciar sesión", async () => {
    const respuesta = await request(crearApp({ meteorologo: conPronostico })).get(`/api/pronostico?fecha=${dia(1)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.fecha).toBe(dia(1));
    expect(respuesta.body.horas).toHaveLength(15);
    expect(respuesta.body.horas[0]).toEqual({ hora: "08:00", grados: 12, cielo: "despejado", descripcion: "despejado", deNoche: false });
  });

  it("responde 400 si falta la fecha o queda fuera de los días que se pueden reservar", async () => {
    const app = crearApp({ meteorologo: conPronostico });

    expect((await request(app).get("/api/pronostico")).status).toBe(400);
    const lejos = await request(app).get(`/api/pronostico?fecha=${dia(7)}`);
    expect(lejos.status).toBe(400);
    expect(lejos.body.error).toBe("Solo hay pronóstico de los próximos 7 días");
  });

  it("responde 503 si no hay pronóstico (por ejemplo, si MET Norway no responde)", async () => {
    const respuesta = await request(crearApp()).get(`/api/pronostico?fecha=${dia(1)}`);

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.error).toBe("El pronóstico no está disponible en este momento");
  });
});
