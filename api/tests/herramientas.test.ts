import { afterAll, describe, expect, it } from "vitest";
import { horasLibres, informacionParaLaIA, resumenParaLaIA } from "../src/asistente/herramientas.ts";
import { db } from "../src/db.ts";
import type { EstadoBloque } from "../src/servicios/reservas.ts";

afterAll(async () => {
  await db.$disconnect();
});

// Una hora del club como la devuelve disponibilidadDelClub, con el estado de cada cancha en orden
function horaDelClub(hora: string, precio: 12_000 | 16_000, ...estados: EstadoBloque[]) {
  const inicio = new Date(`2026-10-23T${hora}:00-03:00`);
  return {
    hora,
    precio,
    inicio,
    fin: new Date(inicio.getTime() + 60 * 60 * 1000),
    canchas: estados.map((estado, i) => ({ id: `c${i + 1}`, nombre: `Cancha ${i + 1}`, estado })),
  };
}

const VIERNES = [
  horaDelClub("08:00", 12_000, "pasado", "pasado", "pasado"),
  horaDelClub("18:00", 16_000, "libre", "ocupado", "libre"),
  horaDelClub("19:00", 16_000, "ocupado", "ocupado", "ocupado"),
  horaDelClub("20:00", 16_000, "ocupado", "mio", "libre"),
  horaDelClub("21:00", 16_000, "libre", "libre", "libre"),
];

describe("horasLibres", () => {
  it("deja solo las horas con alguna cancha libre, con su precio y los nombres de esas canchas", () => {
    const { horas } = horasLibres(VIERNES, {});

    expect(horas).toEqual([
      { hora: "18:00", precio: 16_000, canchas: ["Cancha 1", "Cancha 3"] },
      { hora: "21:00", precio: 16_000, canchas: ["Cancha 1", "Cancha 2", "Cancha 3"] },
    ]);
  });

  it("las horas en que la persona ya tiene una reserva van aparte, como en la vista 'Por hora' de la página", () => {
    const { horas, tusReservas } = horasLibres(VIERNES, {});

    expect(tusReservas).toEqual(["20:00"]);
    expect(horas.map((h) => h.hora)).not.toContain("20:00");
  });

  it("'desde' y 'hasta' dejan solo las horas que empiezan entre esas dos, contándolas", () => {
    expect(horasLibres(VIERNES, { desde: 19 }).horas.map((h) => h.hora)).toEqual(["21:00"]);
    expect(horasLibres(VIERNES, { hasta: 18 }).horas.map((h) => h.hora)).toEqual(["18:00"]);
    expect(horasLibres(VIERNES, { desde: 18, hasta: 20 })).toEqual({
      horas: [{ hora: "18:00", precio: 16_000, canchas: ["Cancha 1", "Cancha 3"] }],
      tusReservas: ["20:00"],
    });
  });
});

describe("resumenParaLaIA", () => {
  it("es un texto corto con el día, cada hora libre, su precio y sus canchas", () => {
    const resumen = resumenParaLaIA({ fecha: "2026-10-23", desde: 18 }, horasLibres(VIERNES, { desde: 18 }));

    expect(resumen).toBe(
      [
        "Horas libres el viernes 23 de octubre (2026-10-23) desde las 18:00:",
        "18:00 $16.000: Cancha 1, Cancha 3",
        "21:00 $16.000: Cancha 1, Cancha 2, Cancha 3",
        "La persona ya tiene una reserva ese día a las 20:00.",
      ].join("\n"),
    );
  });

  it("dice cuando no queda nada libre", () => {
    const resumen = resumenParaLaIA({ fecha: "2026-10-23", desde: 19, hasta: 20 }, { horas: [], tusReservas: [] });

    expect(resumen).toBe("No quedan horas libres el viernes 23 de octubre (2026-10-23) desde las 19:00 hasta las 20:00.");
  });

  it("si hay un aviso (por ejemplo, un día que no se puede reservar), le pasa solo el aviso", () => {
    const aviso = "Ese día no se puede reservar: solo desde hoy hasta el miércoles 28 de octubre.";

    expect(resumenParaLaIA({ fecha: "2026-11-15" }, { horas: [], tusReservas: [], aviso })).toBe(aviso);
  });
});

describe("informacionParaLaIA", () => {
  it("le pasa al modelo cada sección con su documento entre corchetes, con el texto tomado del índice", () => {
    const texto = informacionParaLaIA({
      // El documento y la sección que vienen en el resultado son solo para la página: el modelo lee los del índice
      fuentes: [{ id: "servicios#arriendo-de-paletas", documento: "Otro", seccion: "Otra" }],
      forma: "palabras",
    });

    expect(texto).toMatch(/^\[Servicios del club › Arriendo de paletas\]\nSi no tienes paleta, puedes arrendar una/);
    expect(texto).not.toContain("Otro");
  });

  it("separa las secciones con una línea en blanco", () => {
    const texto = informacionParaLaIA({
      fuentes: [
        { id: "servicios#pelotas", documento: "Servicios del club", seccion: "Pelotas" },
        { id: "servicios#estacionamiento", documento: "Servicios del club", seccion: "Estacionamiento" },
      ],
      forma: "significado",
    });

    expect(texto).toContain("$6.000.\n\n[Servicios del club › Estacionamiento]\n");
  });

  it("si no encontró nada, se lo dice al modelo para que no invente", () => {
    expect(informacionParaLaIA({ fuentes: [], forma: "palabras" })).toBe("No hay nada sobre eso en la información del club.");
  });
});
