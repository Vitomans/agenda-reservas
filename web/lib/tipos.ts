// Los datos que devuelve la API (ver api/src). Las fechas llegan como texto ISO en UTC.

export type Rol = "ADMIN" | "CLIENTE";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
};

export type Horario = {
  zonaHoraria: string;
  horaApertura: number;
  horaCierre: number;
  dias: string[]; // los 7 días que se pueden reservar, desde hoy: "AAAA-MM-DD"
};

export type Recurso = {
  id: string;
  nombre: string;
};

export type RecursoAdmin = Recurso & {
  activo: boolean;
};

export type EstadoBloque = "libre" | "ocupado" | "mio" | "pasado";

export type Bloque = {
  inicio: string;
  fin: string;
  hora: string; // por ejemplo "19:00", en la hora del club
  estado: EstadoBloque;
};

export type Reserva = {
  id: string;
  inicio: string;
  fin: string;
  estado: "CONFIRMADA" | "CANCELADA";
  recurso: Recurso;
};

export type ReservaAdmin = Reserva & {
  usuario: { id: string; nombre: string; email: string };
};

// Lo que trae cada aviso en vivo: qué cancha y qué horario cambió (ver api/src/tiempoReal.ts)
export type CambioEnVivo = {
  recursoId: string;
  inicio: string;
};
