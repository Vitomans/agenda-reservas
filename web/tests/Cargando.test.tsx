import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cargando, DEMORA_AVISO_SERVIDOR_MS } from "@/components/Aviso";

// Relojes falsos: el test adelanta el tiempo a mano, sin esperar 5 segundos de verdad
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Cargando", () => {
  it("si tarda mucho, avisa que el servidor puede estar despertando", () => {
    render(<Cargando />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(/se duerme cuando nadie la usa/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(DEMORA_AVISO_SERVIDOR_MS);
    });

    expect(screen.getByText(/se duerme cuando nadie la usa/)).toBeInTheDocument();
  });
});
