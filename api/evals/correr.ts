import { mkdirSync, writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { modeloDeGuion } from "../src/asistente/guion.ts";
import { horasLibres } from "../src/asistente/herramientas.ts";
import { MODELOS_DE_GROQ, modeloDeVectores, modelosParaConversar } from "../src/asistente/modelos.ts";
import { config } from "../src/config.ts";
import { db } from "../src/db.ts";
import { diasReservables, ZONA_HORARIA } from "../src/servicios/horario.ts";
import { crearInvitado } from "../src/servicios/invitados.ts";
import { crearReserva, disponibilidadDelClub } from "../src/servicios/reservas.ts";
import { type Contexto, casos, preguntaDelCaso } from "./casos.ts";
import { esperandoLaCuota, evaluarCaso, type Resultado } from "./evaluar.ts";

// Las evals: le hacen al asistente unas 20 preguntas con la IA de verdad y revisan cada respuesta.
//
//   npm run evals                        con el modelo principal (openai/gpt-oss-120b)
//   npm run evals -- openai/gpt-oss-20b  con otro modelo de la cadena de respaldo
//   npm run evals -- guion               con el asistente de guion, para probar las evals sin gastar cuota
//                                        (no es una IA: reprueba varios casos, y no se guarda el resultado)
//
// Gastan la cuota gratis de Groq (unos 80.000 tokens, de los 200.000 que da al día cada modelo), así que se corren
// a mano y no en cada push. Necesitan la base de datos local (Docker) y GROQ_API_KEY; con GEMINI_API_KEY, la
// información del club se busca por significado, como en la demo publicada.
// Escriben los resultados en evals/resultados/<modelo>.md.

const idDelModelo = process.argv[2] ?? MODELOS_DE_GROQ[0];
const deGuion = idDelModelo === "guion";
const modelo = deGuion
  ? modeloDeGuion()
  : modelosParaConversar({ groq: config.GROQ_API_KEY, gemini: config.GEMINI_API_KEY }).find((m) => m.modelId === idDelModelo);
if (!modelo) {
  console.error(`No se encontró el modelo ${idDelModelo}. ¿Está la clave en api/.env? Los modelos son: ${MODELOS_DE_GROQ.join(", ")}.`);
  process.exit(1);
}
const vectores = config.GEMINI_API_KEY && !deGuion ? modeloDeVectores(config.GEMINI_API_KEY) : null;

const numero = (n: number) => n.toLocaleString("es-CL");

// Dos jugadores invitados con reservas mañana, en horas distintas a la que piden los casos de reservar.
// Son invitados de verdad: si las evals se cortan a la mitad, la API los borra sola al día siguiente.
async function prepararContexto(): Promise<Contexto & { invitados: string[] }> {
  const dias = diasReservables();
  const manana = dias[1];

  const delClub = await disponibilidadDelClub(manana);
  const deNoche = horasLibres(delClub, { desde: 19 });
  const horasDeManana =
    deNoche.horas.length > 0
      ? { pedido: { fecha: manana, desde: 19 }, horarios: deNoche }
      : { pedido: { fecha: manana, desde: 8 }, horarios: horasLibres(delClub, { desde: 8 }) };
  const horaPedida = horasDeManana.horarios.horas[0]?.hora;
  if (!horaPedida) throw new Error(`Mañana (${manana}) no queda ninguna hora libre: las evals necesitan una.`);

  // Tres horas con alguna cancha libre para las reservas de los jugadores, sin usar la hora que piden los casos
  const libres = delClub
    .filter((h) => h.hora !== horaPedida)
    .flatMap(({ inicio, canchas }) => {
      const libre = canchas.find((cancha) => cancha.estado === "libre");
      return libre ? [{ inicio, canchaId: libre.id }] : [];
    })
    .slice(0, 3);
  if (libres.length < 3) throw new Error(`Mañana (${manana}) quedan pocas horas libres: las evals necesitan 4.`);

  const uno = await crearInvitado();
  const dos = await crearInvitado();
  const reserva = await crearReserva(uno.id, libres[0].canchaId, libres[0].inicio);
  await crearReserva(dos.id, libres[1].canchaId, libres[1].inicio);
  await crearReserva(dos.id, libres[2].canchaId, libres[2].inicio);

  return {
    dias,
    horasDeManana,
    conUnaReserva: { usuario: uno, reservaId: reserva.id },
    conDosReservas: { usuario: dos },
    invitados: [uno.id, dos.id],
  };
}

async function borrarInvitados(ids: string[]) {
  await db.$transaction([
    db.reserva.deleteMany({ where: { usuarioId: { in: ids } } }),
    db.usuario.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

// ---------- El archivo con los resultados ----------

const celda = (texto: string) => texto.replaceAll("|", "\\|").replaceAll("\n", " ");

function informe(resultados: Resultado[], { segundos }: { segundos: number }) {
  const pasaron = resultados.filter((r) => r.problemas.length === 0).length;
  const tokens = resultados.reduce((suma, r) => suma + r.tokens, 0);
  const pedidos = resultados.reduce((suma, r) => suma + r.pedidos, 0);
  const fecha = DateTime.now().setZone(ZONA_HORARIA).toFormat("yyyy-MM-dd HH:mm");

  const filas = resultados.map((r, i) => {
    const resultado = r.problemas.length === 0 ? "✅" : `❌ ${r.problemas.join("; ")}`;
    const herramientas = r.respuesta.herramientas.map((h) => h.nombre).join(", ") || "—";
    return `| ${i + 1} | ${r.caso.tema} | ${celda(preguntaDelCaso(r.caso))} | ${celda(resultado)} | ${herramientas} | ${numero(r.tokens)} |`;
  });

  const respuestas = resultados.map((r, i) =>
    [`**${i + 1}. ${preguntaDelCaso(r.caso)}**`, "", `> ${r.respuesta.texto || "(sin texto: solo pidió confirmar)"}`].join("\n"),
  );

  return [
    `# Evals del asistente: \`${idDelModelo}\``,
    "",
    `**${pasaron} de ${resultados.length} casos pasaron** · ${fecha} (hora de Chile) · ${numero(pedidos)} pedidos a la IA,`,
    `${numero(tokens)} tokens y ${Math.round(segundos / 60)} minutos (con las esperas por el límite de tokens por minuto).`,
    "",
    "Cada caso le hace una pregunta al asistente con la IA de verdad y revisa la respuesta con reglas fijas:",
    "qué herramienta usó y con qué datos, qué dice y qué no dice (ver `casos.ts`). Todas las respuestas pasan además",
    'por las revisiones de estilo: de "tú", sin Markdown, breve y sin el id de una reserva (ver `revisar.ts`).',
    "Se corren a mano con `npm run evals`, porque gastan la cuota gratis de la IA.",
    "",
    "| # | Tema | Pregunta | Resultado | Herramientas | Tokens |",
    "|---|---|---|---|---|---|",
    ...filas,
    "",
    "## Lo que respondió",
    "",
    respuestas.join("\n\n"),
    "",
  ].join("\n");
}

// ---------- Las evals ----------

console.log(`Evals del asistente con ${idDelModelo} (${vectores ? "búsqueda por significado" : "búsqueda por palabras"})\n`);

const inicio = performance.now();
const contexto = await prepararContexto();
const resultados: Resultado[] = [];

try {
  const lista = casos(contexto);
  for (const [i, caso] of lista.entries()) {
    const resultado = await evaluarCaso(esperandoLaCuota(modelo), caso, { modeloDeVectores: vectores });
    resultados.push(resultado);
    const marca = resultado.problemas.length === 0 ? "✅" : "❌";
    console.log(
      `${marca} ${i + 1}/${lista.length} ${caso.tema} · ${preguntaDelCaso(caso)} ` +
        `(${resultado.pedidos} pedidos, ${numero(resultado.tokens)} tokens, ${resultado.segundos.toFixed(1)} s)`,
    );
    for (const problema of resultado.problemas) console.log(`   ${problema}`);
  }
} finally {
  await borrarInvitados(contexto.invitados);
  await db.$disconnect();
}

const segundos = (performance.now() - inicio) / 1000;
const pasaron = resultados.filter((r) => r.problemas.length === 0).length;
console.log(`\n${pasaron} de ${resultados.length} casos pasaron en ${Math.round(segundos)} s.`);

if (!deGuion) {
  const nombre = `${idDelModelo.replaceAll("/", "-")}.md`;
  const carpeta = new URL("./resultados/", import.meta.url);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(new URL(nombre, carpeta), informe(resultados, { segundos }));
  console.log(`Resultados en evals/resultados/${nombre}`);
}
