import { tool } from "ai";
import { z } from "zod";
import { diasReservables } from "../servicios/horario.ts";
import { disponibilidadDelClub } from "../servicios/reservas.ts";
import { horaEnPunto, nombreDelDia, pesos } from "./textos.ts";

// Las herramientas: lo que la IA le puede pedir a la API mientras conversa.
//
// La IA no ejecuta nada por su cuenta: responde "quiero usar verHorariosLibres con este día", el AI SDK
// llama a la función de aquí y le pasa el resultado, y con eso la IA escribe su respuesta.
// Las funciones usan los mismos servicios que la página, así que la IA ve lo mismo que vería la persona.

const esquemaPedidoDeHorarios = z.object({
  fecha: z.iso.date().describe("El día, en formato AAAA-MM-DD"),
  desde: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("Solo las horas desde esta. Por ejemplo, 19 si piden después de las 7 de la tarde"),
  hasta: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("Solo las horas que empiezan hasta esta. Por ejemplo, 12 si piden en la mañana"),
});

type PedidoDeHorarios = z.infer<typeof esquemaPedidoDeHorarios>;

// Lo que devuelve verHorariosLibres. La página lo muestra como botones (ver web/components/asistente).
// El esquema también sirve para revisar la conversación que manda la página, que trae los resultados
// anteriores: quien quiera los puede escribir a mano (ver validacion/asistente.ts).
export const esquemaHorariosLibres = z.object({
  // Cada hora con alguna cancha libre: su precio y los nombres de las canchas libres
  horas: z.array(z.object({ hora: z.string(), precio: z.number(), canchas: z.array(z.string()) })),
  // Las horas de ese día en que quien conversa ya tiene una reserva
  tusReservas: z.array(z.string()),
  // Por qué no se buscó, por ejemplo si el día no se puede reservar
  aviso: z.string().optional(),
});

export type HorariosLibres = z.infer<typeof esquemaHorariosLibres>;

type HoraDelClub = Awaited<ReturnType<typeof disponibilidadDelClub>>[number];

// De todo el club hora por hora, deja solo lo que sirve para reservar: las horas que no pasaron y tienen
// alguna cancha libre. Las horas en que la persona ya tiene una reserva van aparte, como en la vista
// "Por hora" de la página, que tampoco deja elegirlas.
export function horasLibres(horasDelClub: HoraDelClub[], { desde, hasta }: Omit<PedidoDeHorarios, "fecha">): HorariosLibres {
  const resultado: HorariosLibres = { horas: [], tusReservas: [] };

  for (const { hora, precio, canchas } of horasDelClub) {
    const numero = Number(hora.slice(0, 2));
    if ((desde !== undefined && numero < desde) || (hasta !== undefined && numero > hasta)) continue;

    if (canchas.some((cancha) => cancha.estado === "mio")) {
      resultado.tusReservas.push(hora);
      continue;
    }

    const libres = canchas.filter((cancha) => cancha.estado === "libre").map((cancha) => cancha.nombre);
    if (libres.length > 0) resultado.horas.push({ hora, precio, canchas: libres });
  }

  return resultado;
}

async function verHorariosLibres({ fecha, ...filtros }: PedidoDeHorarios, usuarioId?: string): Promise<HorariosLibres> {
  // Si la IA pide un día que no se puede reservar, la herramienta no falla: devuelve un aviso que la IA explica
  const dias = diasReservables();
  if (!dias.includes(fecha)) {
    return { horas: [], tusReservas: [], aviso: `Ese día no se puede reservar: solo desde hoy hasta el ${nombreDelDia(dias.at(-1)!)}.` };
  }

  return horasLibres(await disponibilidadDelClub(fecha, usuarioId), filtros);
}

// Lo que lee el modelo. La página recibe el resultado completo para dibujar los botones,
// pero al modelo le basta un texto corto, y así gasta menos tokens que con el JSON.
//
// Horas libres el viernes 23 de octubre (2026-10-23) desde las 19:00:
// 19:00 $16.000: Cancha 2, Cancha 4
// 20:00 $16.000: Cancha 1
export function resumenParaLaIA({ fecha, desde, hasta }: PedidoDeHorarios, { horas, tusReservas, aviso }: HorariosLibres) {
  if (aviso) return aviso;

  const cuando = [
    `el ${nombreDelDia(fecha)} (${fecha})`,
    desde !== undefined && `desde las ${horaEnPunto(desde)}`,
    hasta !== undefined && `hasta las ${horaEnPunto(hasta)}`,
  ]
    .filter(Boolean)
    .join(" ");

  const lineas =
    horas.length === 0
      ? [`No quedan horas libres ${cuando}.`]
      : [`Horas libres ${cuando}:`, ...horas.map((h) => `${h.hora} ${pesos(h.precio)}: ${h.canchas.join(", ")}`)];
  if (tusReservas.length > 0) {
    lineas.push(`La persona ya tiene una reserva ese día a las ${tusReservas.join(" y a las ")}.`);
  }

  return lineas.join("\n");
}

// Se arman en cada mensaje con el usuario de la sesión (o sin usuario, si no entró):
// así la IA ve las reservas propias como propias, igual que la grilla de la página.
export function crearHerramientas(usuarioId?: string) {
  return {
    verHorariosLibres: tool({
      description:
        "Las horas libres de un día del club, con su precio y las canchas libres. Úsala siempre antes de decir si hay cancha.",
      inputSchema: esquemaPedidoDeHorarios,
      outputSchema: esquemaHorariosLibres,
      execute: (pedido) => verHorariosLibres(pedido, usuarioId),
      toModelOutput: ({ input, output }) => ({ type: "text", value: resumenParaLaIA(input, output) }),
    }),
  };
}

export type Herramientas = ReturnType<typeof crearHerramientas>;
