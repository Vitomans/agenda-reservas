import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { requiereSesion, usuarioDeSesion } from "../middlewares/sesion.ts";
import { compararPassword, hashearPassword } from "../servicios/passwords.ts";
import { cerrarSesion, iniciarSesion } from "../servicios/sesion.ts";
import { esquemaLogin, esquemaRegistro } from "../validacion/auth.ts";

// Datos del usuario que se pueden mandar al cliente. El hash de la contraseña nunca sale de la API.
const DATOS_PUBLICOS = { id: true, nombre: true, email: true, rol: true } as const;

// Rutas de /api/auth. Es una función (y no un router fijo) para que cada app tenga
// su propio contador de intentos: así los tests no se pisan entre ellos.
export function crearRutasAuth() {
  const rutas = Router();

  // Frena a quien intenta adivinar contraseñas: como mucho 20 intentos cada 15 minutos por IP
  const limiteDeIntentos = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." },
  });

  // Crea una cuenta de cliente y deja la sesión iniciada
  rutas.post("/registro", limiteDeIntentos, async (req, res) => {
    const { nombre, email, password } = esquemaRegistro.parse(req.body);

    try {
      // El rol no se lee del pedido: quien se registra siempre es CLIENTE
      const usuario = await db.usuario.create({
        data: { nombre, email, passwordHash: await hashearPassword(password) },
        select: DATOS_PUBLICOS,
      });

      iniciarSesion(res, usuario);
      res.status(201).json({ usuario });
    } catch (error) {
      // P2002 = se rompió una regla de "valor único": ya hay una cuenta con ese email.
      // Se revisa acá (y no antes de crear) para que funcione aunque lleguen dos registros a la vez.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ErrorHttp(409, "Ya existe una cuenta con ese email");
      }
      throw error;
    }
  });

  rutas.post("/login", limiteDeIntentos, async (req, res) => {
    const { email, password } = esquemaLogin.parse(req.body);

    const usuario = await db.usuario.findUnique({ where: { email } });

    // El mismo mensaje si el email no existe o si la contraseña está mal,
    // para no darle pistas a quien intenta adivinar
    if (!usuario || !(await compararPassword(password, usuario.passwordHash))) {
      throw new ErrorHttp(401, "Email o contraseña incorrectos");
    }

    iniciarSesion(res, usuario);
    res.json({ usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  });

  // No pide sesión: así también sirve para limpiar una cookie vencida
  rutas.post("/logout", (_req, res) => {
    cerrarSesion(res);
    res.status(204).end();
  });

  // Devuelve el usuario de la sesión actual. El frontend lo usa al cargar para saber quién entró.
  rutas.get("/yo", requiereSesion, async (req, res) => {
    const usuario = await db.usuario.findUnique({
      where: { id: usuarioDeSesion(req).id },
      select: DATOS_PUBLICOS,
    });

    // El token era válido, pero la cuenta ya no existe
    if (!usuario) {
      cerrarSesion(res);
      throw new ErrorHttp(401, "Tienes que iniciar sesión");
    }

    res.json({ usuario });
  });

  return rutas;
}
