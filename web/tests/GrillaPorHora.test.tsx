import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GrillaPorHora } from "@/components/reservar/GrillaPorHora";
import { casillasDelClub } from "@/lib/casillas";
import type { EstadoBloque, HoraDelClub } from "@/lib/tipos";

function hora(texto: string, estados: EstadoBloque[], precio = 16_000): HoraDelClub {
  return {
    inicio: `2026-10-25T${texto}:00.000Z`,
    fin: `2026-10-25T${texto}:59.000Z`,
    hora: texto,
    precio,
    canchas: estados.map((estado, i) => ({ id: `cancha-${i + 1}`, nombre: `Cancha ${i + 1}`, estado })),
  };
}

const HORAS = [
  hora("18:00", ["libre", "ocupado", "libre"]),
  hora("19:00", ["ocupado", "libre", "ocupado"]),
  hora("20:00", ["ocupado", "ocupado", "ocupado"]),
  hora("21:00", ["mio", "libre", "libre"]),
];

describe("GrillaPorHora", () => {
  it("muestra cuántas canchas quedan libres a cada hora, con el precio", () => {
    render(<GrillaPorHora horas={HORAS} elegida={null} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: "18:00, 2 canchas libres, $16.000" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "19:00, 1 cancha libre, $16.000" })).toBeEnabled();
  });

  it("no deja elegir una hora llena ni una en la que ya tienes reserva", () => {
    render(<GrillaPorHora horas={HORAS} elegida={null} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: "20:00, Lleno" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "21:00, Tu reserva" })).toBeDisabled();
  });

  it("avisa qué hora se eligió y la marca", async () => {
    const onElegir = vi.fn();
    const { rerender } = render(<GrillaPorHora horas={HORAS} elegida={null} onElegir={onElegir} />);

    await userEvent.click(screen.getByRole("button", { name: /^19:00/ }));
    expect(onElegir).toHaveBeenCalledWith(HORAS[1]);

    rerender(<GrillaPorHora horas={HORAS} elegida={HORAS[1].inicio} onElegir={onElegir} />);
    expect(screen.getByRole("button", { name: /^19:00/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("casillasDelClub", () => {
  it("convierte cada hora en una casilla por cancha", () => {
    const casillas = casillasDelClub([HORAS[0]]);

    expect(casillas).toHaveLength(3);
    expect(casillas[1]).toEqual({
      cancha: { id: "cancha-2", nombre: "Cancha 2" },
      inicio: HORAS[0].inicio,
      fin: HORAS[0].fin,
      hora: "18:00",
      precio: 16_000,
      estado: "ocupado",
    });
  });
});
