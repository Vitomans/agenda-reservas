import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { db, esErrorDePrisma } from "../db.ts";
import type { Avisador } from "../tiempoReal.ts";
import { bloquesDelDia, diaEnElClub, diasReservables, limitesDelDia, ZONA_HORARIA } from "./horario.ts";
import { precioDelBloque } from "./precios.ts";

// "Socios simulados": jugadores de mentira que le dan vida a la demo.
// 1. rellenarDias() llena cada día de la semana con reservas de socios, más en la tarde y la noche,
//    como en un club de verdad. Así quien entra no ve un club vacío.
// 2. moverElClub() hace que un socio reserve o cancele una hora. La usa simulador.ts mientras alguien
//    mira una cancha, para que se vea el tiempo real sin tener que abrir la demo en dos pantallas.
//
// Las reservas de los socios se guardan directo en la base de datos, sin pasar por las reglas de los
// jugadores (como el máximo de 2 reservas activas), porque son datos de ejemplo. El índice único sí
// se respeta: un socio nunca le quita una hora a alguien que ya la reservó.

export const DOMINIO_SOCIOS = "@socios.example.com";

// Los nombres de los socios. El seed crea una cuenta para cada uno.
export const SOCIOS = [
  "Camila Rojas",
  "Matías González",
  "Valentina Muñoz",
  "Benjamín Soto",
  "Isidora Díaz",
  "Tomás Contreras",
  "Florencia Silva",
  "Vicente Morales",
  "Antonia Fuentes",
  "Joaquín Pérez",
  "Martina Castro",
  "Agustín Reyes",
];

export function emailDeSocio(numero: number) {
  return `socio-${String(numero).padStart(2, "0")}${DOMINIO_SOCIOS}`;
}

// Qué tan llena suele estar cada hora, de 0 (vacía) a 1 (siempre llena).
// Entre semana se juega sobre todo después de la oficina; el fin de semana, también en la mañana.
const OCUPACION_ENTRE_SEMANA: Record<number, number> = {
  8: 0.2, 9: 0.25, 10: 0.3, 11: 0.3, 12: 0.3, 13: 0.25, 14: 0.2, 15: 0.25,
  16: 0.35, 17: 0.5, 18: 0.75, 19: 0.85, 20: 0.85, 21: 0.7, 22: 0.4,
};
const OCUPACION_FIN_DE_SEMANA: Record<number, number> = {
  8: 0.3, 9: 0.6, 10: 0.75, 11: 0.8, 12: 0.7, 13: 0.5, 14: 0.35, 15: 0.35,
  16: 0.4, 17: 0.5, 18: 0.55, 19: 0.6, 20: 0.55, 21: 0.4, 22: 0.25,
};

// Los días lejanos tienen menos reservas, porque la gente reserva con pocos días de anticipación
const MENOS_POR_DIA_DE_DISTANCIA = 0.08;

// Las reservas de socios de hace más de este tiempo se borran, para que la base de datos no crezca sin fin
const DIAS_DE_HISTORIA = 30;

// La probabilidad de que una hora esté reservada. "diasDesdeHoy" es 0 para hoy, 1 para mañana, etc.
export function probabilidadDeOcupacion(dia: string, hora: number, diasDesdeHoy: number) {
  const diaDeLaSemana = DateTime.fromISO(dia, { zone: ZONA_HORARIA }).weekday; // 1 = lunes ... 7 = domingo
  const tabla = diaDeLaSemana >= 6 ? OCUPACION_FIN_DE_SEMANA : OCUPACION_ENTRE_SEMANA;
  const base = tabla[hora] ?? 0;
  return Math.max(0, base * (1 - MENOS_POR_DIA_DE_DISTANCIA * Math.max(0, diasDesdeHoy)));
}

// Un número entre 0 y 1 que sale siempre igual para el mismo texto, como un dado "cargado".
// Así el relleno de un día no cambia si se calcula dos veces, y se puede probar.
function azarFijo(texto: string) {
  return createHash("sha256").update(texto).digest().readUInt32BE(0) / 2 ** 32;
}

function buscarSocios() {
  return db.usuario.findMany({
    where: { email: { endsWith: DOMINIO_SOCIOS } },
    orderBy: { email: "asc" },
    select: { id: true },
  });
}

// Llena con reservas de socios cada cancha en cada día que todavía no tiene ninguna.
// Si ya tiene (aunque estén canceladas), no la toca: así no se deshace lo que pasó durante el día.
// Devuelve una reserva nueva por cada cancha que recibió reservas, para poder avisar en vivo.
export async function rellenarDias({ dias = diasReservables(), recursoIds }: { dias?: string[]; recursoIds?: string[] } = {}) {
  const socios = await buscarSocios();
  const canchas = await db.recurso.findMany({
    where: { activo: true, ...(recursoIds && { id: { in: recursoIds } }) },
    select: { id: true },
  });
  if (socios.length === 0 || canchas.length === 0 || dias.length === 0) return [];

  const desde = limitesDelDia(dias[0]).desde;
  const hasta = limitesDelDia(dias[dias.length - 1]).hasta;

  // Las combinaciones de cancha y día que ya tienen reservas de socios
  const yaRellenas = new Set(
    (
      await db.reserva.findMany({
        where: {
          recursoId: { in: canchas.map((c) => c.id) },
          inicio: { gte: desde, lt: hasta },
          usuario: { email: { endsWith: DOMINIO_SOCIOS } },
        },
        select: { recursoId: true, inicio: true },
      })
    ).map((r) => `${r.recursoId}|${diaEnElClub(r.inicio)}`),
  );

  const hoy = DateTime.now().setZone(ZONA_HORARIA).startOf("day");
  const nuevas = [];

  for (const dia of dias) {
    // Se redondea porque el día del cambio de hora no dura justo 24 horas
    const diasDesdeHoy = Math.round(DateTime.fromISO(dia, { zone: ZONA_HORARIA }).diff(hoy, "days").days);

    for (const cancha of canchas) {
      if (yaRellenas.has(`${cancha.id}|${dia}`)) continue;

      for (const bloque of bloquesDelDia(dia)) {
        const clave = `${cancha.id}|${bloque.inicio.toISOString()}`;
        const hora = Number(bloque.hora.slice(0, 2));
        if (azarFijo(clave) >= probabilidadDeOcupacion(dia, hora, diasDesdeHoy)) continue;

        const socio = socios[Math.floor(azarFijo(`${clave}|socio`) * socios.length)];
        nuevas.push({
          recursoId: cancha.id,
          usuarioId: socio.id,
          inicio: bloque.inicio,
          fin: bloque.fin,
          precio: precioDelBloque(bloque.inicio),
        });
      }
    }
  }

  // "skipDuplicates" se salta las horas que un jugador ya reservó (las frena el índice único)
  await db.reserva.createMany({ data: nuevas, skipDuplicates: true });

  // De paso se borra la historia vieja de los socios
  await db.reserva.deleteMany({
    where: {
      usuario: { email: { endsWith: DOMINIO_SOCIOS } },
      inicio: { lt: hoy.minus({ days: DIAS_DE_HISTORIA }).toJSDate() },
    },
  });

  const unaPorCancha = new Map(nuevas.map((r) => [r.recursoId, { recursoId: r.recursoId, inicio: r.inicio }]));
  return [...unaPorCancha.values()];
}

// El primer día que todavía tiene horas por jugar: hoy, o mañana si hoy ya terminó
export function diaParaMover(ahora = new Date()) {
  return diasReservables().find((dia) => bloquesDelDia(dia).some((bloque) => bloque.inicio > ahora));
}

type Movimiento = { tipo: "reserva" | "cancelacion"; recursoId: string; inicio: Date };

// Un socio reserva una hora libre o cancela una de sus reservas en esa cancha, y se avisa en vivo.
// Reserva más seguido cuando la cancha tiene muchas horas libres y cancela más cuando está casi llena,
// así con el tiempo no se llena ni se vacía. Nunca cancela las reservas de los jugadores.
// "azar" y "ahora" se pueden cambiar en los tests para saber qué va a pasar.
export async function moverElClub(
  recursoId: string,
  avisador: Avisador,
  { azar = Math.random, ahora = new Date() }: { azar?: () => number; ahora?: Date } = {},
): Promise<Movimiento | null> {
  const dia = diaParaMover(ahora);
  const cancha = await db.recurso.findFirst({ where: { id: recursoId, activo: true } });
  const socios = await buscarSocios();
  if (!dia || !cancha || socios.length === 0) return null;

  const bloques = bloquesDelDia(dia).filter((bloque) => bloque.inicio > ahora);
  const reservas = await db.reserva.findMany({
    where: {
      recursoId,
      estado: "CONFIRMADA",
      inicio: { gte: bloques[0].inicio, lte: bloques[bloques.length - 1].inicio },
    },
    select: { id: true, inicio: true, usuario: { select: { email: true } } },
  });

  const libres = bloques.filter((bloque) => !reservas.some((r) => r.inicio.getTime() === bloque.inicio.getTime()));
  const deSocios = reservas.filter((r) => r.usuario.email.endsWith(DOMINIO_SOCIOS));
  const ocupacion = 1 - libres.length / bloques.length;

  const reservar = libres.length > 0 && (deSocios.length === 0 || azar() >= ocupacion);

  if (reservar) {
    const bloque = libres[Math.floor(azar() * libres.length)];
    const socio = socios[Math.floor(azar() * socios.length)];
    try {
      await db.reserva.create({
        data: { recursoId, usuarioId: socio.id, inicio: bloque.inicio, fin: bloque.fin, precio: precioDelBloque(bloque.inicio) },
      });
    } catch (error) {
      // Un jugador la reservó justo en ese momento: el socio se queda sin jugar esta vez
      if (esErrorDePrisma(error, "P2002")) return null;
      throw error;
    }
    avisador.reservaCreada({ recursoId, inicio: bloque.inicio });
    return { tipo: "reserva", recursoId, inicio: bloque.inicio };
  }

  if (deSocios.length === 0) return null;

  const reserva = deSocios[Math.floor(azar() * deSocios.length)];
  await db.reserva.update({ where: { id: reserva.id }, data: { estado: "CANCELADA" } });
  avisador.reservaCancelada({ recursoId, inicio: reserva.inicio });
  return { tipo: "cancelacion", recursoId, inicio: reserva.inicio };
}
