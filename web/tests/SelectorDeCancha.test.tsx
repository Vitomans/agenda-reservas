import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectorDeCancha } from "@/components/reservar/SelectorDeCancha";

const CANCHAS = [1, 2, 3, 4].map((n) => ({ id: `cancha-${n}`, nombre: `Cancha ${n}` }));

describe("SelectorDeCancha", () => {
  it("muestra todas las canchas y marca la elegida", () => {
    render(<SelectorDeCancha recursos={CANCHAS} elegido="cancha-2" onElegir={() => {}} />);

    const botones = screen.getAllByRole("button");
    expect(botones.map((boton) => boton.textContent)).toEqual(["Cancha 1", "Cancha 2", "Cancha 3", "Cancha 4"]);
    expect(screen.getByRole("button", { name: "Cancha 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("avisa qué cancha se eligió", async () => {
    const onElegir = vi.fn();
    render(<SelectorDeCancha recursos={CANCHAS} elegido="cancha-1" onElegir={onElegir} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancha 4" }));

    expect(onElegir).toHaveBeenCalledWith("cancha-4");
  });
});
