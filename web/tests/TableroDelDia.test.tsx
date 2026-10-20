import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableroDelDia } from "@/components/admin/TableroDelDia";
import type { ReservaAdmin } from "@/lib/tipos";

const CANCHAS = [
  { id: "c1", nombre: "Cancha 1" },
  { id: "c2", nombre: "Cancha 2" },
];
const HORAS = ["18:00", "19:00"];

// El 13 de octubre de 2026, las 22:00 UTC son las 19:00 en Chile
function reserva(recursoId: string, nombre: string, estado: ReservaAdmin["estado"]): ReservaAdmin {
  return {
    id: `${recursoId}-${nombre}`,
    inicio: "2026-10-13T22:00:00.000Z",
    fin: "2026-10-13T23:00:00.000Z",
    estado,
    precio: 16_000,
    recurso: CANCHAS.find((cancha) => cancha.id === recursoId)!,
    usuario: { id: nombre, nombre, email: `${nombre}@example.com` },
  };
}

function dibujar({ dia = "2026-10-13", hoy = "2026-10-12" } = {}) {
  render(
    <TableroDelDia
      dia={dia}
      hoy={hoy}
      canchas={CANCHAS}
      reservas={[reserva("c1", "Camila Rojas", "CONFIRMADA"), reserva("c2", "Beto Soto", "CANCELADA")]}
      horas={HORAS}
      zonaHoraria="America/Santiago"
      ahora={Date.now()}
    />,
  );
}

describe("TableroDelDia", () => {
  it("tiene una columna por cancha y una fila por hora", () => {
    dibujar();

    expect(screen.getAllByRole("columnheader").map((celda) => celda.textContent)).toEqual(["Hora", "Cancha 1", "Cancha 2"]);
    expect(screen.getAllByRole("rowheader").map((celda) => celda.textContent)).toEqual(HORAS);
  });

  it("muestra quién reservó cada hora y cuánto pagó, sin las reservas canceladas", () => {
    dibujar();

    const [cancha1, cancha2] = within(screen.getByRole("row", { name: /^19:00/ })).getAllByRole("cell");
    expect(cancha1).toHaveTextContent("Camila Rojas");
    expect(cancha1).toHaveTextContent("$16.000");
    expect(cancha2).toHaveTextContent("Libre");
  });

  it("muestra más claras las horas de un día que ya pasó", () => {
    dibujar({ dia: "2026-10-13", hoy: "2026-10-14" });

    for (const fila of screen.getAllByRole("row").slice(1)) {
      expect(fila).toHaveClass("opacity-50");
    }
  });
});
