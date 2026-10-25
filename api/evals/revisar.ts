// Las revisiones de las evals: reglas simples que miran la respuesta del asistente.
//
// No se le pregunta a otra IA si la respuesta está bien (eso gastaría el doble de cuota y también se puede
// equivocar). Cada revisión mira algo concreto: qué herramienta usó y con qué datos, o si el texto dice
// (o no dice) algo. Si encuentra un problema, lo devuelve escrito; si no, devuelve null.

// Una herramienta que usó el asistente: con qué datos y cómo terminó.
// "approval-requested" es una reserva o cancelación que espera a que la persona toque "Confirmar".
export type HerramientaUsada = { nombre: string; entrada: Record<string, unknown>; estado: string };

// Lo que respondió el asistente a un caso: todo el texto junto y las herramientas, en orden
export type Respuesta = { texto: string; herramientas: HerramientaUsada[] };

export type Revision = (respuesta: Respuesta) => string | null;

const comoTexto = (herramienta: HerramientaUsada) => `${herramienta.nombre} ${JSON.stringify(herramienta.entrada)}`;

function usadas({ herramientas }: Respuesta) {
  return herramientas.length === 0 ? "ninguna" : herramientas.map(comoTexto).join(", ");
}

// "esperada" puede ser una parte de los datos (por ejemplo { fecha: "2026-10-26", desde: 19 }) o una condición,
// con "como" para explicarla en el resultado
type Esperada = Record<string, unknown> | ((entrada: Record<string, unknown>) => boolean);

function cumple(herramienta: HerramientaUsada, esperada: Esperada) {
  if (typeof esperada === "function") return esperada(herramienta.entrada);
  return Object.entries(esperada).every(([clave, valor]) => herramienta.entrada[clave] === valor);
}

const descripcion = (esperada: Esperada, como?: string) =>
  typeof esperada === "function" ? (como ?? "la condición pedida") : JSON.stringify(esperada);

export function usa(nombre: string, esperada: Esperada = {}, como?: string): Revision {
  return (respuesta) =>
    respuesta.herramientas.some((h) => h.nombre === nombre && cumple(h, esperada))
      ? null
      : `No usó ${nombre} con ${descripcion(esperada, como)} (usó: ${usadas(respuesta)})`;
}

export function noUsa(nombre: string): Revision {
  return (respuesta) =>
    respuesta.herramientas.some((h) => h.nombre === nombre) ? `Usó ${nombre} (usó: ${usadas(respuesta)})` : null;
}

export function sinHerramientas(): Revision {
  return (respuesta) => (respuesta.herramientas.length === 0 ? null : `Usó herramientas sin necesidad (${usadas(respuesta)})`);
}

// Que haya propuesto una reserva o una cancelación, y que esté esperando a la persona
export function pideConfirmar(nombre: string, esperada: Esperada = {}, como?: string): Revision {
  return (respuesta) =>
    respuesta.herramientas.some((h) => h.nombre === nombre && h.estado === "approval-requested" && cumple(h, esperada))
      ? null
      : `No pidió confirmar ${nombre} con ${descripcion(esperada, como)} (usó: ${usadas(respuesta)})`;
}

export function dice(patron: RegExp, que: string): Revision {
  return ({ texto }) => (patron.test(texto) ? null : `No dice ${que}`);
}

export function noDice(patron: RegExp, que: string): Revision {
  return ({ texto }) => {
    const encontrado = patron.exec(texto)?.[0];
    return encontrado === undefined ? null : `Dice ${que}: "${encontrado}"`;
  };
}

// ---------- El estilo, que se revisa en todas las respuestas ----------

// Las instrucciones piden hablar de "tú". Solo las formas de "vos" que no se confunden con otra cosa
// ("elegí" también es "yo elegí", así que solo cuenta al empezar una frase, como una orden).
// (?<!\p{L}) y (?!\p{L}) marcan dónde empieza y termina la palabra: \b no sirve con las letras con tilde.
const VOSEO =
  /(?<!\p{L})(podés|querés|tenés|sabés|tocá|mirá|fijate|decime|contame|avisame|escribime|reservá|confirmá|cancelá)(?!\p{L})|(^|[.!?¡¿]\s*)elegí(?!\p{L})/iu;

// Las instrucciones piden texto simple: el chat no dibuja Markdown, y se verían los asteriscos y los #
const MARKDOWN = /\*\*|__|^#{1,6}\s|^\s*\*\s|^\s*\|.*\|\s*$/mu;

// "Amable y breve (1 a 3 frases)". Se deja margen: unas 4 frases normales.
export const MAXIMO_CARACTERES = 450;

// El id de una reserva (un UUID) nunca se le muestra a la persona
const ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu;

export const revisionesDeEstilo: Revision[] = [
  noDice(VOSEO, 'palabras de "vos"'),
  noDice(MARKDOWN, "Markdown"),
  ({ texto }) => (texto.length <= MAXIMO_CARACTERES ? null : `Es muy larga: ${texto.length} caracteres (máximo ${MAXIMO_CARACTERES})`),
  noDice(ID, "el id de una reserva"),
];
