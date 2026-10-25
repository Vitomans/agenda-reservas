import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PronosticoDelChat } from "@/components/asistente/PronosticoDelChat";
import type { PronosticoDelChat as Pronostico } from "@/lib/tipos";

const SABADO: Pronostico = {
  tramos: [
    { desde: "19:00", hasta: "20:00", cielo: "parcial", descripcion: "parcialmente nublado", deNoche: false, minima: 18, maxima: 18 },
    { desde: "20:00", hasta: "23:00", cielo: "lluvia-ligera", descripcion: "lluvia ligera", deNoche: true, minima: 15, maxima: 17 },
  ],
};

function dibujar(pronostico: Pronostico) {
  return render(<PronosticoDelChat pedido={{ fecha: "2026-10-24", desde: 19 }} pronostico={pronostico} />);
}

describe("PronosticoDelChat", () => {
  it("muestra el tiempo del día por tramos, con la temperatura y de dónde sale", () => {
    dibujar(SABADO);

    const tarjeta = screen.getByRole("group", { name: "Pronóstico del sábado 24 de octubre" });
    const [nublado, lluvia] = within(tarjeta).getAllByRole("listitem");
    expect(nublado).toHaveTextContent("parcialmente nublado19:00 a 20:0018 °C");
    expect(lluvia).toHaveTextContent("lluvia ligera20:00 a 23:0015 a 17 °C");
    expect(within(tarjeta).getByText(/Las canchas son al aire libre: con lluvia no se juega/)).toBeInTheDocument();
    expect(within(tarjeta).getByRole("link", { name: "Datos de MET Norway" })).toHaveAttribute("href", "https://www.met.no/en");
  });

  it("si no hay pronóstico, no muestra nada: el asistente lo explica con palabras", () => {
    const { container } = dibujar({ tramos: [], aviso: "El pronóstico no está disponible en este momento." });

    expect(container).toBeEmptyDOMElement();
  });
});
