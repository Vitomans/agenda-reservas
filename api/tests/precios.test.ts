import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { ZONA_HORARIA } from "../src/servicios/horario.ts";
import { esHoraPunta, precioDelBloque, TARIFA } from "../src/servicios/precios.ts";

// Una fecha y hora en la hora del club
function enElClub(texto: string) {
  return DateTime.fromISO(texto, { zone: ZONA_HORARIA }).toJSDate();
}

describe("precios", () => {
  it("de lunes a viernes, la hora punta empieza a las 18:00", () => {
    // El 21 de octubre de 2026 es miércoles
    expect(esHoraPunta(enElClub("2026-10-21T17:00"))).toBe(false);
    expect(esHoraPunta(enElClub("2026-10-21T18:00"))).toBe(true);
    expect(esHoraPunta(enElClub("2026-10-21T22:00"))).toBe(true);
  });

  it("el fin de semana es hora punta todo el día", () => {
    expect(esHoraPunta(enElClub("2026-10-24T08:00"))).toBe(true); // sábado
    expect(esHoraPunta(enElClub("2026-10-25T13:00"))).toBe(true); // domingo
  });

  it("la hora punta cuesta más que la normal", () => {
    expect(precioDelBloque(enElClub("2026-10-21T10:00"))).toBe(TARIFA.precioNormal);
    expect(precioDelBloque(enElClub("2026-10-21T19:00"))).toBe(TARIFA.precioPunta);
    expect(TARIFA.precioPunta).toBeGreaterThan(TARIFA.precioNormal);
  });

  it("usa la hora del club aunque la fecha venga en UTC", () => {
    // 20:00 UTC del miércoles son las 17:00 en Chile (horario de verano, UTC-3): todavía no es hora punta
    expect(esHoraPunta(new Date("2026-10-21T20:00:00Z"))).toBe(false);
    expect(esHoraPunta(new Date("2026-10-21T21:00:00Z"))).toBe(true);
  });
});
