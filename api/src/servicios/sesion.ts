import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.ts";
import { Rol } from "../generated/prisma/enums.ts";

// La sesión es un token JWT guardado en una cookie.
// El token dice quién es el usuario y su rol, y va firmado con JWT_SECRET:
// si alguien lo modifica, la firma deja de coincidir y el token no sirve.

export const NOMBRE_COOKIE = "sesion";

const DURACION_SEGUNDOS = 60 * 60 * 24; // 1 día

export type UsuarioSesion = {
  id: string;
  rol: Rol;
};

const opcionesCookie: CookieOptions = {
  httpOnly: true, // el JavaScript de la página no la puede leer (protege si alguien inyecta código)
  secure: config.NODE_ENV === "production", // en producción solo viaja por HTTPS
  sameSite: "lax", // el navegador no la manda en pedidos que vienen de otros sitios (protege contra CSRF)
  path: "/",
};

// Crea el token y lo deja en una cookie de la respuesta.
export function iniciarSesion(res: Response, usuario: UsuarioSesion) {
  const token = jwt.sign({ rol: usuario.rol }, config.JWT_SECRET, {
    subject: usuario.id,
    expiresIn: DURACION_SEGUNDOS,
    algorithm: "HS256",
  });

  res.cookie(NOMBRE_COOKIE, token, { ...opcionesCookie, maxAge: DURACION_SEGUNDOS * 1000 });
}

// Le pide al navegador que borre la cookie.
export function cerrarSesion(res: Response) {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie);
}

const esquemaToken = z.object({
  sub: z.string(),
  rol: z.enum(Rol),
});

// Revisa la firma y el vencimiento del token. Devuelve el usuario, o null si el token no sirve.
export function leerToken(token: string): UsuarioSesion | null {
  try {
    // Se acepta solo HS256, para que nadie pueda mandar un token firmado con otro algoritmo
    const datos = esquemaToken.parse(jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] }));
    return { id: datos.sub, rol: datos.rol };
  } catch {
    return null;
  }
}
