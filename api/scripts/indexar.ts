import "dotenv/config";
import { writeFileSync } from "node:fs";
import { embedMany } from "ai";
import {
  ARCHIVO_DEL_INDICE,
  contenidoDelIndice,
  leerDocumentos,
  textoDelPedazoParaElVector,
} from "../src/asistente/conocimiento.ts";
import { DIMENSIONES_DE_LOS_VECTORES, MODELO_DE_VECTORES, modeloDeVectores } from "../src/asistente/modelos.ts";

// npm run indexar: corta los documentos de api/conocimiento/ en pedazos, le pide a Gemini el vector de cada uno
// y guarda todo en api/conocimiento/indice.json, que se sube al repo junto a los documentos.
//
// Se corre a mano cada vez que se cambia un documento (un test avisa si se olvidó). Así la API no le pide
// a Gemini los vectores de los documentos al arrancar: solo el de cada pregunta.

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Falta GEMINI_API_KEY en api/.env (se crea en aistudio.google.com > Get API key).");
  process.exit(1);
}

const pedazos = leerDocumentos();

// Todos los pedazos van en un solo pedido a Gemini (acepta hasta 100)
const { embeddings, usage } = await embedMany({
  model: modeloDeVectores(apiKey),
  values: pedazos.map(textoDelPedazoParaElVector),
  dimensions: DIMENSIONES_DE_LOS_VECTORES,
});

writeFileSync(
  ARCHIVO_DEL_INDICE,
  contenidoDelIndice(pedazos.map((pedazo, i) => ({ ...pedazo, vector: embeddings[i] }))),
);

const documentos = new Set(pedazos.map((pedazo) => pedazo.documento)).size;
console.log(
  `Índice listo: ${pedazos.length} pedazos de ${documentos} documentos, con ${MODELO_DE_VECTORES} ` +
    `(${DIMENSIONES_DE_LOS_VECTORES} números por pedazo${usage.tokens ? `, ${usage.tokens} tokens` : ""}).`,
);
