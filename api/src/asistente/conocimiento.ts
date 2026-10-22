import { readdirSync, readFileSync } from "node:fs";
import { cosineSimilarity, embed, type EmbeddingModel } from "ai";
import { z } from "zod";
import { DIMENSIONES_DE_LOS_VECTORES, MODELO_DE_VECTORES } from "./modelos.ts";

// La información del club que usa el asistente para responder (lo que se llama RAG: primero buscar, después responder).
//
// Los documentos son archivos de texto en api/conocimiento/ (el reglamento, los servicios, las clases...).
// Cada uno se corta en pedazos, uno por sección, y `npm run indexar` le pide a Gemini el "vector" de cada pedazo:
// una lista de 768 números que representa lo que dice. Dos textos que hablan de lo mismo tienen vectores parecidos,
// aunque usen otras palabras ("¿dónde dejo el auto?" y "Estacionamiento"). Los vectores se guardan en indice.json.
//
// Cuando alguien pregunta, se pide el vector de la pregunta y se eligen los pedazos con el vector más parecido.
// Al modelo se le pasan solo esos pedazos, no todos los documentos: así gasta menos tokens y se confunde menos.

const CARPETA = new URL("../../conocimiento/", import.meta.url);
export const ARCHIVO_DEL_INDICE = new URL("indice.json", CARPETA);

// Cuántos pedazos se le pasan al modelo como mucho en cada búsqueda
export const MAXIMO_PEDAZOS = 3;

// Lo más que se espera a Gemini para calcular el vector de una pregunta. Si tarda más, se busca por palabras:
// es mejor una respuesta un poco peor que dejar a la persona esperando.
const ESPERA_MAXIMA_MS = 3000;

export type Pedazo = {
  id: string; // el archivo y la sección, por ejemplo "servicios#arriendo-de-paletas"
  documento: string; // el título del documento, por ejemplo "Servicios del club"
  seccion: string; // el título de la sección, por ejemplo "Arriendo de paletas"
  texto: string;
};

export type FormaDeBuscar = "significado" | "palabras";

// "Arriendo de Paletas" → "arriendo de paletas", "¿Dónde?" → "¿donde?"
function sinTildes(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// "Arriendo de paletas" → "arriendo-de-paletas"
function enLaDireccion(texto: string) {
  return sinTildes(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Corta un documento en pedazos, uno por sección (cada "## Título"). Cada pedazo lleva el título del documento
// y el de su sección: así el modelo sabe de dónde salió lo que lee y lo puede decir.
export function cortarEnPedazos(archivo: string, contenido: string): Pedazo[] {
  // En Windows, git puede entregar los archivos con saltos de línea "\r\n": se dejan como "\n" para que
  // el texto sea el mismo en cualquier computador (y en el CI, que corre en Linux)
  const [principio, ...secciones] = contenido.replaceAll("\r\n", "\n").split(/^## /m);
  const documento = principio.match(/^# (.+)$/m)?.[1].trim();
  if (!documento) throw new Error(`${archivo} no tiene un título que empiece con "# "`);

  return secciones.map((seccion) => {
    const [titulo, ...lineas] = seccion.split("\n");
    return {
      id: `${archivo.replace(/\.md$/, "")}#${enLaDireccion(titulo)}`,
      documento,
      seccion: titulo.trim(),
      texto: lineas.join("\n").trim(),
    };
  });
}

// Todos los pedazos de todos los documentos de api/conocimiento/, en orden
export function leerDocumentos(): Pedazo[] {
  return readdirSync(CARPETA)
    .filter((archivo) => archivo.endsWith(".md"))
    .sort()
    .flatMap((archivo) => cortarEnPedazos(archivo, readFileSync(new URL(archivo, CARPETA), "utf8")));
}

// Gemini Embedding 2 no recibe el tipo de tarea como opción: se escribe al principio del texto, con el formato
// que pide su documentación. Los pedazos van con su título y las preguntas, como búsqueda.
export const textoDelPedazoParaElVector = ({ documento, seccion, texto }: Pedazo) =>
  `title: ${documento} › ${seccion} | text: ${texto}`;
export const textoDeLaPreguntaParaElVector = (pregunta: string) => `task: search result | query: ${pregunta}`;

// El índice: cada pedazo con su vector, y el modelo con que se calcularon.
// Los vectores de dos modelos distintos no se pueden comparar, por eso el índice dice cuál usó.
const esquemaDelIndice = z.object({
  modelo: z.literal(MODELO_DE_VECTORES),
  dimensiones: z.literal(DIMENSIONES_DE_LOS_VECTORES),
  pedazos: z.array(
    z.object({
      id: z.string(),
      documento: z.string(),
      seccion: z.string(),
      texto: z.string(),
      vector: z.array(z.number()).length(DIMENSIONES_DE_LOS_VECTORES),
    }),
  ),
});

export type Indice = z.infer<typeof esquemaDelIndice>;

// El contenido de indice.json, con un pedazo por línea (y no un número por línea), para que el archivo se pueda leer
// y en git se vea qué pedazo cambió. Los números se redondean a 6 decimales: el archivo pesa la mitad y
// los parecidos cambian recién en el quinto decimal.
export function contenidoDelIndice(pedazos: (Pedazo & { vector: number[] })[]) {
  const lineas = pedazos.map((pedazo) =>
    JSON.stringify({ ...pedazo, vector: pedazo.vector.map((numero) => Number(numero.toFixed(6))) }),
  );
  return [
    "{",
    `  "modelo": ${JSON.stringify(MODELO_DE_VECTORES)},`,
    `  "dimensiones": ${DIMENSIONES_DE_LOS_VECTORES},`,
    '  "pedazos": [',
    lineas.map((linea) => `    ${linea}`).join(",\n"),
    "  ]",
    "}",
    "",
  ].join("\n");
}

let indice: Indice | undefined;

// Se lee una sola vez, la primera vez que se necesita (server.ts lo lee al arrancar, así un índice roto se nota de inmediato)
export function indiceDelClub(): Indice {
  indice ??= esquemaDelIndice.parse(JSON.parse(readFileSync(ARCHIVO_DEL_INDICE, "utf8")));
  return indice;
}

export function pedazoPorId(id: string): Pedazo | undefined {
  return indiceDelClub().pedazos.find((pedazo) => pedazo.id === id);
}

// Palabras que aparecen en casi cualquier pregunta y no ayudan a encontrar nada (escritas sin tildes)
const PALABRAS_VACIAS = new Set(
  (
    "que los las del una unos unas por con para como mas pero sus son ser hay esta estan este esto ese esa eso " +
    "mis tus nos muy sin sobre entre cuando donde cual cuales cuanto cuanta cuantos cuantas quien puedo puede " +
    "pueden tengo tiene tienen hago hace hacer tambien club volea hola gracias favor quiero saber algo alguna"
  ).split(" "),
);

// Las "raíces" de las palabras importantes de un texto: sin tildes, sin palabras vacías y cortadas en 5 letras.
// Cortarlas es una forma simple de juntar las variantes: "paleta" y "paletas" quedan en "palet", y
// "estaciono" y "estacionamiento", en "estac". No es perfecto, pero para unos pocos documentos funciona bien.
export function raices(texto: string) {
  return sinTildes(texto)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length >= 3 && !PALABRAS_VACIAS.has(palabra))
    .map((palabra) => palabra.slice(0, 5));
}

// La búsqueda de respaldo, cuando no se puede usar Gemini (sin clave, sin cuota o en los tests): por palabras en común.
// Cada palabra de la pregunta que aparece en un pedazo suma puntos, más si es rara (aparece en pocos pedazos)
// y el doble si está en el título de la sección. Busca peor que por significado, pero el asistente sigue respondiendo.
export function buscarPorPalabras(pregunta: string, pedazos: Pedazo[]): Pedazo[] {
  const buscadas = new Set(raices(pregunta));
  const enCadaPedazo = pedazos.map(({ documento, seccion, texto }) => ({
    titulo: new Set(raices(`${documento} ${seccion}`)),
    todo: new Set(raices(`${documento} ${seccion} ${texto}`)),
  }));

  // Una palabra que aparece en pocos pedazos dice más que una que aparece en todos (lo que se llama IDF)
  const rareza = (raiz: string) =>
    Math.log(1 + pedazos.length / enCadaPedazo.filter(({ todo }) => todo.has(raiz)).length);

  const puntajes = pedazos.map((pedazo, i) => {
    let puntaje = 0;
    for (const raiz of buscadas) {
      if (enCadaPedazo[i].todo.has(raiz)) puntaje += rareza(raiz) * (enCadaPedazo[i].titulo.has(raiz) ? 2 : 1);
    }
    return { pedazo, puntaje };
  });

  return elegirLosMejores(puntajes, ({ puntaje }, mejor) => puntaje > 0 && puntaje >= mejor / 2);
}

// Qué tan parecida tiene que ser una sección a la pregunta para pasársela al modelo (de -1 a 1).
// Se midió con 16 preguntas de prueba: la sección que responde quedó entre 0,70 y 0,85, y con preguntas que no son
// del club ("¿cuál es la capital de Francia?") la más parecida no pasó de 0,58. Además se dejan solo las que están
// cerca de la mejor: las que quedaron a más de 0,04 casi nunca servían para responder.
export const PARECIDO_MINIMO = 0.65;
export const DISTANCIA_A_LA_MEJOR = 0.04;

async function buscarPorSignificado(pregunta: string, modelo: EmbeddingModel): Promise<Pedazo[]> {
  const { embedding } = await embed({
    model: modelo,
    value: textoDeLaPreguntaParaElVector(pregunta),
    dimensions: DIMENSIONES_DE_LOS_VECTORES,
    // Si Gemini falla, no se reintenta: se busca por palabras de inmediato
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  });

  const parecidos = indiceDelClub().pedazos.map(({ vector, ...pedazo }) => ({
    pedazo,
    puntaje: cosineSimilarity(embedding, vector),
  }));

  return elegirLosMejores(
    parecidos,
    ({ puntaje }, mejor) => puntaje >= PARECIDO_MINIMO && puntaje >= mejor - DISTANCIA_A_LA_MEJOR,
  );
}

// Ordena de mayor a menor puntaje y deja los que cumplen "sirve" (comparando con el mejor), como mucho MAXIMO_PEDAZOS
function elegirLosMejores(
  candidatos: { pedazo: Pedazo; puntaje: number }[],
  sirve: (candidato: { puntaje: number }, mejor: number) => boolean,
): Pedazo[] {
  const ordenados = [...candidatos].sort((a, b) => b.puntaje - a.puntaje);
  const mejor = ordenados[0]?.puntaje ?? 0;
  return ordenados
    .filter((candidato) => sirve(candidato, mejor))
    .slice(0, MAXIMO_PEDAZOS)
    .map(({ pedazo }) => pedazo);
}

// Busca en la información del club. Con "modeloDeVectores" (Gemini) busca por significado; sin él, o si Gemini
// falla, por palabras. Devuelve también cómo buscó, para saberlo en los tests y en el log.
export async function buscarEnElClub(
  pregunta: string,
  modeloDeVectores: EmbeddingModel | null,
): Promise<{ pedazos: Pedazo[]; forma: FormaDeBuscar }> {
  if (modeloDeVectores) {
    try {
      return { pedazos: await buscarPorSignificado(pregunta, modeloDeVectores), forma: "significado" };
    } catch (error) {
      console.error("No se pudo buscar por significado (se busca por palabras):", error);
    }
  }

  return { pedazos: buscarPorPalabras(pregunta, indiceDelClub().pedazos), forma: "palabras" };
}
