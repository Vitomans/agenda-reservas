import { DateTime } from "luxon";

// Horario del club. Las reservas son bloques fijos de 1 hora.
//
// Las fechas se guardan siempre en UTC (la hora "universal"), pero los días y las horas
// se calculan con la hora de Chile, que es donde está el club. Así "las 8:00" son
// las 8:00 del club aunque quien reserva esté en otro país o cambie la hora en Chile.
export const ZONA_HORARIA = "America/Santiago";
export const HORA_APERTURA = 8; // primer bloque: 08:00 a 09:00
export const HORA_CIERRE = 23; // último bloque: 22:00 a 23:00
export const DIAS_DE_ANTICIPACION = 7; // se puede reservar desde hoy hasta 6 días más

export type Bloque = {
  inicio: Date;
  fin: Date;
  hora: string; // por ejemplo "08:00", en la hora del club
};

function enElClub(fecha: Date) {
  return DateTime.fromJSDate(fecha, { zone: ZONA_HORARIA });
}

// Fecha de hoy en el club, como texto "AAAA-MM-DD"
export function hoyEnElClub() {
  return DateTime.now().setZone(ZONA_HORARIA).toISODate()!;
}

// Los días que se pueden ver y reservar, empezando por hoy ("ahora" se cambia en los tests)
export function diasReservables(ahora = new Date()) {
  const hoy = enElClub(ahora).startOf("day");
  return Array.from({ length: DIAS_DE_ANTICIPACION }, (_, i) => hoy.plus({ days: i }).toISODate()!);
}

// Todos los bloques de un día ("AAAA-MM-DD"), desde la apertura hasta el cierre
export function bloquesDelDia(fecha: string): Bloque[] {
  const dia = DateTime.fromISO(fecha, { zone: ZONA_HORARIA });
  const bloques: Bloque[] = [];

  for (let hora = HORA_APERTURA; hora < HORA_CIERRE; hora++) {
    const inicio = dia.set({ hour: hora, minute: 0, second: 0, millisecond: 0 });
    bloques.push({
      inicio: inicio.toJSDate(),
      fin: inicio.plus({ hours: 1 }).toJSDate(),
      hora: inicio.toFormat("HH:mm"),
    });
  }

  return bloques;
}

// Desde y hasta cuándo va un día del club (de medianoche a medianoche, en la hora del club)
export function limitesDelDia(fecha: string) {
  const medianoche = DateTime.fromISO(fecha, { zone: ZONA_HORARIA }).startOf("day");
  return { desde: medianoche.toJSDate(), hasta: medianoche.plus({ days: 1 }).toJSDate() };
}

// Revisa que una fecha sea el comienzo de un bloque: hora en punto y dentro del horario del club
export function esInicioDeBloque(inicio: Date) {
  const local = enElClub(inicio);
  return (
    local.minute === 0 &&
    local.second === 0 &&
    local.millisecond === 0 &&
    local.hour >= HORA_APERTURA &&
    local.hour < HORA_CIERRE
  );
}

// El día del club ("AAAA-MM-DD") al que pertenece una fecha
export function diaEnElClub(fecha: Date) {
  return enElClub(fecha).toISODate()!;
}
