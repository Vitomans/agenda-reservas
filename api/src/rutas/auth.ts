import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db, esErrorDePrisma } from "../db.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { sesionOpcional } from "../middlewares/sesion.ts";
import { crearInvitado } from "../servicios/invitados.ts";
import { compararPassword, hashearPassword } from "../servicios/passwords.ts";
import { cerrarSesion, iniciarSesion, NOMBRE_COOKIE } from "../servicios/sesion.ts";
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
      if (esErrorDePrisma(error, "P2002")) {
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

  // Entra como un jugador invitado nuevo (el botón "Jugador demo" de la página).
  // Lleva el límite de intentos para que nadie llene la base de datos creando invitados.
  rutas.post("/invitado", limiteDeIntentos, async (_req, res) => {
    const usuario = await crearInvitado();

    iniciarSesion(res, usuario);
    res.status(201).json({ usuario });
  });

  // No pide sesión: así también sirve para limpiar una cookie vencida
  rutas.post("/logout", (_req, res) => {
    cerrarSesion(res);
    res.status(204).end();
  });

  // Devuelve el usuario de la sesión actual, o null si nadie entró. El frontend lo usa al cargar para saber quién entró.
  // Sin sesión responde 200 y no 401: entrar a la página sin haber iniciado sesión es normal, no un error.
  rutas.get("/yo", sesionOpcional, async (req, res) => {
    const usuario = req.usuario
      ? await db.usuario.findUnique({ where: { id: req.usuario.id }, select: DATOS_PUBLICOS })
      : null;

    // Si llegó una cookie que no sirve (vencida, editada o de una cuenta que ya no existe), se borra
    if (!usuario && req.cookies?.[NOMBRE_COOKIE]) {
      cerrarSesion(res);
    }

    res.json({ usuario });
  });

  return rutas;
}
