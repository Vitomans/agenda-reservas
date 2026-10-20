import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvisoDeCambios } from "@/components/reservar/AvisoDeCambios";
import { cambiosEntre, DURACION_AVISO_MS, textoDelCambio, useCambiosEnVivo } from "@/lib/cambios";
import type { Casilla } from "@/lib/casillas";
import type { EstadoBloque } from "@/lib/tipos";

const CANCHA_1 = { id: "cancha-1", nombre: "Cancha 1" };
const CANCHA_2 = { id: "cancha-2", nombre: "Cancha 2" };

function casilla(hora: string, estado: EstadoBloque, cancha = CANCHA_1): Casilla {
  return { cancha, inicio: `2026-10-13T${hora}:00.000Z`, fin: `2026-10-13T${hora}:59.000Z`, hora, estado, precio: 12_000 };
}

describe("cambiosEntre", () => {
  it("avisa las horas que otra persona reservó o liberó", () => {
    const antes = [casilla("18:00", "libre"), casilla("19:00", "ocupado"), casilla("20:00", "libre")];
    const despues = [casilla("18:00", "ocupado"), casilla("19:00", "libre"), casilla("20:00", "libre")];

    expect(cambiosEntre(antes, despues)).toEqual([
      { inicio: antes[0].inicio, hora: "18:00", cancha: "Cancha 1", tipo: "reservada" },
      { inicio: antes[1].inicio, hora: "19:00", cancha: "Cancha 1", tipo: "liberada" },
    ]);
  });

  it("no avisa lo que hace uno mismo ni las horas que pasan", () => {
    const antes = [casilla("18:00", "libre"), casilla("19:00", "mio"), casilla("08:00", "libre")];
    const despues = [casilla("18:00", "mio"), casilla("19:00", "libre"), casilla("08:00", "pasado")];

    expect(cambiosEntre(antes, despues)).toEqual([]);
  });

  it("en la vista por hora distingue las canchas de una misma hora", () => {
    const antes = [casilla("19:00", "libre", CANCHA_1), casilla("19:00", "libre", CANCHA_2)];
    const despues = [casilla("19:00", "libre", CANCHA_1), casilla("19:00", "ocupado", CANCHA_2)];

    expect(cambiosEntre(antes, despues)).toEqual([
      { inicio: antes[1].inicio, hora: "19:00", cancha: "Cancha 2", tipo: "reservada" },
    ]);
  });
});

describe("textoDelCambio", () => {
  it("dice qué cancha y qué hora cambió, o cuántas si fueron varias", () => {
    const reservada = { inicio: "a", hora: "19:00", cancha: "Cancha 2", tipo: "reservada" } as const;
    const liberada = { inicio: "b", hora: "15:00", cancha: "Cancha 1", tipo: "liberada" } as const;

    expect(textoDelCambio([reservada])).toBe("Alguien acaba de reservar la Cancha 2 a las 19:00");
    expect(textoDelCambio([liberada])).toBe("Se acaba de liberar la Cancha 1 a las 15:00");
    expect(textoDelCambio([reservada, liberada])).toBe("Se actualizaron 2 horarios");
    expect(textoDelCambio([])).toBeNull();
  });
});

describe("useCambiosEnVivo", () => {
  const antes = [casilla("18:00", "libre"), casilla("19:00", "libre")];
  const despues = [casilla("18:00", "libre"), casilla("19:00", "ocupado")];

  function usarCambios() {
    return renderHook(({ casillas, clave }) => useCambiosEnVivo(casillas, clave), {
      initialProps: { casillas: antes as Casilla[] | undefined, clave: "cancha|cancha-1|2026-10-13" },
    });
  }

  it("cuando llegan horarios nuevos de lo mismo que se mira, devuelve lo que cambió", () => {
    const { result, rerender } = usarCambios();
    expect(result.current).toEqual([]);

    rerender({ casillas: despues, clave: "cancha|cancha-1|2026-10-13" });

    expect(result.current).toEqual([{ inicio: despues[1].inicio, hora: "19:00", cancha: "Cancha 1", tipo: "reservada" }]);
  });

  it("al elegir otra cancha o día no avisa nada, aunque los horarios sean distintos", () => {
    const { result, rerender } = usarCambios();

    rerender({ casillas: undefined, clave: "cancha|cancha-2|2026-10-13" }); // mientras carga
    rerender({ casillas: despues, clave: "cancha|cancha-2|2026-10-13" });

    expect(result.current).toEqual([]);
  });

  it("borra el aviso después de unos segundos", () => {
    vi.useFakeTimers();
    const { result, rerender } = usarCambios();
    rerender({ casillas: despues, clave: "cancha|cancha-1|2026-10-13" });

    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS));

    expect(result.current).toEqual([]);
    vi.useRealTimers();
  });
});

describe("AvisoDeCambios", () => {
  it("muestra el aviso en una región que leen los lectores de pantalla", () => {
    render(<AvisoDeCambios cambios={[{ inicio: "a", hora: "19:00", cancha: "Cancha 1", tipo: "reservada" }]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Alguien acaba de reservar la Cancha 1 a las 19:00");
  });
});
