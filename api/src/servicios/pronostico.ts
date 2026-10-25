import type { Cielo, DatosDelTiempo } from "../meteorologo.ts";
import { bloquesDelDia } from "./horario.ts";

// El pronóstico de cada hora del club, a partir de lo que trajo el meteorólogo (ver meteorologo.ts).
// Lo usan la barra para reservar de la página (GET /api/pronostico) y el asistente (verPronostico y reservar).

// Cómo se dice cada cielo. La página pone la primera letra en mayúscula cuando hace falta.
export const TEXTO_DEL_CIELO: Record<Cielo, string> = {
  despejado: "despejado",
  "poco-nublado": "poco nublado",
  parcial: "parcialmente nublado",
  nublado: "nublado",
  niebla: "niebla",
  "lluvia-ligera": "lluvia ligera",
  lluvia: "lluvia",
  "lluvia-fuerte": "lluvia fuerte",
  aguanieve: "aguanieve",
  nieve: "nieve",
  tormenta: "tormenta eléctrica",
};

// El tiempo a una hora del club, por ejemplo a las 19:00: 18 °C y lluvia ligera
export type HoraDelPronostico = {
  hora: string;
  grados: number;
  cielo: Cielo;
  descripcion: string; // "lluvia ligera"
  deNoche: boolean;
};

// La temperatura en un momento. Si no hay un dato justo a esa hora (después de los primeros días vienen cada 6 horas),
// se calcula entre los dos datos más cercanos, como si la temperatura cambiara de a poco entre uno y otro.
function temperaturaEn(momento: number, temperaturas: DatosDelTiempo["temperaturas"]) {
  const siguiente = temperaturas.findIndex((t) => t.momento.getTime() >= momento);
  if (siguiente === -1) return undefined; // después del último dato

  const despues = temperaturas[siguiente];
  if (despues.momento.getTime() === momento) return despues.grados;
  if (siguiente === 0) return undefined; // antes del primer dato

  const antes = temperaturas[siguiente - 1];
  const avance = (momento - antes.momento.getTime()) / (despues.momento.getTime() - antes.momento.getTime());
  return antes.grados + (despues.grados - antes.grados) * avance;
}

// El cielo en un momento: el del período más corto que lo incluye (uno de 1 hora es más preciso que uno de 6).
// Entre dos del mismo largo, el que empieza más tarde, porque es el que está más cerca de ese momento.
function periodoEn(momento: number, periodos: DatosDelTiempo["periodos"]) {
  const duracion = (p: DatosDelTiempo["periodos"][number]) => p.fin.getTime() - p.inicio.getTime();
  return periodos
    .filter((p) => p.inicio.getTime() <= momento && momento < p.fin.getTime())
    .sort((a, b) => duracion(a) - duracion(b) || b.inicio.getTime() - a.inicio.getTime())[0];
}

// El tiempo de cada hora de un día ("AAAA-MM-DD") en que abre el club, a la hora en que empieza la reserva.
// Las horas que ya terminaron y las que no tienen pronóstico (por ejemplo, las de más adelante) no se incluyen.
export function pronosticoDelDia(datos: DatosDelTiempo, fecha: string, ahora = new Date()): HoraDelPronostico[] {
  return bloquesDelDia(fecha).flatMap(({ inicio, fin, hora }) => {
    if (fin <= ahora) return [];
    const grados = temperaturaEn(inicio.getTime(), datos.temperaturas);
    const periodo = periodoEn(inicio.getTime(), datos.periodos);
    if (grados === undefined || !periodo) return [];

    // "|| 0" para no escribir "-0 °C"
    return [{ hora, grados: Math.round(grados) || 0, cielo: periodo.cielo, descripcion: TEXTO_DEL_CIELO[periodo.cielo], deNoche: periodo.deNoche }];
  });
}

// Varias horas seguidas con el mismo cielo: "de 19:00 a 22:00, lluvia ligera, de 16 a 18 °C"
export type TramoDelPronostico = {
  desde: string;
  hasta: string;
  cielo: Cielo;
  descripcion: string;
  deNoche: boolean; // el de la primera hora
  minima: number;
  maxima: number;
};

// "19:00" → "20:00"
const horaSiguiente = (hora: string) => `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`;

// Junta las horas seguidas que tienen el mismo cielo. Así el asistente lee (y la página muestra) unas pocas líneas
// en vez de una por hora.
export function tramosDelPronostico(horas: HoraDelPronostico[]): TramoDelPronostico[] {
  const tramos: TramoDelPronostico[] = [];

  for (const { hora, grados, cielo, descripcion, deNoche } of horas) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.cielo === cielo && ultimo.hasta === hora) {
      ultimo.hasta = horaSiguiente(hora);
      ultimo.minima = Math.min(ultimo.minima, grados);
      ultimo.maxima = Math.max(ultimo.maxima, grados);
    } else {
      tramos.push({ desde: hora, hasta: horaSiguiente(hora), cielo, descripcion, deNoche, minima: grados, maxima: grados });
    }
  }

  return tramos;
}

// "16 °C" o "16 a 18 °C"
export function grados({ minima, maxima }: Pick<TramoDelPronostico, "minima" | "maxima">) {
  return minima === maxima ? `${minima} °C` : `${minima} a ${maxima} °C`;
}

// "19:00 a 22:00: lluvia ligera, 16 a 18 °C"
export function describirTramo(tramo: TramoDelPronostico) {
  return `${tramo.desde} a ${tramo.hasta}: ${tramo.descripcion}, ${grados(tramo)}`;
}
