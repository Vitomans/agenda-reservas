import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FuentesDelClub } from "@/components/asistente/FuentesDelClub";

describe("FuentesDelClub", () => {
  it("muestra cada sección que leyó el asistente, con su documento", () => {
    render(
      <FuentesDelClub
        informacion={{
          fuentes: [
            { id: "servicios#arriendo-de-paletas", documento: "Servicios del club", seccion: "Arriendo de paletas" },
            { id: "clases#clases-grupales", documento: "Clases de pádel", seccion: "Clases grupales" },
          ],
          forma: "significado",
        }}
      />,
    );

    const lista = screen.getByRole("list", { name: "Consultó la información del club:" });
    expect(lista).toHaveTextContent("Servicios del club · Arriendo de paletas");
    expect(lista).toHaveTextContent("Clases de pádel · Clases grupales");
  });

  it("si no encontró nada, no muestra nada (el asistente lo dice con palabras)", () => {
    const { container } = render(<FuentesDelClub informacion={{ fuentes: [], forma: "palabras" }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
