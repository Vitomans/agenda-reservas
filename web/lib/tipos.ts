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
  // Pesos chilenos por hora. La hora punta es de lunes a viernes desde "inicioPuntaEntreSemana", y todo el fin de semana.
  tarifa: { precioNormal: number; precioPunta: number; inicioPuntaEntreSemana: number };
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
  precio: number; // en pesos chilenos
};

export type Reserva = {
  id: string;
  inicio: string;
  fin: string;
  estado: "CONFIRMADA" | "CANCELADA";
  precio: number; // lo que costó, en pesos chilenos
  recurso: Recurso;
};

export type ReservaAdmin = Reserva & {
  usuario: { id: string; nombre: string; email: string };
};

// El correo de confirmación de una reserva, para la vista previa (ver api/src/servicios/correos.ts)
export type VistaDeCorreo = {
  para: string;
  asunto: string;
  html: string;
  seEnvia: boolean; // false para los jugadores demo, que no tienen un correo real
};

// Los números del día para el dueño (ver api/src/servicios/resumen.ts)
export type Resumen = {
  fecha: string;
  dia: { reservas: number; ingresos: number; horasDelDia: number; ocupacion: number }; // ocupación de 0 a 1
  semana: { desde: string; hasta: string; reservas: number; ingresos: number }; // de lunes a domingo
  horaMasPedida: { hora: string; reservas: number } | null; // en los últimos 30 días
};

// Lo que trae cada aviso en vivo: qué cancha y qué horario cambió (ver api/src/tiempoReal.ts)
export type CambioEnVivo = {
  recursoId: string;
  inicio: string;
};
