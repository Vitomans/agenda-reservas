import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorApi, pedirApi } from "@/lib/api";

// En estos tests no hay API de verdad: se reemplaza fetch por una función falsa (vi.fn)
// que devuelve la respuesta que cada test necesita.
function simularRespuesta(status: number, cuerpo?: unknown) {
  const fetchFalso = vi.fn().mockResolvedValue(
    new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status }),
  );
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pedirApi", () => {
  it("devuelve los datos que manda la API", async () => {
    const fetchFalso = simularRespuesta(200, { recursos: [{ id: "1", nombre: "Cancha 1" }] });

    const datos = await pedirApi("/recursos");

    expect(datos).toEqual({ recursos: [{ id: "1", nombre: "Cancha 1" }] });
    expect(fetchFalso).toHaveBeenCalledWith("/api/recursos", expect.objectContaining({ method: "GET" }));
  });

  it("manda el cuerpo como JSON", async () => {
    const fetchFalso = simularRespuesta(201, { reserva: {} });

    await pedirApi("/reservas", { metodo: "POST", cuerpo: { recursoId: "1", inicio: "2026-10-13T22:00:00.000Z" } });

    expect(fetchFalso).toHaveBeenCalledWith("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recursoId: "1", inicio: "2026-10-13T22:00:00.000Z" }),
    });
  });

  it("acepta respuestas sin contenido (204)", async () => {
    simularRespuesta(204);

    await expect(pedirApi("/reservas/1", { metodo: "DELETE" })).resolves.toBeNull();
  });

  it("lanza un ErrorApi con el código, el mensaje y los errores por campo", async () => {
    simularRespuesta(400, { error: "Datos inválidos", detalles: { email: ["El email no es válido"] } });

    const error = await pedirApi("/auth/login", { metodo: "POST", cuerpo: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({
      status: 400,
      message: "Datos inválidos",
      detalles: { email: ["El email no es válido"] },
    });
  });

  it("usa un mensaje genérico si la respuesta de error no trae uno", async () => {
    simularRespuesta(502);

    await expect(pedirApi("/recursos")).rejects.toMatchObject({ status: 502, message: "Algo salió mal. Intenta de nuevo." });
  });

  it("avisa si no hay conexión con el servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(pedirApi("/recursos")).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/conectar/) });
  });
});
