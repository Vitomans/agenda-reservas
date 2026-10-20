import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VistaDelCorreo } from "@/components/VistaDelCorreo";

// jsdom no trae showModal ni close de <dialog>: aquí se imitan
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrar(respuesta: { para: string; asunto: string; html: string; seEnvia: boolean }, onCerrar = () => {}) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(respuesta)));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VistaDelCorreo reservaId="reserva-1" onCerrar={onCerrar} />
    </QueryClientProvider>,
  );
}

const CORREO = { para: "ana@correo.cl", asunto: "Reserva confirmada: Cancha 1", html: "<p>Hola</p>", seEnvia: true };

describe("VistaDelCorreo", () => {
  it("muestra el correo en un marco aislado y a quién se envió", async () => {
    mostrar(CORREO);

    const marco = await screen.findByTitle("Vista previa del correo");
    expect(marco).toHaveAttribute("srcdoc", "<p>Hola</p>");
    // Sin "allow-scripts": el HTML del correo no puede ejecutar código
    expect(marco.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(screen.getByText("Te lo enviamos a ana@correo.cl.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/reservas/reserva-1/correo", expect.anything());
  });

  it("a un jugador demo le explica que no se envió", async () => {
    mostrar({ ...CORREO, seEnvia: false });

    expect(await screen.findByText(/Este correo no se envió/)).toBeInTheDocument();
  });

  it("se cierra con el botón", async () => {
    const onCerrar = vi.fn();
    mostrar(CORREO, onCerrar);

    await userEvent.click(await screen.findByRole("button", { name: "Cerrar" }));

    expect(onCerrar).toHaveBeenCalled();
  });
});
