import type { Request, RequestHandler } from "express";
import { leerToken, NOMBRE_COOKIE, type UsuarioSesion } from "../servicios/sesion.ts";
import { ErrorHttp } from "./errores.ts";

// Le agrega a "req" el usuario de la sesión, para que TypeScript lo conozca.
declare module "express-serve-static-core" {
  interface Request {
    usuario?: UsuarioSesion;
  }
}

// Protege una ruta: si no hay una sesión válida responde 401 y la ruta no se ejecuta.
export const requiereSesion: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[NOMBRE_COOKIE];
  const usuario = typeof token === "string" ? leerToken(token) : null;

  if (!usuario) {
    throw new ErrorHttp(401, "Tienes que iniciar sesión");
  }

  req.usuario = usuario;
  next();
};

// Devuelve el usuario de la sesión. Se usa dentro de las rutas protegidas con requiereSesion.
export function usuarioDeSesion(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw new ErrorHttp(401, "Tienes que iniciar sesión");
  }
  return req.usuario;
}
