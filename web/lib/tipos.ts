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

// Una hora del club con el estado de cada cancha a esa hora (la vista "¿A qué hora quieres jugar?")
export type HoraDelClub = {
  inicio: string;
  fin: string;
  hora: string; // por ejemplo "19:00", en la hora del club
  precio: number; // en pesos chilenos, igual para todas las canchas
  canchas: (Recurso & { estado: EstadoBloque })[];
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

// Lo que el asistente le pide a la herramienta verHorariosLibres, y lo que ella devuelve
// (ver api/src/asistente/herramientas.ts). "desde" y "hasta" son horas: 19 = las 19:00.
export type PedidoDeHorarios = { fecha: string; desde?: number; hasta?: number };

export type HorariosLibres = {
  horas: { hora: string; precio: number; canchas: string[] }[]; // las horas con alguna cancha libre, y los nombres de esas canchas
  tusReservas: string[]; // las horas de ese día en que ya tienes una reserva
  aviso?: string; // por qué no se buscó, por ejemplo si el día no se puede reservar
};

// Lo que el asistente le pide a la herramienta buscarInformacion, y lo que ella devuelve: de qué documentos
// y secciones del club sacó la información. El texto de cada sección lo lee solo la IA, en la API.
export type PedidoDeInformacion = { pregunta: string };

export type InformacionDelClub = {
  fuentes: { id: string; documento: string; seccion: string }[];
  forma: "significado" | "palabras"; // cómo buscó: por significado (con Gemini) o por palabras (el respaldo)
};

// Una reserva como la muestra el asistente (ver api/src/asistente/reservas.ts)
export type ReservaDelChat = {
  id: string;
  cancha: string;
  fecha: string; // "AAAA-MM-DD"
  hora: string; // por ejemplo "19:00", en la hora del club
  precio: number;
};

// Lo que el asistente le pide a la herramienta reservar ("hora": 19 = las 19:00), y lo que ella devuelve:
// la reserva hecha, o por qué no se pudo
export type PedidoDeReserva = { fecha: string; hora: number; cancha: string };
export type ResultadoDeReserva = { reserva?: ReservaDelChat; aviso?: string };

// Lo que devuelve verMisReservas: las próximas reservas de quien conversa
export type MisReservasDelChat = { reservas: ReservaDelChat[]; aviso?: string };

// Lo que el asistente le pide a la herramienta cancelarReserva, y lo que ella devuelve
export type PedidoDeCancelacion = { reservaId: string };
export type ResultadoDeCancelacion = { cancelada?: ReservaDelChat; aviso?: string };

// Lo que trae cada aviso en vivo: qué cancha y qué horario cambió (ver api/src/tiempoReal.ts)
export type CambioEnVivo = {
  recursoId: string;
  inicio: string;
};
