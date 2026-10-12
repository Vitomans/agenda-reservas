import type { Request, RequestHandler } from "express";
import type { Rol } from "../generated/prisma/enums.ts";
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

// Deja pasar solo a los roles indicados; al resto le responde 403.
// Va después de requiereSesion: primero se revisa quién eres (401) y después qué puedes hacer (403).
export function soloRoles(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(usuarioDeSesion(req).rol)) {
      throw new ErrorHttp(403, "No tienes permiso para hacer esto");
    }
    next();
  };
}
