import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioLogin } from "@/components/acceso/FormularioLogin";
import { claves } from "@/lib/consultas";

// Como en api.test.ts, no hay API de verdad: fetch es una función falsa
function simularRespuesta(status: number, cuerpo: unknown) {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function dibujarFormulario() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <FormularioLogin />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FormularioLogin", () => {
  it("\"Jugador demo\" crea un jugador nuevo para el visitante y deja la sesión iniciada", async () => {
    const invitado = { id: "1", nombre: "Invitado 4F2A", email: "invitado-1@invitados.example.com", rol: "CLIENTE" };
    const fetchFalso = simularRespuesta(201, { usuario: invitado });
    const queryClient = dibujarFormulario();

    await userEvent.click(screen.getByRole("button", { name: "Jugador demo" }));

    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/invitado", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(queryClient.getQueryData(claves.sesion)).toEqual(invitado));
  });

  it("\"Admin demo\" entra con la cuenta de admin de demostración", async () => {
    const fetchFalso = simularRespuesta(200, { usuario: { id: "2", rol: "ADMIN" } });
    dibujarFormulario();

    await userEvent.click(screen.getByRole("button", { name: "Admin demo" }));

    expect(fetchFalso).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "admin@example.com", password: "demo1234" }) }),
    );
  });

  it("muestra el error si no se pudo entrar como jugador demo", async () => {
    simularRespuesta(429, { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." });
    dibujarFormulario();

    await userEvent.click(screen.getByRole("button", { name: "Jugador demo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });
});
