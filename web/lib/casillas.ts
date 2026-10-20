import type { Bloque, EstadoBloque, HoraDelClub, Recurso } from "./tipos";

// Una "casilla" es una cancha a una hora, como una casilla del tablero del club.
// Las dos formas de reservar (por cancha y por hora) se pasan a casillas, así lo demás funciona igual
// en las dos: qué se eligió, si otra persona lo tomó mientras tanto y qué cambió en vivo.
export type Casilla = {
  cancha: Recurso;
  inicio: string;
  fin: string;
  hora: string;
  precio: number;
  estado: EstadoBloque;
};

// Lo que se eligió para reservar: una cancha a una hora
export type Eleccion = { recursoId: string; inicio: string };

// La grilla de una cancha: una casilla por hora
export function casillasDeLaCancha(cancha: Recurso, bloques: Bloque[]): Casilla[] {
  return bloques.map((bloque) => ({ ...bloque, cancha }));
}

// Todo el club: una casilla por cada cancha en cada hora
export function casillasDelClub(horas: HoraDelClub[]): Casilla[] {
  return horas.flatMap(({ canchas, ...hora }) => canchas.map(({ estado, ...cancha }) => ({ ...hora, cancha, estado })));
}

export function buscarCasilla(casillas: Casilla[] | undefined, eleccion: Eleccion | null) {
  if (!eleccion) return undefined;
  return casillas?.find((casilla) => casilla.cancha.id === eleccion.recursoId && casilla.inicio === eleccion.inicio);
}
