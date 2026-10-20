import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TarjetasDelResumen } from "@/components/admin/ResumenDelDia";

describe("TarjetasDelResumen", () => {
  it("muestra la ocupación, los ingresos y la hora más pedida", () => {
    render(
      <TarjetasDelResumen
        resumen={{
          fecha: "2026-10-21",
          dia: { reservas: 23, ingresos: 320_000, horasDelDia: 60, ocupacion: 23 / 60 },
          semana: { desde: "2026-10-19", hasta: "2026-10-25", reservas: 150, ingresos: 2_100_000 },
          horaMasPedida: { hora: "19:00", reservas: 25 },
        }}
      />,
    );

    expect(screen.getByText("38 %")).toBeInTheDocument();
    expect(screen.getByText("23 de 60 horas reservadas")).toBeInTheDocument();
    expect(screen.getByText("$320.000")).toBeInTheDocument();
    expect(screen.getByText("$2.100.000")).toBeInTheDocument();
    expect(screen.getByText("150 reservas, del 19 al 25 de octubre")).toBeInTheDocument();
    expect(screen.getByText("19:00")).toBeInTheDocument();
  });

  it("mientras carga, las tarjetas ya están en su lugar", () => {
    render(<TarjetasDelResumen resumen={undefined} />);

    expect(screen.getByText("Ocupación del día")).toBeInTheDocument();
    expect(screen.getAllByText("Cargando…")).toHaveLength(4);
  });
});
