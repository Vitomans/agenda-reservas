import { db, esErrorDePrisma } from "../db.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import {
  bloquesDelDia,
  DIAS_DE_ANTICIPACION,
  diaEnElClub,
  diasReservables,
  esInicioDeBloque,
  limitesDelDia,
} from "./horario.ts";
import type { UsuarioSesion } from "./sesion.ts";

// Reglas de negocio de las reservas. Las rutas solo leen el pedido y llaman a estas funciones.

export const MAXIMO_RESERVAS_ACTIVAS = 2;

const UNA_HORA_MS = 60 * 60 * 1000;

// Cómo se ve cada bloque en la grilla para quien la mira
export type EstadoBloque = "libre" | "ocupado" | "mio" | "pasado";

// Datos de una reserva que se mandan al cliente
const DATOS_RESERVA = {
  id: true,
  inicio: true,
  fin: true,
  estado: true,
  recurso: { select: { id: true, nombre: true } },
} as const;

async function revisarQueLaCanchaExista(recursoId: string) {
  const recurso = await db.recurso.findFirst({ where: { id: recursoId, activo: true } });
  if (!recurso) {
    throw new ErrorHttp(404, "La cancha no existe");
  }
}

function revisarQueElDiaSeaReservable(fecha: string) {
  if (!diasReservables().includes(fecha)) {
    throw new ErrorHttp(400, `Solo se pueden ver y reservar los próximos ${DIAS_DE_ANTICIPACION} días`);
  }
}

// La grilla de un día: cada bloque con su estado para el usuario que la pide
export async function disponibilidadDelDia(recursoId: string, fecha: string, usuarioId: string) {
  await revisarQueLaCanchaExista(recursoId);
  revisarQueElDiaSeaReservable(fecha);

  const bloques = bloquesDelDia(fecha);
  const reservas = await db.reserva.findMany({
    where: {
      recursoId,
      estado: "CONFIRMADA",
      inicio: { gte: bloques[0].inicio, lt: bloques[bloques.length - 1].fin },
    },
    select: { inicio: true, usuarioId: true },
  });

  const ahora = new Date();

  return bloques.map((bloque) => {
    const reserva = reservas.find((r) => r.inicio.getTime() === bloque.inicio.getTime());

    let estado: EstadoBloque = "libre";
    if (bloque.inicio <= ahora) {
      estado = "pasado";
    } else if (reserva) {
      estado = reserva.usuarioId === usuarioId ? "mio" : "ocupado";
    }

    return { ...bloque, estado };
  });
}

export async function crearReserva(usuarioId: string, recursoId: string, inicio: Date) {
  await revisarQueLaCanchaExista(recursoId);

  if (!esInicioDeBloque(inicio)) {
    throw new ErrorHttp(400, "Ese horario no existe: las reservas son de 1 hora y empiezan a la hora en punto");
  }
  if (inicio <= new Date()) {
    throw new ErrorHttp(400, "No se puede reservar en el pasado");
  }
  revisarQueElDiaSeaReservable(diaEnElClub(inicio));

  try {
    // Una transacción: o se hace todo, o no se hace nada
    return await db.$transaction(async (tx) => {
      // Bloquea la fila del usuario hasta que termine la transacción. Si el mismo usuario
      // manda dos reservas a la vez, la segunda espera aquí, y cuando le toca contar ya ve la primera.
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;

      const activas = await tx.reserva.count({
        where: { usuarioId, estado: "CONFIRMADA", fin: { gt: new Date() } },
      });
      if (activas >= MAXIMO_RESERVAS_ACTIVAS) {
        throw new ErrorHttp(
          409,
          `Ya tienes ${MAXIMO_RESERVAS_ACTIVAS} reservas activas. Cancela una para poder reservar otra.`,
        );
      }

      return tx.reserva.create({
        data: { usuarioId, recursoId, inicio, fin: new Date(inicio.getTime() + UNA_HORA_MS) },
        select: DATOS_RESERVA,
      });
    });
  } catch (error) {
    // No se revisa antes si el horario está libre: lo decide el índice único de la base de datos.
    // Así, si dos personas reservan el mismo bloque al mismo tiempo, solo una lo consigue.
    if (esErrorDePrisma(error, "P2002")) {
      throw new ErrorHttp(409, "Ese horario ya está reservado");
    }
    throw error;
  }
}

// Las reservas confirmadas que todavía no terminan, de la más cercana a la más lejana
export function reservasProximas(usuarioId: string) {
  return db.reserva.findMany({
    where: { usuarioId, estado: "CONFIRMADA", fin: { gt: new Date() } },
    orderBy: { inicio: "asc" },
    select: DATOS_RESERVA,
  });
}

// Para el admin: todas las reservas de un día (confirmadas y canceladas), de cualquier cancha.
// A diferencia de los clientes, el admin puede mirar cualquier día, también los pasados.
export function reservasDelDia(fecha: string) {
  const { desde, hasta } = limitesDelDia(fecha);

  return db.reserva.findMany({
    where: { inicio: { gte: desde, lt: hasta } },
    orderBy: [{ inicio: "asc" }, { recurso: { nombre: "asc" } }],
    select: { ...DATOS_RESERVA, usuario: { select: { id: true, nombre: true, email: true } } },
  });
}

// Cancelar no borra la reserva: le cambia el estado, así queda el historial.
// El índice único solo mira las confirmadas, así que el horario vuelve a quedar libre.
// Devuelve la cancha y el horario que se liberaron, para poder avisar en vivo.
export async function cancelarReserva(reservaId: string, usuario: UsuarioSesion) {
  const reserva = await db.reserva.findUnique({ where: { id: reservaId } });

  if (!reserva) {
    throw new ErrorHttp(404, "La reserva no existe");
  }
  if (reserva.usuarioId !== usuario.id && usuario.rol !== "ADMIN") {
    throw new ErrorHttp(403, "Solo puedes cancelar tus propias reservas");
  }
  if (reserva.estado === "CANCELADA") {
    throw new ErrorHttp(409, "La reserva ya estaba cancelada");
  }
  if (reserva.inicio <= new Date()) {
    throw new ErrorHttp(400, "No se puede cancelar una reserva que ya empezó");
  }

  return db.reserva.update({
    where: { id: reservaId },
    data: { estado: "CANCELADA" },
    select: { recursoId: true, inicio: true },
  });
}
