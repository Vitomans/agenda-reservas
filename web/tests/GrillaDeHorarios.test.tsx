import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GrillaDeHorarios } from "@/components/reservar/GrillaDeHorarios";
import type { Bloque } from "@/lib/tipos";

function bloque(hora: string, estado: Bloque["estado"]): Bloque {
  return { inicio: `2026-10-13T${hora}:00.000Z`, fin: `2026-10-13T${hora}:59.000Z`, hora, estado, precio: 12_000 };
}

const BLOQUES = [bloque("08:00", "pasado"), bloque("09:00", "libre"), bloque("10:00", "ocupado"), bloque("11:00", "mio")];

describe("GrillaDeHorarios", () => {
  it("muestra cada hora con su estado", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={null} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: "08:00, Ya pasó" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "09:00, Libre, $12.000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:00, Ocupado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "11:00, Tu reserva" })).toBeInTheDocument();
  });

  it("en las horas libres muestra el precio", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={null} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: /09:00/ })).toHaveTextContent("$12.000");
    expect(screen.getByRole("button", { name: /10:00/ })).not.toHaveTextContent("$");
  });

  it("solo deja elegir las horas libres", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={null} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: /09:00/ })).toBeEnabled();
    for (const hora of ["08:00", "10:00", "11:00"]) {
      expect(screen.getByRole("button", { name: new RegExp(hora) })).toBeDisabled();
    }
  });

  it("avisa qué hora se eligió al tocarla", async () => {
    const onElegir = vi.fn();
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={null} onElegir={onElegir} />);

    await userEvent.click(screen.getByRole("button", { name: /09:00/ }));

    expect(onElegir).toHaveBeenCalledWith(BLOQUES[1]);
  });

  it("marca la hora elegida", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={BLOQUES[1].inicio} onElegir={() => {}} />);

    const elegido = screen.getByRole("button", { name: "09:00, Elegido, $12.000" });
    expect(elegido).toHaveAttribute("aria-pressed", "true");
  });

  it("resalta las horas que otra persona acaba de cambiar", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={null} onElegir={() => {}} resaltados={[BLOQUES[2].inicio]} />);

    expect(screen.getByRole("button", { name: "10:00, Ocupado" })).toHaveClass("motion-safe:animate-destello");
    expect(screen.getByRole("button", { name: "09:00, Libre, $12.000" })).not.toHaveClass("motion-safe:animate-destello");
  });

  it("si otra persona toma la hora elegida, la muestra ocupada", () => {
    render(<GrillaDeHorarios bloques={BLOQUES} elegido={BLOQUES[2].inicio} onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: "10:00, Ocupado" })).toBeDisabled();
  });
});
