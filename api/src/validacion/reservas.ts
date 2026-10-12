import { z } from "zod";

// "?fecha=2026-10-13", en la disponibilidad y en las reservas del día del admin
export const esquemaFecha = z.object({
  fecha: z.iso.date({ error: "La fecha es obligatoria y debe tener el formato AAAA-MM-DD" }),
});

// POST /api/reservas. "inicio" es el que viene en cada bloque de la disponibilidad.
export const esquemaNuevaReserva = z.object({
  recursoId: z.string({ error: "Falta la cancha" }).min(1, { error: "Falta la cancha" }),
  inicio: z.iso
    .datetime({ offset: true, error: "El inicio debe ser una fecha y hora en formato ISO" })
    .transform((texto) => new Date(texto)),
});
