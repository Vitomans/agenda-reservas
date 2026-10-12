import { z } from "zod";

const nombre = z
  .string({ error: "El nombre es obligatorio" })
  .trim()
  .min(1, { error: "El nombre es obligatorio" })
  .max(50, { error: "El nombre puede tener como máximo 50 letras" });

// POST /api/admin/recursos
export const esquemaNuevoRecurso = z.object({ nombre });

// PATCH /api/admin/recursos/:id. Se manda solo lo que cambia.
// "activo: false" desactiva la cancha: deja de aparecer y no recibe reservas nuevas.
export const esquemaEditarRecurso = z.object({
  nombre: nombre.optional(),
  activo: z.boolean({ error: "Activo debe ser true o false" }).optional(),
});
