import { Router } from "express";
import { db } from "../db.ts";
import { sesionOpcional } from "../middlewares/sesion.ts";
import { disponibilidadDelClub, disponibilidadDelDia } from "../servicios/reservas.ts";
import { esquemaFecha } from "../validacion/reservas.ts";

// Rutas de /api/recursos (las canchas). Se ven sin iniciar sesión: así quien visita la página
// mira los horarios antes de decidir si entra. Con sesión, la grilla además marca las reservas propias.
export function crearRutasRecursos() {
  const rutas = Router();

  rutas.use(sesionOpcional);

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
    const bloques = await disponibilidadDelDia(req.params.id, fecha, req.usuario?.id);

    res.json({ fecha, bloques });
  });

  return rutas;
}

// Rutas de /api/disponibilidad: todo el club en un día, hora por hora ("¿A qué hora quieres jugar?").
// También se ve sin sesión.
export function crearRutasDisponibilidad() {
  const rutas = Router();

  rutas.get("/", sesionOpcional, async (req, res) => {
    const { fecha } = esquemaFecha.parse(req.query);
    const horas = await disponibilidadDelClub(fecha, req.usuario?.id);

    res.json({ fecha, horas });
  });

  return rutas;
}
