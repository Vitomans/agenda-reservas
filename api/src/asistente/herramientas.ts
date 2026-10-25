import { type EmbeddingModel, tool } from "ai";
import { z } from "zod";
import { sinCorreos } from "../cartero.ts";
import { CIELOS, type Meteorologo, sinPronostico } from "../meteorologo.ts";
import { diasReservables } from "../servicios/horario.ts";
import { describirTramo, pronosticoDelDia, tramosDelPronostico } from "../servicios/pronostico.ts";
import { disponibilidadDelClub } from "../servicios/reservas.ts";
import { sinAvisos } from "../tiempoReal.ts";
import { buscarEnElClub, pedazoPorId } from "./conocimiento.ts";
import { type ContextoDeReservas, crearHerramientasDeReservas } from "./reservas.ts";
import { esquemaDeFecha, horaEnPunto, nombreDelDia, pesos } from "./textos.ts";

// Las herramientas: lo que la IA le puede pedir a la API mientras conversa.
//
// La IA no ejecuta nada por su cuenta: responde "quiero usar verHorariosLibres con este día", el AI SDK
// llama a la función de aquí y le pasa el resultado, y con eso la IA escribe su respuesta.
// Las funciones usan los mismos servicios que la página, así que la IA ve lo mismo que vería la persona.

const esquemaPedidoDeHorarios = z.object({
  fecha: esquemaDeFecha,
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

// "el viernes 23 de octubre (2026-10-23) desde las 19:00"
function cuandoDelPedido({ fecha, desde, hasta }: PedidoDeHorarios) {
  return [
    `el ${nombreDelDia(fecha)} (${fecha})`,
    desde !== undefined && `desde las ${horaEnPunto(desde)}`,
    hasta !== undefined && `hasta las ${horaEnPunto(hasta)}`,
  ]
    .filter(Boolean)
    .join(" ");
}

// Lo que lee el modelo. La página recibe el resultado completo para dibujar los botones,
// pero al modelo le basta un texto corto, y así gasta menos tokens que con el JSON.
//
// Horas libres el viernes 23 de octubre (2026-10-23) desde las 19:00:
// 19:00 $16.000: Cancha 2, Cancha 4
// 20:00 $16.000: Cancha 1
export function resumenParaLaIA(pedido: PedidoDeHorarios, { horas, tusReservas, aviso }: HorariosLibres) {
  if (aviso) return aviso;

  const cuando = cuandoDelPedido(pedido);

  const lineas =
    horas.length === 0
      ? [`No quedan horas libres ${cuando}.`]
      : [`Horas libres ${cuando}:`, ...horas.map((h) => `${h.hora} ${pesos(h.precio)}: ${h.canchas.join(", ")}`)];
  if (tusReservas.length > 0) {
    lineas.push(`La persona ya tiene una reserva ese día a las ${tusReservas.join(" y a las ")}.`);
  }

  return lineas.join("\n");
}

const esquemaPedidoDeInformacion = z.object({
  pregunta: z
    .string()
    .min(1)
    .max(200)
    .describe("Lo que hay que buscar, en pocas palabras. Por ejemplo: arriendo de paletas"),
});

type PedidoDeInformacion = z.infer<typeof esquemaPedidoDeInformacion>;

// Lo que devuelve buscarInformacion: de qué documentos y secciones sacó la información. La página los muestra
// como fuentes. El texto de cada sección no viaja a la página: el modelo lo lee del índice con el id
// (ver informacionParaLaIA). Así, quien escriba la conversación a mano no puede inventar un "documento del club":
// el id tiene que ser el de una sección que existe.
export const esquemaInformacionDelClub = z.object({
  fuentes: z.array(
    z.object({
      id: z
        .string()
        .refine((id) => pedazoPorId(id) !== undefined, { error: "No es una sección de los documentos del club" }),
      documento: z.string(),
      seccion: z.string(),
    }),
  ),
  // Cómo buscó: por significado (con Gemini) o por palabras (el respaldo)
  forma: z.enum(["significado", "palabras"]),
});

export type InformacionDelClub = z.infer<typeof esquemaInformacionDelClub>;

async function buscarInformacion(
  { pregunta }: PedidoDeInformacion,
  modeloDeVectores: EmbeddingModel | null,
): Promise<InformacionDelClub> {
  const { pedazos, forma } = await buscarEnElClub(pregunta, modeloDeVectores);
  return { fuentes: pedazos.map(({ id, documento, seccion }) => ({ id, documento, seccion })), forma };
}

// Lo que lee el modelo: cada sección con su documento entre corchetes, para que pueda decir de dónde sale la respuesta.
//
// [Servicios del club › Arriendo de paletas]
// Si no tienes paleta, puedes arrendar una en recepción a $3.000 por hora...
export function informacionParaLaIA({ fuentes }: InformacionDelClub) {
  const pedazos = fuentes.map(({ id }) => pedazoPorId(id)).filter((pedazo) => pedazo !== undefined);
  if (pedazos.length === 0) return "No hay nada sobre eso en la información del club.";

  return pedazos.map(({ documento, seccion, texto }) => `[${documento} › ${seccion}]\n${texto}`).join("\n\n");
}

// Lo que pide verPronostico: el día y, si quiere, desde y hasta qué hora, como verHorariosLibres.
// Sin las descripciones de cada campo: la de la herramienta ya lo explica, y así cada pedido a la IA lleva menos tokens.
const esquemaPedidoDePronostico = z.object({
  fecha: esquemaDeFecha,
  desde: z.number().int().min(0).max(23).optional(),
  hasta: z.number().int().min(0).max(23).optional(),
});

type PedidoDePronostico = z.infer<typeof esquemaPedidoDePronostico>;

// Lo que devuelve verPronostico: el tiempo de ese día por tramos (las horas seguidas con el mismo cielo).
// La página lo muestra como una tarjeta (ver web/components/asistente).
export const esquemaPronosticoDelChat = z.object({
  tramos: z.array(
    z.object({
      desde: z.string(),
      hasta: z.string(),
      cielo: z.enum(CIELOS),
      descripcion: z.string(),
      deNoche: z.boolean(),
      minima: z.number(),
      maxima: z.number(),
    }),
  ),
  // Por qué no hay pronóstico, por ejemplo si el día no se puede reservar o si el servicio no responde
  aviso: z.string().optional(),
});

export type PronosticoDelChat = z.infer<typeof esquemaPronosticoDelChat>;

async function verPronostico({ fecha, desde, hasta }: PedidoDePronostico, meteorologo: Meteorologo): Promise<PronosticoDelChat> {
  const dias = diasReservables();
  if (!dias.includes(fecha)) {
    return { tramos: [], aviso: `Solo hay pronóstico de los días que se pueden reservar: desde hoy hasta el ${nombreDelDia(dias.at(-1)!)}.` };
  }

  const datos = await meteorologo.datos();
  if (!datos) return { tramos: [], aviso: "El pronóstico no está disponible en este momento." };

  const horas = pronosticoDelDia(datos, fecha).filter(({ hora }) => {
    const numero = Number(hora.slice(0, 2));
    return (desde === undefined || numero >= desde) && (hasta === undefined || numero <= hasta);
  });
  return { tramos: tramosDelPronostico(horas) };
}

// Lo que lee el modelo:
//
// Pronóstico en Santiago el sábado 24 de octubre (2026-10-24) desde las 19:00:
// 19:00 a 21:00: lluvia ligera, 16 a 18 °C
// 21:00 a 23:00: nublado, 14 °C
export function pronosticoParaLaIA(pedido: PedidoDePronostico, { tramos, aviso }: PronosticoDelChat) {
  if (aviso) return aviso;
  if (tramos.length === 0) return `No hay pronóstico para ${cuandoDelPedido(pedido)}.`;
  return [`Pronóstico en Santiago ${cuandoDelPedido(pedido)}:`, ...tramos.map(describirTramo)].join("\n");
}

// Se arman en cada mensaje con el usuario de la sesión (o sin usuario, si no entró): así la IA ve las reservas
// propias como propias, igual que la grilla de la página, y reserva a nombre de quien conversa.
// "modeloDeVectores" es el que busca en la información del club por significado; sin él, se busca por palabras.
// "avisador" y "cartero" avisan en vivo y envían el correo al reservar o cancelar (ver reservas.ts).
// "meteorologo" trae el pronóstico del tiempo (ver meteorologo.ts).
export function crearHerramientas({
  usuario,
  modeloDeVectores = null,
  avisador = sinAvisos,
  cartero = sinCorreos,
  meteorologo = sinPronostico,
}: Partial<ContextoDeReservas> & { modeloDeVectores?: EmbeddingModel | null } = {}) {
  return {
    verHorariosLibres: tool({
      description:
        "Las horas libres de un día del club, con su precio y las canchas libres. Úsala siempre antes de decir si hay cancha.",
      inputSchema: esquemaPedidoDeHorarios,
      outputSchema: esquemaHorariosLibres,
      execute: (pedido) => verHorariosLibres(pedido, usuario?.id),
      toModelOutput: ({ input, output }) => ({ type: "text", value: resumenParaLaIA(input, output) }),
    }),
    buscarInformacion: tool({
      description:
        "Busca en los documentos del club: reglamento, servicios (paletas, pelotas, camarines, estacionamiento, cafetería), " +
        "clases, liga, pagos y cómo llegar. Úsala para cualquier pregunta del club que no sea de horas libres ni de precios de cancha.",
      inputSchema: esquemaPedidoDeInformacion,
      outputSchema: esquemaInformacionDelClub,
      execute: (pedido) => buscarInformacion(pedido, modeloDeVectores),
      toModelOutput: ({ output }) => ({ type: "text", value: informacionParaLaIA(output) }),
    }),
    verPronostico: tool({
      description:
        "El tiempo en Santiago un día que se puede reservar. desde y hasta son horas (19 = las 19:00), para ver solo esas.",
      inputSchema: esquemaPedidoDePronostico,
      outputSchema: esquemaPronosticoDelChat,
      execute: (pedido) => verPronostico(pedido, meteorologo),
      toModelOutput: ({ input, output }) => ({ type: "text", value: pronosticoParaLaIA(input, output) }),
    }),
    ...crearHerramientasDeReservas({ usuario, avisador, cartero, meteorologo }),
  };
}

export type Herramientas = ReturnType<typeof crearHerramientas>;
