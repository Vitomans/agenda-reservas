import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BarraParaReservar } from "@/components/reservar/BarraParaReservar";
import type { Casilla } from "@/lib/casillas";

const CASILLA: Casilla = {
  cancha: { id: "cancha-2", nombre: "Cancha 2" },
  inicio: "2026-10-25T22:00:00.000Z", // 19:00 en Chile
  fin: "2026-10-25T23:00:00.000Z",
  hora: "19:00",
  precio: 16_000,
  estado: "libre",
};

function dibujar(props: Partial<Parameters<typeof BarraParaReservar>[0]> = {}) {
  const onReservar = vi.fn();
  render(
    <BarraParaReservar
      casilla={CASILLA}
      dia="2026-10-25"
      zonaHoraria="America/Santiago"
      conSesion
      cargando={false}
      onReservar={onReservar}
      onCancelar={() => {}}
      {...props}
    />,
  );
  return { onReservar };
}

describe("BarraParaReservar", () => {
  it("muestra la cancha, el día, el horario y el precio", () => {
    dibujar();

    expect(screen.getByText("Cancha 2 · domingo 25 de octubre")).toBeInTheDocument();
    expect(screen.getByText("19:00 a 20:00 · $16.000")).toBeInTheDocument();
  });

  it("con sesión, reserva con un toque", async () => {
    const { onReservar } = dibujar();

    await userEvent.click(screen.getByRole("button", { name: "Reservar" }));

    expect(onReservar).toHaveBeenCalled();
  });

  it("sin sesión, ofrece reservar como invitado o iniciar sesión", () => {
    dibujar({ conSesion: false });

    expect(screen.getByRole("button", { name: "Reservar como invitado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicia sesión" })).toHaveAttribute("href", "/login");
  });

  it("en la vista por hora deja cambiar de cancha", async () => {
    const onElegirCancha = vi.fn();
    dibujar({
      canchasLibres: [CASILLA.cancha, { id: "cancha-4", nombre: "Cancha 4" }],
      onElegirCancha,
    });

    expect(screen.getByRole("button", { name: "Cancha 2" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Cancha 4" }));

    expect(onElegirCancha).toHaveBeenCalledWith("cancha-4");
  });

  it("con pronóstico, muestra el tiempo que hará a esa hora y de dónde sale", () => {
    dibujar({ pronostico: { hora: "19:00", grados: 18, cielo: "lluvia-ligera", descripcion: "lluvia ligera", deNoche: false } });

    // El lector de pantalla lo lee como "Pronóstico: 18 °C · lluvia ligera"
    expect(screen.getByText("Pronóstico:", { exact: false }).parentElement).toHaveTextContent("Pronóstico: 18 °C · lluvia ligera");
    expect(screen.getByRole("link", { name: "Datos de MET Norway" })).toHaveAttribute("href", "https://www.met.no/en");
  });

  it("sin pronóstico, la barra sigue igual", () => {
    dibujar();

    expect(screen.queryByText(/°C/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Datos de MET Norway" })).not.toBeInTheDocument();
  });
});
