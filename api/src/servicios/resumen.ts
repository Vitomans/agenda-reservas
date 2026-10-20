import { DateTime } from "luxon";
import { db } from "../db.ts";
import { bloquesDelDia, limitesDelDia, ZONA_HORARIA } from "./horario.ts";

// Los números que le importan al dueño del club, para el panel de admin.
// Solo cuentan las reservas confirmadas de las canchas activas.

// Cuántos días mira "la hora más pedida", contando hacia atrás desde el día elegido
const DIAS_PARA_HORA_MAS_PEDIDA = 30;

const confirmadasDeCanchasActivas = { estado: "CONFIRMADA", recurso: { activo: true } } as const;

// Cuántas reservas hubo entre dos fechas y cuánto se cobró por ellas
async function reservasEIngresos(desde: Date, hasta: Date) {
  const { _count, _sum } = await db.reserva.aggregate({
    where: { ...confirmadasDeCanchasActivas, inicio: { gte: desde, lt: hasta } },
    _count: true,
    _sum: { precio: true },
  });
  return { reservas: _count, ingresos: _sum.precio ?? 0 };
}

// La hora del día (en la hora del club) con más reservas entre dos fechas.
// Se calcula en PostgreSQL con GROUP BY: la base de datos agrupa y cuenta, y la API recibe una sola fila.
// "inicio" está guardado en UTC: primero se le dice a PostgreSQL que es UTC y después se pasa a la hora del club.
async function horaMasPedida(desde: Date, hasta: Date) {
  const filas = await db.$queryRaw<{ hora: number; reservas: number }[]>`
    SELECT EXTRACT(HOUR FROM (r."inicio" AT TIME ZONE 'UTC') AT TIME ZONE ${ZONA_HORARIA})::int AS hora,
           COUNT(*)::int AS reservas
    FROM "Reserva" r
    JOIN "Recurso" c ON c."id" = r."recursoId"
    WHERE r."estado" = 'CONFIRMADA'
      AND c."activo"
      AND r."inicio" >= (${desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND r."inicio" < (${hasta.toISOString()}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY hora
    ORDER BY reservas DESC, hora ASC
    LIMIT 1
  `;

  if (filas.length === 0) return null;
  const [{ hora, reservas }] = filas;
  return { hora: `${String(hora).padStart(2, "0")}:00`, reservas };
}

// El resumen de un día ("AAAA-MM-DD"): ese día, su semana (de lunes a domingo) y la hora más pedida
export async function resumenDelDia(fecha: string) {
  const dia = limitesDelDia(fecha);
  const lunes = DateTime.fromISO(fecha, { zone: ZONA_HORARIA }).startOf("week"); // en Luxon la semana parte el lunes
  const semana = { desde: lunes.toJSDate(), hasta: lunes.plus({ weeks: 1 }).toJSDate() };
  const inicioDeLaHistoria = DateTime.fromJSDate(dia.hasta, { zone: ZONA_HORARIA })
    .minus({ days: DIAS_PARA_HORA_MAS_PEDIDA })
    .toJSDate();

  const [canchasActivas, delDia, deLaSemana, laHoraMasPedida] = await Promise.all([
    db.recurso.count({ where: { activo: true } }),
    reservasEIngresos(dia.desde, dia.hasta),
    reservasEIngresos(semana.desde, semana.hasta),
    horaMasPedida(inicioDeLaHistoria, dia.hasta),
  ]);

  // Ocupación: qué parte de todas las horas que se podían reservar ese día quedó reservada
  const horasDelDia = canchasActivas * bloquesDelDia(fecha).length;

  return {
    fecha,
    dia: { ...delDia, horasDelDia, ocupacion: horasDelDia === 0 ? 0 : delDia.reservas / horasDelDia },
    semana: { desde: lunes.toISODate(), hasta: lunes.plus({ days: 6 }).toISODate(), ...deLaSemana },
    horaMasPedida: laHoraMasPedida,
  };
}
