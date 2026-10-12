import { z } from "zod";

// Reglas para los datos que llegan en el registro y el login.
// Los mensajes están pensados para mostrarlos tal cual en el formulario.

// El email se guarda sin espacios y en minúsculas, así "Ana@Mail.com" y "ana@mail.com" son la misma cuenta
const email = z
  .string({ error: "El email es obligatorio" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "El email no es válido" }));

export const esquemaRegistro = z.object({
  nombre: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 letras" })
    .max(60, { error: "El nombre puede tener como máximo 60 letras" }),
  email,
  password: z
    .string({ error: "La contraseña es obligatoria" })
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
    // bcrypt solo usa los primeros 72 caracteres, así que no se aceptan más largas
    .max(72, { error: "La contraseña puede tener como máximo 72 caracteres" }),
});

export const esquemaLogin = z.object({
  email,
  password: z.string({ error: "La contraseña es obligatoria" }).min(1, { error: "La contraseña es obligatoria" }),
});
