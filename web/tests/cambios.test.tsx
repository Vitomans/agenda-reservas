import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvisoDeCambios } from "@/components/reservar/AvisoDeCambios";
import { cambiosEntre, DURACION_AVISO_MS, textoDelCambio, useCambiosEnVivo } from "@/lib/cambios";
import type { Bloque } from "@/lib/tipos";

function bloque(hora: string, estado: Bloque["estado"]): Bloque {
  return { inicio: `2026-10-13T${hora}:00.000Z`, fin: `2026-10-13T${hora}:59.000Z`, hora, estado, precio: 12_000 };
}

describe("cambiosEntre", () => {
  it("avisa las horas que otra persona reservó o liberó", () => {
    const antes = [bloque("18:00", "libre"), bloque("19:00", "ocupado"), bloque("20:00", "libre")];
    const despues = [bloque("18:00", "ocupado"), bloque("19:00", "libre"), bloque("20:00", "libre")];

    expect(cambiosEntre(antes, despues)).toEqual([
      { inicio: antes[0].inicio, hora: "18:00", tipo: "reservada" },
      { inicio: antes[1].inicio, hora: "19:00", tipo: "liberada" },
    ]);
  });

  it("no avisa lo que hace uno mismo ni las horas que pasan", () => {
    const antes = [bloque("18:00", "libre"), bloque("19:00", "mio"), bloque("08:00", "libre")];
    const despues = [bloque("18:00", "mio"), bloque("19:00", "libre"), bloque("08:00", "pasado")];

    expect(cambiosEntre(antes, despues)).toEqual([]);
  });
});

describe("textoDelCambio", () => {
  it("dice qué hora cambió, o cuántas si fueron varias", () => {
    const reservada = { inicio: "a", hora: "19:00", tipo: "reservada" } as const;
    const liberada = { inicio: "b", hora: "15:00", tipo: "liberada" } as const;

    expect(textoDelCambio([reservada])).toBe("Alguien acaba de reservar las 19:00");
    expect(textoDelCambio([liberada])).toBe("Se acaba de liberar la hora de las 15:00");
    expect(textoDelCambio([reservada, liberada])).toBe("Se actualizaron 2 horarios");
    expect(textoDelCambio([])).toBeNull();
  });
});

describe("useCambiosEnVivo", () => {
  const antes = [bloque("18:00", "libre"), bloque("19:00", "libre")];
  const despues = [bloque("18:00", "libre"), bloque("19:00", "ocupado")];

  function usarCambios() {
    return renderHook(({ bloques, clave }) => useCambiosEnVivo(bloques, clave), {
      initialProps: { bloques: antes as Bloque[] | undefined, clave: "cancha-1|2026-10-13" },
    });
  }

  it("cuando llegan horarios nuevos de lo mismo que se mira, devuelve lo que cambió", () => {
    const { result, rerender } = usarCambios();
    expect(result.current).toEqual([]);

    rerender({ bloques: despues, clave: "cancha-1|2026-10-13" });

    expect(result.current).toEqual([{ inicio: despues[1].inicio, hora: "19:00", tipo: "reservada" }]);
  });

  it("al elegir otra cancha o día no avisa nada, aunque los horarios sean distintos", () => {
    const { result, rerender } = usarCambios();

    rerender({ bloques: undefined, clave: "cancha-2|2026-10-13" }); // mientras carga
    rerender({ bloques: despues, clave: "cancha-2|2026-10-13" });

    expect(result.current).toEqual([]);
  });

  it("borra el aviso después de unos segundos", () => {
    vi.useFakeTimers();
    const { result, rerender } = usarCambios();
    rerender({ bloques: despues, clave: "cancha-1|2026-10-13" });

    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS));

    expect(result.current).toEqual([]);
    vi.useRealTimers();
  });
});

describe("AvisoDeCambios", () => {
  it("muestra el aviso en una región que leen los lectores de pantalla", () => {
    render(<AvisoDeCambios cambios={[{ inicio: "a", hora: "19:00", tipo: "reservada" }]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Alguien acaba de reservar las 19:00");
  });
});
