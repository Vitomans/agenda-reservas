import { type NextRequest, NextResponse } from "next/server";

// El puente entre la página y la API. Todo lo que el navegador pide en /api/... (y la documentación,
// en /docs) se lo pasa a la API, que está en otro servidor. Así, para el navegador, la API está en el
// mismo sitio que la página: la cookie de sesión es "propia" y no hay problemas de CORS.
//
// De paso, le agrega al pedido tres cabeceras: la clave que demuestra que pasó por la página, la IP
// del visitante, que la API usa para el límite de intentos del login (ver api/src/middlewares/soloDesdeLaWeb.ts),
// y su país, porque el asistente no usa Gemini con los visitantes de algunos países (ver api/src/asistente/modelos.ts).

// Dirección de la API. En local es la que levanta "npm run dev" dentro de api/.
// La misma variable la usa la conexión en vivo (lib/tiempoReal.ts).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const CABECERA_CLAVE = "x-clave-de-la-web";
export const CABECERA_IP = "x-ip-del-visitante";
export const CABECERA_PAIS = "x-pais-del-visitante";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cabeceras = new Headers(request.headers);

  // Si el visitante escribió estas cabeceras a mano, se borran: solo las pone el puente
  cabeceras.delete(CABECERA_CLAVE);
  cabeceras.delete(CABECERA_IP);
  cabeceras.delete(CABECERA_PAIS);

  // La clave es secreta: no empieza con NEXT_PUBLIC_, así que nunca llega al navegador
  const clave = process.env.CLAVE_DE_LA_WEB;
  if (clave) cabeceras.set(CABECERA_CLAVE, clave);

  // Vercel anota en x-real-ip la IP desde la que se conectó el visitante, y no deja que nadie la cambie.
  // En local no existe, y la API usa la IP de la conexión.
  const ip = request.headers.get("x-real-ip");
  if (ip) cabeceras.set(CABECERA_IP, ip);

  // Vercel también anota el país del visitante, con un código de dos letras (por ejemplo, "CL")
  const pais = request.headers.get("x-vercel-ip-country");
  if (pais) cabeceras.set(CABECERA_PAIS, pais);

  return NextResponse.rewrite(new URL(`${pathname}${search}`, API_URL), { request: { headers: cabeceras } });
}

// El puente solo corre para estas direcciones; las páginas no pasan por aquí
export const config = {
  matcher: ["/api/:ruta*", "/docs", "/docs/:ruta*"],
};
