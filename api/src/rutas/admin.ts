import { Router } from "express";
import { db, esErrorDePrisma } from "../db.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { requiereSesion, soloRoles } from "../middlewares/sesion.ts";
import { reservasDelDia } from "../servicios/reservas.ts";
import { resumenDelDia } from "../servicios/resumen.ts";
import { esquemaEditarRecurso, esquemaNuevoRecurso } from "../validacion/recursos.ts";
import { esquemaFecha } from "../validacion/reservas.ts";

const DATOS_RECURSO = { id: true, nombre: true, activo: true } as const;

// Rutas de /api/admin. Todas piden sesión (401) y además ser ADMIN (403).
export function crearRutasAdmin() {
  const rutas = Router();

  rutas.use(requiereSesion, soloRoles("ADMIN"));

  // Todas las reservas de un día, de todas las canchas y de todos los clientes
  rutas.get("/reservas", async (req, res) => {
    const { fecha } = esquemaFecha.parse(req.query);
    const reservas = await reservasDelDia(fecha);

    res.json({ fecha, reservas });
  });

  // Los números del día para el dueño: ocupación e ingresos del día y de la semana, y la hora más pedida
  rutas.get("/resumen", async (req, res) => {
    const { fecha } = esquemaFecha.parse(req.query);

    res.json(await resumenDelDia(fecha));
  });

  // Todas las canchas, también las desactivadas (para poder volver a activarlas)
  rutas.get("/recursos", async (_req, res) => {
    const recursos = await db.recurso.findMany({ orderBy: { nombre: "asc" }, select: DATOS_RECURSO });

    res.json({ recursos });
  });

  rutas.post("/recursos", async (req, res) => {
    const { nombre } = esquemaNuevoRecurso.parse(req.body);

    try {
      const recurso = await db.recurso.create({ data: { nombre }, select: DATOS_RECURSO });
      res.status(201).json({ recurso });
    } catch (error) {
      if (esErrorDePrisma(error, "P2002")) {
        throw new ErrorHttp(409, "Ya existe una cancha con ese nombre");
      }
      throw error;
    }
  });

  // Editar o desactivar una cancha. No hay ruta para borrarla: se perdería el historial de reservas.
  // Las reservas que ya tenía una cancha desactivada siguen valiendo; solo deja de recibir nuevas.
  rutas.patch("/recursos/:id", async (req, res) => {
    const cambios = esquemaEditarRecurso.parse(req.body);

    try {
      const recurso = await db.recurso.update({
        where: { id: req.params.id },
        data: cambios,
        select: DATOS_RECURSO,
      });
      res.json({ recurso });
    } catch (error) {
      if (esErrorDePrisma(error, "P2025")) {
        throw new ErrorHttp(404, "La cancha no existe");
      }
      if (esErrorDePrisma(error, "P2002")) {
        throw new ErrorHttp(409, "Ya existe una cancha con ese nombre");
      }
      throw error;
    }
  });

  return rutas;
}
