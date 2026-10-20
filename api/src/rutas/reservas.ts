import { Router } from "express";
import type { Cartero } from "../cartero.ts";
import { requiereSesion, soloRoles, usuarioDeSesion } from "../middlewares/sesion.ts";
import { enviarCorreoDeLaReserva, vistaPreviaDelCorreo } from "../servicios/correos.ts";
import { cancelarReserva, crearReserva, reservasProximas } from "../servicios/reservas.ts";
import type { Avisador } from "../tiempoReal.ts";
import { esquemaNuevaReserva } from "../validacion/reservas.ts";

// Rutas de /api/reservas. Todas piden sesión.
// Reservar y "mis reservas" son solo para clientes: el admin gestiona desde /api/admin.
// Después de reservar o cancelar, se avisa en vivo a quienes miran esa cancha y se le manda un correo al jugador.
export function crearRutasReservas(avisador: Avisador, cartero: Cartero) {
  const rutas = Router();

  rutas.use(requiereSesion);

  // Reservar un bloque: 201 si se pudo, 409 si ya está ocupado
  rutas.post("/", soloRoles("CLIENTE"), async (req, res) => {
    const { recursoId, inicio } = esquemaNuevaReserva.parse(req.body);
    const reserva = await crearReserva(usuarioDeSesion(req).id, recursoId, inicio);

    avisador.reservaCreada({ recursoId: reserva.recurso.id, inicio: reserva.inicio });
    res.status(201).json({ reserva });

    // El correo se envía después de responder: si Brevo tarda o falla, el jugador no espera y la reserva igual quedó hecha
    void enviarCorreoDeLaReserva(cartero, reserva.id, { tipo: "confirmada" });
  });

  // Mis próximas reservas
  rutas.get("/mias", soloRoles("CLIENTE"), async (req, res) => {
    const reservas = await reservasProximas(usuarioDeSesion(req).id);

    res.json({ reservas });
  });

  // El correo de confirmación de una reserva, para mostrarlo en la página (su dueño o un admin)
  rutas.get("/:id/correo", async (req, res) => {
    res.json(await vistaPreviaDelCorreo(req.params.id, usuarioDeSesion(req)));
  });

  // Cancelar una reserva (la puede cancelar su dueño o un admin)
  rutas.delete("/:id", async (req, res) => {
    const usuario = usuarioDeSesion(req);
    const reserva = await cancelarReserva(req.params.id, usuario);

    avisador.reservaCancelada(reserva);
    res.status(204).end();

    // Los admins no reservan, así que si cancela un admin, la canceló el club
    void enviarCorreoDeLaReserva(cartero, req.params.id, { tipo: "cancelada", porElClub: usuario.rol === "ADMIN" });
  });

  return rutas;
}
