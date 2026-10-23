import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { CABECERA_CLAVE, CABECERA_IP, CABECERA_PAIS, config, proxy } from "../proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Next.js manda a la API las cabeceras que el puente cambió en "x-middleware-request-<nombre>"
function cabeceraEnviada(respuesta: Response, nombre: string) {
  return respuesta.headers.get(`x-middleware-request-${nombre}`);
}

describe("el puente a la API (proxy.ts)", () => {
  it("corre para /api y /docs, pero no para las páginas", () => {
    const corre = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig, url });

    expect(corre("/api/recursos")).toBe(true);
    expect(corre("/docs")).toBe(true);
    expect(corre("/docs/swagger-ui.css")).toBe(true);
    expect(corre("/")).toBe(false);
    expect(corre("/mis-reservas")).toBe(false);
  });

  it("le pasa el pedido a la API con la misma ruta y consulta", () => {
    const respuesta = proxy(new NextRequest("https://volea.test/api/disponibilidad?fecha=2026-10-25"));

    expect(isRewrite(respuesta)).toBe(true);
    expect(getRewrittenUrl(respuesta)).toBe("http://localhost:4000/api/disponibilidad?fecha=2026-10-25");
  });

  it("agrega la clave de la página, y la IP y el país que anotó Vercel", () => {
    vi.stubEnv("CLAVE_DE_LA_WEB", "clave-secreta");

    const respuesta = proxy(
      new NextRequest("https://volea.test/api/recursos", {
        headers: { "x-real-ip": "203.0.113.7", "x-vercel-ip-country": "CL" },
      }),
    );

    expect(cabeceraEnviada(respuesta, CABECERA_CLAVE)).toBe("clave-secreta");
    expect(cabeceraEnviada(respuesta, CABECERA_IP)).toBe("203.0.113.7");
    expect(cabeceraEnviada(respuesta, CABECERA_PAIS)).toBe("CL");
  });

  it("borra la clave, la IP y el país si el visitante los escribió a mano", () => {
    const respuesta = proxy(
      new NextRequest("https://volea.test/api/auth/login", {
        headers: { [CABECERA_CLAVE]: "inventada", [CABECERA_IP]: "198.51.100.1", [CABECERA_PAIS]: "CL" },
      }),
    );

    // Sin CLAVE_DE_LA_WEB, x-real-ip ni x-vercel-ip-country (como en local), no se manda ninguna de las tres
    const enviadas = respuesta.headers.get("x-middleware-override-headers")?.split(",") ?? [];
    expect(enviadas).not.toContain(CABECERA_CLAVE);
    expect(enviadas).not.toContain(CABECERA_IP);
    expect(enviadas).not.toContain(CABECERA_PAIS);
  });
});
