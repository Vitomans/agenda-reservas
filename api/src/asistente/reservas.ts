import { type ToolApprovalStatus, tool } from "ai";
import { DateTime } from "luxon";
import { z } from "zod";
import type { Cartero } from "../cartero.ts";
import { db } from "../db.ts";
import type { Meteorologo } from "../meteorologo.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { enviarCorreoDeLaReserva } from "../servicios/correos.ts";
import { diasReservables, HORA_APERTURA, HORA_CIERRE, ZONA_HORARIA } from "../servicios/horario.ts";
import { precioDelBloque } from "../servicios/precios.ts";
import { pronosticoDelDia } from "../servicios/pronostico.ts";
import { cancelarReserva, crearReserva, MAXIMO_RESERVAS_ACTIVAS, reservasProximas } from "../servicios/reservas.ts";
import type { UsuarioSesion } from "../servicios/sesion.ts";
import type { Avisador } from "../tiempoReal.ts";
import { esquemaDeFecha, horaEnPunto, nombreDelDia, pesos } from "./textos.ts";

// Las herramientas que cambian datos: reservar y cancelar.
//
// Estas dos no se hacen apenas la IA las pide: la API primero revisa el pedido y, si se puede hacer,
// le pide a la persona que lo confirme (la página muestra una tarjeta con "Confirmar"). Recién cuando la
// persona confirma, la página vuelve a mandar la conversación y la API hace la reserva. Esto es la
// "confirmación humana": la IA propone y la persona decide.
//
// Las reglas no dependen de la IA: se usan los mismos servicios que la página (crearReserva y cancelarReserva),
// con el usuario de la sesión. Aunque alguien engañe a la IA o escriba la conversación a mano, no puede hacer
// más de lo que ya puede hacer en la página.

// Lo que necesitan las herramientas: quién conversa (undefined si no entró), cómo avisar de los cambios,
// igual que las rutas de las reservas (ver rutas/reservas.ts), y el pronóstico del tiempo para la hora reservada
export type ContextoDeReservas = {
  usuario?: UsuarioSesion;
  avisador: Avisador;
  cartero: Cartero;
  meteorologo: Meteorologo;
};

// Una reserva como la ven la IA y la página del chat
export const esquemaReservaDelChat = z.object({
  id: z.string(),
  cancha: z.string(),
  fecha: z.iso.date(),
  hora: z.string(), // por ejemplo "19:00", en la hora del club
  precio: z.number(),
});

export type ReservaDelChat = z.infer<typeof esquemaReservaDelChat>;

type ReservaDeLaBase = Awaited<ReturnType<typeof reservasProximas>>[number];

function reservaDelChat({ id, inicio, precio, recurso }: ReservaDeLaBase): ReservaDelChat {
  const enElClub = DateTime.fromJSDate(inicio, { zone: ZONA_HORARIA });
  return { id, cancha: recurso.nombre, fecha: enElClub.toISODate()!, hora: enElClub.toFormat("HH:mm"), precio };
}

// "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000". Es lo que dice la tarjeta para confirmar,
// así que lo arma la API con los datos de la base, no la IA: la persona confirma lo que de verdad se va a hacer.
export function describirReserva({ cancha, fecha, hora, precio }: Omit<ReservaDelChat, "id">) {
  const fin = horaEnPunto(Number(hora.slice(0, 2)) + 1);
  return `${cancha} · ${nombreDelDia(fecha)} · ${hora} a ${fin} · ${pesos(precio)}`;
}

// ---------- reservar ----------

const esquemaPedidoDeReserva = z.object({
  fecha: esquemaDeFecha,
  hora: z.number().int().min(0).max(23).describe("La hora en que empieza. Por ejemplo, 19 para las 19:00"),
  cancha: z.string().min(1).max(60).describe("El nombre de la cancha, como lo da verHorariosLibres. Por ejemplo: Cancha 2"),
});

type PedidoDeReserva = z.infer<typeof esquemaPedidoDeReserva>;

// Lo que devuelve reservar: la reserva hecha, o por qué no se pudo. Con la reserva va el pronóstico de esa hora
// (si lo hay), y así el asistente lo menciona al confirmarla, sin hacerle otro pedido a la IA.
export const esquemaResultadoDeReserva = z.object({
  reserva: esquemaReservaDelChat.optional(),
  pronostico: z.object({ grados: z.number(), descripcion: z.string() }).optional(),
  aviso: z.string().optional(),
});

export type ResultadoDeReserva = z.infer<typeof esquemaResultadoDeReserva>;

// Revisa un pedido sin reservar todavía. Si se puede, devuelve la cancha, el inicio y el precio; si no, el motivo
// para que la IA lo explique. Se usa antes de pedir la confirmación: así no aparece un "Confirmar" para una hora
// ocupada. Las mismas reglas las vuelve a revisar crearReserva al reservar, por si algo cambió entremedio.
async function revisarPedidoDeReserva({ fecha, hora, cancha }: PedidoDeReserva, usuario?: UsuarioSesion) {
  if (usuario && usuario.rol !== "CLIENTE") {
    return { aviso: "Los administradores no reservan: las reservas son para los jugadores." };
  }

  const dias = diasReservables();
  if (!dias.includes(fecha)) {
    return { aviso: `Ese día no se puede reservar: solo desde hoy hasta el ${nombreDelDia(dias.at(-1)!)}.` };
  }
  if (hora < HORA_APERTURA || hora >= HORA_CIERRE) {
    return {
      aviso: `El club abre de ${horaEnPunto(HORA_APERTURA)} a ${horaEnPunto(HORA_CIERRE)}: la última reserva empieza a las ${horaEnPunto(HORA_CIERRE - 1)}.`,
    };
  }

  const inicio = DateTime.fromISO(fecha, { zone: ZONA_HORARIA }).set({ hour: hora }).toJSDate();
  if (inicio <= new Date()) {
    return { aviso: "Esa hora ya pasó." };
  }

  // La IA escribe el nombre que vio en verHorariosLibres. Se acepta con otras mayúsculas ("cancha 2").
  const canchas = await db.recurso.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } });
  const recurso = canchas.find((c) => c.nombre.toLocaleLowerCase("es") === cancha.trim().toLocaleLowerCase("es"));
  if (!recurso) {
    return { aviso: `No hay ninguna cancha llamada "${cancha}". Las canchas son: ${canchas.map((c) => c.nombre).join(", ")}.` };
  }

  const ocupada = await db.reserva.findFirst({ where: { recursoId: recurso.id, inicio, estado: "CONFIRMADA" } });
  if (ocupada) {
    return { aviso: `La ${recurso.nombre} ya está reservada el ${nombreDelDia(fecha)} a las ${horaEnPunto(hora)}.` };
  }

  // Sin sesión no se revisa más: al confirmar, la página crea un jugador invitado, que todavía no tiene reservas
  if (usuario) {
    const proximas = await reservasProximas(usuario.id);
    const aLaMismaHora = proximas.find((reserva) => reserva.inicio.getTime() === inicio.getTime());
    if (aLaMismaHora) {
      return { aviso: `La persona ya tiene una reserva a esa hora, en la ${aLaMismaHora.recurso.nombre}.` };
    }
    if (proximas.length >= MAXIMO_RESERVAS_ACTIVAS) {
      return {
        aviso: `La persona ya tiene ${MAXIMO_RESERVAS_ACTIVAS} reservas activas, el máximo. Para reservar otra, primero tiene que cancelar una.`,
      };
    }
  }

  return { recurso, inicio, precio: precioDelBloque(inicio) };
}

// Decide si reservar necesita la confirmación de la persona. Si el pedido no se puede hacer, se rechaza solo
// (sin tarjeta) y la IA recibe el motivo. El AI SDK la vuelve a llamar cuando llega la confirmación, así que
// si alguien tomó la hora mientras la persona decidía, también se rechaza.
async function confirmacionDeReserva(pedido: PedidoDeReserva, usuario?: UsuarioSesion): Promise<ToolApprovalStatus> {
  const revision = await revisarPedidoDeReserva(pedido, usuario);
  if ("aviso" in revision) return { type: "denied", reason: revision.aviso };

  const { recurso, precio } = revision;
  return { type: "user-approval", reason: describirReserva({ cancha: recurso.nombre, fecha: pedido.fecha, hora: horaEnPunto(pedido.hora), precio }) };
}

// El tiempo a la hora de una reserva: { grados: 18, descripcion: "lluvia ligera" }, o undefined si no hay pronóstico
async function pronosticoDeLaReserva(meteorologo: Meteorologo, { fecha, hora }: ReservaDelChat) {
  const datos = await meteorologo.datos();
  const deLaHora = datos && pronosticoDelDia(datos, fecha).find((h) => h.hora === hora);
  return deLaHora ? { grados: deLaHora.grados, descripcion: deLaHora.descripcion } : undefined;
}

// Solo llega aquí después de que la persona confirmó
async function reservar(pedido: PedidoDeReserva, { usuario, avisador, cartero, meteorologo }: ContextoDeReservas): Promise<ResultadoDeReserva> {
  // Al tocar "Confirmar" sin haber entrado, la página primero crea un jugador invitado. Esto solo pasa
  // si alguien manda la confirmación a mano, sin sesión.
  if (!usuario) return { aviso: "Para reservar hay que entrar, o tocar Confirmar en la tarjeta para reservar como invitado." };

  const revision = await revisarPedidoDeReserva(pedido, usuario);
  if ("aviso" in revision) return { aviso: revision.aviso };

  try {
    const reserva = await crearReserva(usuario.id, revision.recurso.id, revision.inicio);

    // Igual que al reservar en la grilla: se avisa en vivo y se envía el correo (sin esperarlo)
    avisador.reservaCreada({ recursoId: reserva.recurso.id, inicio: reserva.inicio });
    void enviarCorreoDeLaReserva(cartero, reserva.id, { tipo: "confirmada" });

    const hecha = reservaDelChat(reserva);
    return { reserva: hecha, pronostico: await pronosticoDeLaReserva(meteorologo, hecha) };
  } catch (error) {
    // Lo que no deja crearReserva (por ejemplo, si otra persona tomó la hora en ese mismo segundo) se le explica a la IA
    if (error instanceof ErrorHttp) return { aviso: error.message };
    throw error;
  }
}

// ---------- verMisReservas ----------

export const esquemaMisReservas = z.object({
  reservas: z.array(esquemaReservaDelChat),
  aviso: z.string().optional(),
});

export type MisReservasDelChat = z.infer<typeof esquemaMisReservas>;

async function verMisReservas(usuario?: UsuarioSesion): Promise<MisReservasDelChat> {
  if (!usuario) return { reservas: [], aviso: "La persona no ha entrado, así que no tiene reservas." };
  return { reservas: (await reservasProximas(usuario.id)).map(reservaDelChat) };
}

// Lo que lee el modelo. Lleva el id de cada reserva, que necesita para cancelarla.
//
// Reservas próximas de la persona:
// - Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000 (id 3f2a...)
export function misReservasParaLaIA({ reservas, aviso }: MisReservasDelChat) {
  if (aviso) return aviso;
  if (reservas.length === 0) return "La persona no tiene reservas próximas.";
  return ["Reservas próximas de la persona:", ...reservas.map((r) => `- ${describirReserva(r)} (id ${r.id})`)].join("\n");
}

// ---------- cancelarReserva ----------

const esquemaPedidoDeCancelacion = z.object({
  reservaId: z.string().min(1).max(100).describe("El id de la reserva, como lo da verMisReservas"),
});

type PedidoDeCancelacion = z.infer<typeof esquemaPedidoDeCancelacion>;

export const esquemaResultadoDeCancelacion = z.object({
  cancelada: esquemaReservaDelChat.optional(),
  aviso: z.string().optional(),
});

export type ResultadoDeCancelacion = z.infer<typeof esquemaResultadoDeCancelacion>;

// Solo se pueden cancelar las reservas propias que todavía no empiezan. Si el id es de otra persona,
// se responde lo mismo que si no existiera: así la IA no puede averiguar nada de las reservas de otros.
async function revisarCancelacion({ reservaId }: PedidoDeCancelacion, usuario?: UsuarioSesion) {
  if (!usuario) return { aviso: "La persona no ha entrado, así que no tiene reservas para cancelar." };

  const reserva = (await reservasProximas(usuario.id)).find((r) => r.id === reservaId);
  if (!reserva) {
    return { aviso: "Esa reserva no está entre las próximas reservas de la persona. Usa verMisReservas para ver cuáles tiene." };
  }
  if (reserva.inicio <= new Date()) {
    return { aviso: "Esa reserva ya empezó: se puede cancelar solo hasta que empieza." };
  }

  return { reserva, usuario };
}

async function confirmacionDeCancelacion(pedido: PedidoDeCancelacion, usuario?: UsuarioSesion): Promise<ToolApprovalStatus> {
  const revision = await revisarCancelacion(pedido, usuario);
  if ("aviso" in revision) return { type: "denied", reason: revision.aviso };
  return { type: "user-approval", reason: describirReserva(reservaDelChat(revision.reserva)) };
}

// Solo llega aquí después de que la persona confirmó
async function cancelar(pedido: PedidoDeCancelacion, { usuario, avisador, cartero }: ContextoDeReservas): Promise<ResultadoDeCancelacion> {
  // También aquí se revisa de nuevo, por si la reserva cambió después de la tarjeta (por ejemplo, ya empezó)
  const revision = await revisarCancelacion(pedido, usuario);
  if ("aviso" in revision) return { aviso: revision.aviso };

  try {
    const liberada = await cancelarReserva(revision.reserva.id, revision.usuario);

    avisador.reservaCancelada(liberada);
    void enviarCorreoDeLaReserva(cartero, revision.reserva.id, { tipo: "cancelada", porElClub: false });

    return { cancelada: reservaDelChat(revision.reserva) };
  } catch (error) {
    if (error instanceof ErrorHttp) return { aviso: error.message };
    throw error;
  }
}

// ---------- Las herramientas y sus confirmaciones ----------

export function crearHerramientasDeReservas(contexto: ContextoDeReservas) {
  return {
    reservar: tool({
      description:
        "Reserva una hora de cancha para la persona. Antes de reservar, la página le muestra una tarjeta para que confirme.",
      inputSchema: esquemaPedidoDeReserva,
      outputSchema: esquemaResultadoDeReserva,
      execute: (pedido) => reservar(pedido, contexto),
      toModelOutput: ({ output: { reserva, pronostico, aviso } }) => ({
        type: "text",
        value: reserva
          ? `Quedó reservada: ${describirReserva(reserva)}.` +
            (pronostico ? ` Pronóstico para esa hora en Santiago: ${pronostico.descripcion}, ${pronostico.grados} °C.` : "")
          : (aviso ?? "No se pudo reservar."),
      }),
    }),
    verMisReservas: tool({
      description: "Las próximas reservas de la persona, con su id. Úsala antes de cancelar.",
      inputSchema: z.object({}),
      outputSchema: esquemaMisReservas,
      execute: () => verMisReservas(contexto.usuario),
      toModelOutput: ({ output }) => ({ type: "text", value: misReservasParaLaIA(output) }),
    }),
    cancelarReserva: tool({
      description:
        "Cancela una reserva de la persona, con el id que da verMisReservas. Antes de cancelar, la página le muestra una tarjeta para que confirme.",
      inputSchema: esquemaPedidoDeCancelacion,
      outputSchema: esquemaResultadoDeCancelacion,
      execute: (pedido) => cancelar(pedido, contexto),
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.cancelada
          ? `Quedó cancelada: ${describirReserva(output.cancelada)}. La hora quedó libre.`
          : (output.aviso ?? "No se pudo cancelar."),
      }),
    }),
  };
}

// Qué herramientas piden la confirmación de la persona (las demás se usan sin preguntar)
export function confirmacionesDeReservas(usuario?: UsuarioSesion) {
  return {
    reservar: (pedido: PedidoDeReserva) => confirmacionDeReserva(pedido, usuario),
    cancelarReserva: (pedido: PedidoDeCancelacion) => confirmacionDeCancelacion(pedido, usuario),
  };
}
