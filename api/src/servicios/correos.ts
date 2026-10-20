import { DateTime } from "luxon";
import type { Cartero, Correo } from "../cartero.ts";
import { db } from "../db.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { ZONA_HORARIA } from "./horario.ts";
import type { UsuarioSesion } from "./sesion.ts";

// Los correos que reciben los jugadores al reservar y al cancelar.
// Cada correo va en HTML (con estilos escritos en cada etiqueta, porque muchos programas de correo
// ignoran las hojas de estilo) y en texto simple, para los programas que no muestran HTML.

type DatosDelCorreo = {
  reserva: { id: string; inicio: Date; fin: Date; precio: number; recurso: { nombre: string } };
  usuario: { nombre: string; email: string };
};

const NOMBRE_DEL_CLUB = "Club Volea";

// Los correos de example.com (y de sus subdominios, como invitados.example.com) no existen: es un dominio
// reservado para ejemplos. Ahí no se envía nada: son los jugadores demo, los socios y los usuarios de los tests.
export function esCorreoDeVerdad(email: string) {
  return !/(^|[@.])example\.(com|net|org)$/i.test(email);
}

// Todo lo que viene de los usuarios (su nombre, el nombre de la cancha) se "escapa" antes de ponerlo en el HTML.
// Si alguien se registra con el nombre "<script>…", el correo muestra ese texto, en vez de tomarlo como código.
export function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function enElClub(fecha: Date) {
  return DateTime.fromJSDate(fecha, { zone: ZONA_HORARIA }).setLocale("es");
}

function describir({ reserva }: DatosDelCorreo) {
  const inicio = enElClub(reserva.inicio);
  return {
    cancha: reserva.recurso.nombre,
    dia: inicio.toFormat("cccc d 'de' LLLL"), // "miércoles 21 de octubre"
    horario: `${inicio.toFormat("HH:mm")} a ${enElClub(reserva.fin).toFormat("HH:mm")}`,
    precio: new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(reserva.precio),
  };
}

// Una fecha en UTC con el formato que piden los calendarios: 20261021T220000Z
function fechaParaCalendario(fecha: Date) {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// El link que abre Google Calendar con el evento ya escrito, listo para guardarlo
export function linkDeGoogleCalendar({ reserva }: DatosDelCorreo) {
  const parametros = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pádel en Volea · ${reserva.recurso.nombre}`,
    dates: `${fechaParaCalendario(reserva.inicio)}/${fechaParaCalendario(reserva.fin)}`,
    location: NOMBRE_DEL_CLUB,
  });
  return `https://calendar.google.com/calendar/render?${parametros}`;
}

// Un archivo .ics: el formato de calendario que entienden Google, Apple y Outlook.
// En el texto se escapan las comas, los punto y coma y las barras, porque en este formato tienen un significado.
export function eventoDeCalendario({ reserva }: DatosDelCorreo, ahora = new Date()) {
  const escapar = (texto: string) => texto.replace(/[\\;,]/g, (caracter) => `\\${caracter}`).replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volea//Reservas//ES",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reserva.id}@volea`,
    `DTSTAMP:${fechaParaCalendario(ahora)}`,
    `DTSTART:${fechaParaCalendario(reserva.inicio)}`,
    `DTEND:${fechaParaCalendario(reserva.fin)}`,
    `SUMMARY:${escapar(`Pádel en Volea · ${reserva.recurso.nombre}`)}`,
    `LOCATION:${escapar(NOMBRE_DEL_CLUB)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n"); // el formato pide saltos de línea de Windows (CRLF)
}

// El "esqueleto" de todos los correos: logo, título, texto, los datos de la reserva, un botón opcional y el pie
function plantilla({
  asunto,
  titulo,
  intro,
  datos,
  boton,
}: {
  asunto: string;
  titulo: string;
  intro: string;
  datos: DatosDelCorreo;
  boton?: { texto: string; url: string };
}) {
  const { cancha, dia, horario, precio } = describir(datos);
  const filas = [
    ["Cancha", cancha],
    ["Día", dia],
    ["Horario", horario],
    ["Precio", precio],
  ];

  const filasHtml = filas
    .map(
      ([nombre, valor]) =>
        `<tr><td style="padding:6px 0;color:#64748b;width:90px">${nombre}</td><td style="padding:6px 0;font-weight:bold">${escaparHtml(valor)}</td></tr>`,
    )
    .join("");
  const botonHtml = boton
    ? `<tr><td style="padding:0 24px 24px"><a href="${escaparHtml(boton.url)}" target="_blank" rel="noopener" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escaparHtml(boton.texto)}</a></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escaparHtml(asunto)}</title></head>
<body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
<tr><td style="padding:24px 24px 0;font-size:20px;font-weight:bold"><span style="color:#65a30d">&#9679;</span> Volea</td></tr>
<tr><td style="padding:16px 24px 0"><h1 style="margin:0;font-size:22px">${escaparHtml(titulo)}</h1><p style="margin:8px 0 0;color:#475569;line-height:1.5">${escaparHtml(intro)}</p></td></tr>
<tr><td style="padding:16px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${filasHtml}</table></td></tr>
${botonHtml}
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5">Volea es un club ficticio: este correo viene de una demo de portafolio.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const texto = [
    titulo,
    "",
    intro,
    "",
    ...filas.map(([nombre, valor]) => `${nombre}: ${valor}`),
    ...(boton ? ["", `${boton.texto}: ${boton.url}`] : []),
    "",
    "Volea es un club ficticio: este correo viene de una demo de portafolio.",
  ].join("\n");

  return { html, texto };
}

function asuntoDe(prefijo: string, datos: DatosDelCorreo) {
  const { cancha, dia, horario } = describir(datos);
  return `${prefijo}: ${cancha}, ${dia} a las ${horario.slice(0, 5)}`;
}

export function correoDeReservaConfirmada(datos: DatosDelCorreo): Correo {
  const asunto = asuntoDe("Reserva confirmada", datos);
  const { html, texto } = plantilla({
    asunto,
    titulo: "¡Tu cancha está reservada!",
    intro: `Hola, ${datos.usuario.nombre}. Te esperamos. Si no puedes venir, cancela la reserva desde "Mis reservas" antes de que empiece la hora, así la cancha queda libre para otros jugadores.`,
    datos,
    boton: { texto: "Agregar a Google Calendar", url: linkDeGoogleCalendar(datos) },
  });

  return {
    para: datos.usuario,
    asunto,
    html,
    texto,
    adjuntos: [{ nombre: "reserva-volea.ics", contenido: eventoDeCalendario(datos) }],
  };
}

export function correoDeReservaCancelada(datos: DatosDelCorreo, { porElClub }: { porElClub: boolean }): Correo {
  const asunto = asuntoDe("Reserva cancelada", datos);
  const { html, texto } = plantilla({
    asunto,
    titulo: porElClub ? "El club canceló tu reserva" : "Cancelaste tu reserva",
    intro: porElClub
      ? `Hola, ${datos.usuario.nombre}. El club tuvo que cancelar esta reserva. Si quieres, puedes reservar otro horario.`
      : `Hola, ${datos.usuario.nombre}. Tu reserva quedó cancelada y la cancha volvió a quedar libre para otros jugadores.`,
    datos,
  });

  return { para: datos.usuario, asunto, html, texto };
}

// Los datos de una reserva que hacen falta para armar su correo
export function datosDelCorreo(reservaId: string) {
  return db.reserva.findUnique({
    where: { id: reservaId },
    select: {
      id: true,
      inicio: true,
      fin: true,
      precio: true,
      usuarioId: true,
      recurso: { select: { nombre: true } },
      usuario: { select: { nombre: true, email: true } },
    },
  });
}

// Arma y envía el correo de una reserva, solo si el jugador tiene un correo de verdad.
// Nunca lanza un error: si el envío falla, se anota en el log del servidor, porque la reserva
// ya quedó hecha (o cancelada) y eso es lo importante.
export async function enviarCorreoDeLaReserva(
  cartero: Cartero,
  reservaId: string,
  cual: { tipo: "confirmada" } | { tipo: "cancelada"; porElClub: boolean },
) {
  try {
    const reserva = await datosDelCorreo(reservaId);
    if (!reserva || !esCorreoDeVerdad(reserva.usuario.email)) return;

    const datos = { reserva, usuario: reserva.usuario };
    await cartero.enviar(cual.tipo === "confirmada" ? correoDeReservaConfirmada(datos) : correoDeReservaCancelada(datos, cual));
  } catch (error) {
    console.error(`No se pudo enviar el correo de la reserva ${reservaId}:`, error);
  }
}

// Para la vista previa de la página: el correo de confirmación de una reserva, tal como se envía.
// Lo puede ver el dueño de la reserva o un admin. "seEnvia" dice si de verdad se manda (solo a correos reales).
export async function vistaPreviaDelCorreo(reservaId: string, usuario: UsuarioSesion) {
  const reserva = await datosDelCorreo(reservaId);

  if (!reserva) {
    throw new ErrorHttp(404, "La reserva no existe");
  }
  if (reserva.usuarioId !== usuario.id && usuario.rol !== "ADMIN") {
    throw new ErrorHttp(403, "Solo puedes ver los correos de tus propias reservas");
  }

  const correo = correoDeReservaConfirmada({ reserva, usuario: reserva.usuario });
  return { para: correo.para.email, asunto: correo.asunto, html: correo.html, seEnvia: esCorreoDeVerdad(correo.para.email) };
}
