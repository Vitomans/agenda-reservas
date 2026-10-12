import { Router } from "express";
import { requiereSesion, usuarioDeSesion } from "../middlewares/sesion.ts";
import { cancelarReserva, crearReserva, reservasProximas } from "../servicios/reservas.ts";
import { esquemaNuevaReserva } from "../validacion/reservas.ts";

// Rutas de /api/reservas. Todas piden sesión.
export function crearRutasReservas() {
  const rutas = Router();

  rutas.use(requiereSesion);

  // Reservar un bloque: 201 si se pudo, 409 si ya está ocupado
  rutas.post("/", async (req, res) => {
    const { recursoId, inicio } = esquemaNuevaReserva.parse(req.body);
    const reserva = await crearReserva(usuarioDeSesion(req).id, recursoId, inicio);

    res.status(201).json({ reserva });
  });

  // Mis próximas reservas
  rutas.get("/mias", async (req, res) => {
    const reservas = await reservasProximas(usuarioDeSesion(req).id);

    res.json({ reservas });
  });

  // Cancelar una reserva (la puede cancelar su dueño o un admin)
  rutas.delete("/:id", async (req, res) => {
    await cancelarReserva(req.params.id, usuarioDeSesion(req));

    res.status(204).end();
  });

  return rutas;
}
