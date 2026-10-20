import { describe, expect, it } from "vitest";
import {
  describirHorario,
  diaCortoEnElClub,
  diaLargo,
  horaEnElClub,
  nombreDelDia,
  numeroDelDia,
  rangoDeDias,
  sumarDias,
} from "@/lib/fechas";

const CHILE = "America/Santiago";

describe("sumarDias", () => {
  it("pasa bien de un mes a otro y de un año a otro", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("nombres de los días", () => {
  it('dice "Hoy", "Mañana" o el día de la semana abreviado', () => {
    expect(nombreDelDia("2026-10-12", "2026-10-12")).toBe("Hoy");
    expect(nombreDelDia("2026-10-13", "2026-10-12")).toBe("Mañana");
    expect(nombreDelDia("2026-10-14", "2026-10-12")).toBe("mié");
  });

  it("muestra el número y el nombre largo del día", () => {
    expect(numeroDelDia("2026-10-04")).toBe("4");
    expect(diaLargo("2026-10-14")).toBe("miércoles 14 de octubre");
  });
});

describe("horas en el club", () => {
  it("muestra en hora de Chile una fecha que llega en UTC", () => {
    // 22:00 en UTC son las 19:00 en Chile (UTC-3 en octubre)
    expect(horaEnElClub("2026-10-13T22:00:00.000Z", CHILE)).toBe("19:00");
    expect(describirHorario("2026-10-13T22:00:00.000Z", "2026-10-13T23:00:00.000Z", CHILE)).toBe(
      "mar 13 oct · 19:00 a 20:00",
    );
  });

  it("usa el día del club, aunque en UTC ya sea el día siguiente", () => {
    // 02:30 del 14 en UTC todavía son las 23:30 del 13 en Chile
    expect(diaCortoEnElClub("2026-10-14T02:30:00.000Z", CHILE)).toBe("mar 13 oct");
  });
});

describe("rangoDeDias", () => {
  it("escribe el mes una vez si los dos días son del mismo mes", () => {
    expect(rangoDeDias("2026-10-19", "2026-10-25")).toBe("19 al 25 de octubre");
    expect(rangoDeDias("2026-09-28", "2026-10-04")).toBe("28 de septiembre al 4 de octubre");
  });
});
