import { Router } from "express";
import { requiereSesion, soloRoles, usuarioDeSesion } from "../middlewares/sesion.ts";
import { cancelarReserva, crearReserva, reservasProximas } from "../servicios/reservas.ts";
import type { Avisador } from "../tiempoReal.ts";
import { esquemaNuevaReserva } from "../validacion/reservas.ts";

// Rutas de /api/reservas. Todas piden sesión.
// Reservar y "mis reservas" son solo para clientes: el admin gestiona desde /api/admin.
// Después de reservar o cancelar, se avisa en vivo a quienes miran esa cancha.
export function crearRutasReservas(avisador: Avisador) {
  const rutas = Router();

  rutas.use(requiereSesion);

  // Reservar un bloque: 201 si se pudo, 409 si ya está ocupado
  rutas.post("/", soloRoles("CLIENTE"), async (req, res) => {
    const { recursoId, inicio } = esquemaNuevaReserva.parse(req.body);
    const reserva = await crearReserva(usuarioDeSesion(req).id, recursoId, inicio);

    avisador.reservaCreada({ recursoId: reserva.recurso.id, inicio: reserva.inicio });
    res.status(201).json({ reserva });
  });

  // Mis próximas reservas
  rutas.get("/mias", soloRoles("CLIENTE"), async (req, res) => {
    const reservas = await reservasProximas(usuarioDeSesion(req).id);

    res.json({ reservas });
  });

  // Cancelar una reserva (la puede cancelar su dueño o un admin)
  rutas.delete("/:id", async (req, res) => {
    const reserva = await cancelarReserva(req.params.id, usuarioDeSesion(req));

    avisador.reservaCancelada(reserva);
    res.status(204).end();
  });

  return rutas;
}
