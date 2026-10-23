import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TarjetaDeConfirmacion } from "@/components/asistente/TarjetaDeConfirmacion";

const DESCRIPCION = "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000";

type Props = Parameters<typeof TarjetaDeConfirmacion>[0];

function dibujar(props: Partial<Props> = {}) {
  const onResponder = vi.fn();
  render(
    <TarjetaDeConfirmacion
      accion="reservar"
      estado="pendiente"
      descripcion={DESCRIPCION}
      conSesion
      ocupado={false}
      onResponder={onResponder}
      {...props}
    />,
  );
  return { onResponder };
}

describe("TarjetaDeConfirmacion", () => {
  it("al cancelar pregunta '¿Cancelas esta reserva?', con 'Sí, cancelar' y 'No'", async () => {
    const { onResponder } = dibujar({ accion: "cancelar" });

    expect(screen.getByRole("group", { name: "¿Cancelas esta reserva?" })).toHaveTextContent(DESCRIPCION);
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    expect(onResponder.mock.calls).toEqual([[false], [true]]);
  });

  it("mientras el asistente responde, no deja responder dos veces", () => {
    dibujar({ ocupado: true });

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No, gracias" })).toBeDisabled();
  });

  it("después de responder ya no tiene botones, y dice cómo terminó", () => {
    dibujar({ estado: "no-se-pudo" });

    expect(screen.getByRole("group", { name: "No se pudo hacer la reserva" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
