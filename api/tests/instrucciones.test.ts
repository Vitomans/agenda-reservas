import { afterAll, describe, expect, it } from "vitest";
import { instrucciones } from "../src/asistente/instrucciones.ts";
import { db } from "../src/db.ts";

afterAll(async () => {
  await db.$disconnect();
});

// Jueves 22 de octubre de 2026 a las 15:40 en Chile (en octubre, Chile está 3 horas detrás de UTC)
const JUEVES_EN_LA_TARDE = new Date("2026-10-22T18:40:00Z");

describe("instrucciones del asistente", () => {
  it("dicen el día y la hora del club, no los del servidor", () => {
    expect(instrucciones(JUEVES_EN_LA_TARDE)).toContain("jueves 22 de octubre de 2026, 15:40");
  });

  it("nombran los 7 días que se pueden reservar, con su fecha, para que el modelo entienda 'mañana' o 'el sábado'", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("hoy jueves 22 de octubre (2026-10-22)");
    expect(texto).toContain("mañana viernes 23 de octubre (2026-10-23)");
    expect(texto).toContain("sábado 24 de octubre (2026-10-24)");
    expect(texto).toContain("miércoles 28 de octubre (2026-10-28)");
    expect(texto).not.toContain("2026-10-29");
  });

  it("toman los precios y las reglas de la tarifa y las reglas de la API", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("$12.000");
    expect(texto).toContain("$16.000 en hora punta (de lunes a viernes desde las 18:00");
    expect(texto).toContain("Abre de 08:00 a 23:00");
    expect(texto).toContain("como máximo 2 reservas activas");
  });

  it("piden consultar verHorariosLibres antes de decir si hay cancha, y no repetir las horas que la página muestra", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("Usa verHorariosLibres antes de decir si hay cancha");
    expect(texto).toContain("No las repitas una por una");
    // Las evals encontraron que a "¿Puedo reservar a las 6?" respondía "no hay disponibilidad", sin el horario
    expect(texto).toContain("Si piden una hora en que el club está cerrado, di el horario del club");
  });

  it("piden hablar de 'tú' con ejemplos, porque el modelo a veces escribía 'podés', 'elegí' o 'podís'", () => {
    expect(instrucciones(JUEVES_EN_LA_TARDE)).toContain(
      '"puedes", "quieres", "elige", "toca" (nunca "podés", "querés", "elegí", "tocá", ni el chileno "podís" o "querís")',
    );
  });

  it("piden buscar en la información del club, decir de dónde sale la respuesta y no inventar", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("usa buscarInformacion y responde solo con lo que encuentres");
    expect(texto).toContain("Nombra el documento de donde sale la respuesta");
    // Con "¿tienen sauna?", el modelo respondió "no hay sauna", aunque los documentos solo no lo mencionan
    expect(texto).toContain("di que no tienes esa información, sin decir que el club no lo tiene");
  });

  it("piden reservar y cancelar con las herramientas, y no decir que quedó hecho antes de que la persona confirme", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("Para reservar, usa reservar con el día, la hora y la cancha");
    // Las evals encontraron que preguntaba "¿Quieres que la reserve?" antes de mostrar la tarjeta
    expect(texto).toContain("no le preguntes si quiere: usa reservar");
    expect(texto).toContain("No digas que quedó reservada o cancelada hasta tener el resultado");
    expect(texto).toContain("busca la reserva con verMisReservas y usa cancelarReserva");
    expect(texto).not.toContain("Todavía no puedes reservar");
  });

  it("piden usar verPronostico, avisar que con lluvia no se juega y mencionar el pronóstico al reservar", () => {
    const texto = instrucciones(JUEVES_EN_LA_TARDE);

    expect(texto).toContain("el tiempo para venir a jugar");
    expect(texto).toContain("Para el tiempo, usa verPronostico. Nunca lo inventes.");
    expect(texto).toContain("Las canchas son al aire libre y con lluvia no se juega");
    expect(texto).toContain("la reserva se puede cancelar sin costo hasta que empieza");
    expect(texto).toContain("Si reservar trae el pronóstico, menciónalo en una frase");
  });

  it("pasado medianoche, 'hoy' ya es el día siguiente en el club", () => {
    // 03:30 UTC del viernes 23 son las 00:30 del viernes en Chile
    expect(instrucciones(new Date("2026-10-23T03:30:00Z"))).toContain("hoy viernes 23 de octubre (2026-10-23)");
  });
});
