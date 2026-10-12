import { Router } from "express";
import { db } from "../db.ts";
import { requiereSesion, usuarioDeSesion } from "../middlewares/sesion.ts";
import { disponibilidadDelDia } from "../servicios/reservas.ts";
import { esquemaFecha } from "../validacion/reservas.ts";

// Rutas de /api/recursos (las canchas). Todas piden sesión.
export function crearRutasRecursos() {
  const rutas = Router();

  rutas.use(requiereSesion);

  // Las canchas que se pueden reservar
  rutas.get("/", async (_req, res) => {
    const recursos = await db.recurso.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    });

    res.json({ recursos });
  });

  // La grilla de un día: cada bloque dice si está libre, ocupado, si es mío o si ya pasó
  rutas.get("/:id/disponibilidad", async (req, res) => {
    const { fecha } = esquemaFecha.parse(req.query);
    const bloques = await disponibilidadDelDia(req.params.id, fecha, usuarioDeSesion(req).id);

    res.json({ fecha, bloques });
  });

  return rutas;
}
