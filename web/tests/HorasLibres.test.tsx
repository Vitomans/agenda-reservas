import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HorasLibres } from "@/components/asistente/HorasLibres";
import type { HorariosLibres } from "@/lib/tipos";

const VIERNES: HorariosLibres = {
  horas: [
    { hora: "19:00", precio: 16_000, canchas: ["Cancha 2", "Cancha 4"] },
    { hora: "21:00", precio: 16_000, canchas: ["Cancha 1"] },
  ],
  tusReservas: [],
};

function dibujar(horarios: HorariosLibres, { deshabilitado = false } = {}) {
  const onPedir = vi.fn();
  const { container } = render(
    <HorasLibres pedido={{ fecha: "2026-10-23", desde: 19 }} horarios={horarios} onPedir={onPedir} deshabilitado={deshabilitado} />,
  );
  return { onPedir, container };
}

describe("HorasLibres", () => {
  it("muestra cada hora libre como un botón, con su precio y cuántas canchas quedan", () => {
    dibujar(VIERNES);

    expect(screen.getByRole("group", { name: "Libres el viernes 23 de octubre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "19:00, 2 canchas libres, $16.000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "21:00, 1 cancha libre, $16.000" })).toBeInTheDocument();
  });

  it("al tocar una hora, la pide", async () => {
    const { onPedir } = dibujar(VIERNES);

    await userEvent.click(screen.getByRole("button", { name: /^21:00/ }));

    expect(onPedir).toHaveBeenCalledWith("21:00");
  });

  it("mientras el asistente responde, las horas no se pueden tocar", () => {
    dibujar(VIERNES, { deshabilitado: true });

    for (const boton of screen.getAllByRole("button")) {
      expect(boton).toBeDisabled();
    }
  });

  it("no dibuja nada si no hay horas libres o si hay un aviso: eso lo explica el asistente", () => {
    expect(dibujar({ horas: [], tusReservas: ["20:00"] }).container).toBeEmptyDOMElement();
    expect(dibujar({ ...VIERNES, aviso: "Ese día no se puede reservar" }).container).toBeEmptyDOMElement();
  });
});
