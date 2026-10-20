import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claves } from "@/lib/consultas";
import { useTiempoReal } from "@/lib/tiempoReal";

type Oyente = (...datos: unknown[]) => void;

// Una conexión de Socket.io de mentira: guarda lo que la página envía
// y deja simular lo que haría el servidor, sin necesitar la API encendida.
class ConexionFalsa {
  connected = false;
  enviados: unknown[][] = [];
  private oyentes = new Map<string, Set<Oyente>>();

  // El "manager" de Socket.io es el que avisa las reconexiones
  io = {
    on: (evento: string, oyente: Oyente) => this.on(`manager:${evento}`, oyente),
    off: (evento: string, oyente: Oyente) => this.off(`manager:${evento}`, oyente),
  };

  on(evento: string, oyente: Oyente) {
    const oyentes = this.oyentes.get(evento) ?? new Set();
    this.oyentes.set(evento, oyentes.add(oyente));
    return this;
  }

  off(evento: string, oyente: Oyente) {
    this.oyentes.get(evento)?.delete(oyente);
    return this;
  }

  emit(...datos: unknown[]) {
    this.enviados.push(datos);
    return this;
  }

  // La conexión de verdad tarda un poco; aquí se simula con conectarse()
  connect() {
    return this;
  }

  disconnect() {
    this.connected = false;
    this.disparar("disconnect");
    return this;
  }

  conectarse() {
    this.connected = true;
    this.disparar("connect");
  }

  disparar(evento: string, ...datos: unknown[]) {
    this.oyentes.get(evento)?.forEach((oyente) => oyente(...datos));
  }
}

let conexion: ConexionFalsa;
vi.mock("socket.io-client", () => ({ io: () => conexion }));

beforeEach(() => {
  conexion = new ConexionFalsa();
});

function usarTiempoReal(recursoIds: string[]) {
  const queryClient = new QueryClient();
  const hook = renderHook(({ ids }) => useTiempoReal(ids), {
    initialProps: { ids: recursoIds },
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
  return { queryClient, ...hook };
}

// Simula que la pestaña se esconde (por ejemplo, al cambiar a otra) o que vuelve a verse
function cambiarVisibilidad(estado: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: estado, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

const grillaCancha1 = [...claves.disponibilidad, "cancha-1", "2026-10-13"];
const grillaCancha2 = [...claves.disponibilidad, "cancha-2", "2026-10-13"];

describe("useTiempoReal", () => {
  it("al conectarse muestra que está en vivo y sigue la cancha", () => {
    const { result } = usarTiempoReal(["cancha-1"]);
    expect(result.current).toBe(false);

    act(() => conexion.conectarse());

    expect(result.current).toBe(true);
    expect(conexion.enviados).toEqual([["canchas:seguir", ["cancha-1"]]]);
  });

  it("al cambiar de cancha le dice al servidor cuál es la nueva", () => {
    const { rerender } = usarTiempoReal(["cancha-1"]);
    act(() => conexion.conectarse());

    rerender({ ids: ["cancha-2"] });

    expect(conexion.enviados.at(-1)).toEqual(["canchas:seguir", ["cancha-2"]]);
  });

  it("cuando llega un aviso, marca como vieja solo la grilla de esa cancha", () => {
    const { queryClient } = usarTiempoReal(["cancha-1"]);
    queryClient.setQueryData(grillaCancha1, []);
    queryClient.setQueryData(grillaCancha2, []);

    act(() => conexion.disparar("reserva:creada", { recursoId: "cancha-1", inicio: "2026-10-13T13:00:00.000Z" }));

    expect(queryClient.getQueryState(grillaCancha1)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(grillaCancha2)?.isInvalidated).toBe(false);
  });

  it("al volver la conexión pide todo de nuevo, por si se perdió algún aviso", () => {
    const { queryClient } = usarTiempoReal(["cancha-1"]);
    queryClient.setQueryData(grillaCancha1, []);
    queryClient.setQueryData(grillaCancha2, []);

    act(() => conexion.disparar("manager:reconnect"));

    expect(queryClient.getQueryState(grillaCancha1)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(grillaCancha2)?.isInvalidated).toBe(true);
  });

  it("con la pestaña escondida corta la conexión, y al volver se conecta y pide todo de nuevo", () => {
    const { queryClient } = usarTiempoReal(["cancha-1"]);
    act(() => conexion.conectarse());
    queryClient.setQueryData(grillaCancha1, []);
    const conectar = vi.spyOn(conexion, "connect");

    act(() => cambiarVisibilidad("hidden"));
    expect(conexion.connected).toBe(false);

    act(() => cambiarVisibilidad("visible"));
    expect(conectar).toHaveBeenCalled();
    expect(queryClient.getQueryState(grillaCancha1)?.isInvalidated).toBe(true);
  });

  it("al salir de la pantalla cierra la conexión", () => {
    const { unmount } = usarTiempoReal(["cancha-1"]);
    act(() => conexion.conectarse());

    unmount();

    expect(conexion.connected).toBe(false);
  });
});
