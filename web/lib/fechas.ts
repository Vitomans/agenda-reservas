// Las fechas llegan de la API en UTC. Acá se muestran en la hora del club,
// usando Intl, que viene incluido en el navegador.

const IDIOMA = "es-CL";

// Un día "AAAA-MM-DD" se lee como el mediodía de ese día en UTC:
// así ninguna zona horaria lo puede correr al día anterior o al siguiente.
function mediodia(dia: string) {
  return new Date(`${dia}T12:00:00Z`);
}

function sinPunto(texto: string) {
  return texto.replace(".", "");
}

// Suma (o resta) días a una fecha "AAAA-MM-DD"
export function sumarDias(dia: string, cantidad: number) {
  const fecha = mediodia(dia);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

// Para la tira de días: "Hoy", "Mañana" o el día de la semana abreviado ("mié")
export function nombreDelDia(dia: string, hoy: string) {
  if (dia === hoy) return "Hoy";
  if (dia === sumarDias(hoy, 1)) return "Mañana";
  return sinPunto(new Intl.DateTimeFormat(IDIOMA, { weekday: "short", timeZone: "UTC" }).format(mediodia(dia)));
}

// 19 → "19:00", como el asistente pide las horas (ver api/src/asistente/reservas.ts)
export function horaEnPunto(hora: number) {
  return `${String(hora).padStart(2, "0")}:00`;
}

// El número del día del mes: "2026-10-14" → "14"
export function numeroDelDia(dia: string) {
  return String(Number(dia.slice(8, 10)));
}

// "2026-10-14" → "miércoles 14 de octubre"
export function diaLargo(dia: string) {
  const texto = new Intl.DateTimeFormat(IDIOMA, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(mediodia(dia));

  return texto.replace(",", ""); // Intl lo escribe "miércoles, 14 de octubre"
}

// Un rango de días: "19 al 25 de octubre", o "28 de septiembre al 4 de octubre" si cambia el mes
export function rangoDeDias(desde: string, hasta: string) {
  const formato = (opciones: Intl.DateTimeFormatOptions, dia: string) =>
    new Intl.DateTimeFormat(IDIOMA, { ...opciones, timeZone: "UTC" }).format(mediodia(dia));
  const diaYMes = (dia: string) => formato({ day: "numeric", month: "long" }, dia);

  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return mismoMes ? `${formato({ day: "numeric" }, desde)} al ${diaYMes(hasta)}` : `${diaYMes(desde)} al ${diaYMes(hasta)}`;
}

// La hora en el club: "2026-10-13T22:00:00.000Z" → "19:00"
export function horaEnElClub(iso: string, zonaHoraria: string) {
  return new Intl.DateTimeFormat(IDIOMA, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zonaHoraria,
  }).format(new Date(iso));
}

// El día en el club, corto: "2026-10-13T22:00:00.000Z" → "mar 13 oct"
export function diaCortoEnElClub(iso: string, zonaHoraria: string) {
  const partes = new Intl.DateTimeFormat(IDIOMA, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: zonaHoraria,
  }).formatToParts(new Date(iso));

  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    sinPunto(partes.find((p) => p.type === tipo)?.value ?? "");

  return `${parte("weekday")} ${parte("day")} ${parte("month")}`;
}

// "mar 13 oct · 19:00 a 20:00"
export function describirHorario(inicio: string, fin: string, zonaHoraria: string) {
  return `${diaCortoEnElClub(inicio, zonaHoraria)} · ${horaEnElClub(inicio, zonaHoraria)} a ${horaEnElClub(fin, zonaHoraria)}`;
}
