import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.ts";
import { hashearPassword } from "./passwords.ts";

// Jugadores invitados: el botón "Jugador demo" de la página crea uno nuevo para cada visitante.
// Si todos compartieran la misma cuenta, uno vería las reservas de otro, y como cada jugador
// puede tener máximo 2 reservas activas, la cuenta quedaría "llena" para el siguiente.

export const DOMINIO_INVITADOS = "@invitados.example.com";

// Lo mismo que dura la sesión: cuando un invitado se borra, su sesión ya venció
const DURACION_INVITADO_MS = 24 * 60 * 60 * 1000;

// Borra los invitados de más de un día, con sus reservas, para que la demo no se llene de datos viejos.
export async function borrarInvitadosVencidos(ahora = new Date()) {
  const vencidos = {
    email: { endsWith: DOMINIO_INVITADOS },
    creadoEn: { lt: new Date(ahora.getTime() - DURACION_INVITADO_MS) },
  };

  // Primero las reservas, porque apuntan al usuario. En una transacción: o se borra todo o nada.
  await db.$transaction([
    db.reserva.deleteMany({ where: { usuario: vencidos } }),
    db.usuario.deleteMany({ where: vencidos }),
  ]);
}

// Crea un jugador invitado nuevo. De paso limpia los vencidos, así no hace falta una tarea programada.
export async function crearInvitado() {
  await borrarInvitadosVencidos();

  const codigo = randomBytes(2).toString("hex").toUpperCase(); // por ejemplo "4F2A"

  return db.usuario.create({
    data: {
      nombre: `Invitado ${codigo}`,
      email: `invitado-${randomUUID()}${DOMINIO_INVITADOS}`,
      // Nadie conoce esta contraseña: a un invitado solo se entra con el botón
      passwordHash: await hashearPassword(randomUUID()),
    },
    select: { id: true, nombre: true, email: true, rol: true },
  });
}
