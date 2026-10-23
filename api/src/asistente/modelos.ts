import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { defaultSettingsMiddleware, type EmbeddingModel, wrapLanguageModel } from "ai";

// Los modelos de IA que usa el asistente.

// Los modelos con los que conversa, en el orden de la cadena de respaldo (ver respaldo.ts).
//
// Primero los de Groq, porque su plan gratis da 1.000 pedidos y 200.000 tokens al día por modelo, y cada modelo
// tiene su propia cuota: si se acaba la de uno, el siguiente sigue atendiendo.
// - gpt-oss-120b, un modelo abierto de OpenAI que Groq atiende muy rápido y que sabe usar herramientas.
// - gpt-oss-20b, su hermano chico: el mismo formato, un poco menos preciso.
// - Qwen 3.8 27B, de Alibaba.
// Al final, Gemini: su plan gratis da solo unos 20 pedidos al día para conversar, así que es el último recurso.
export const MODELOS_DE_GROQ = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"] as const;
export const MODELO_DE_GEMINI = "gemini-3.1-flash-lite";

export function modelosParaConversar({ groq, gemini }: { groq?: string; gemini?: string }): LanguageModelV4[] {
  const modelos: LanguageModelV4[] = [];

  if (groq) {
    const proveedor = createGroq({ apiKey: groq });
    for (const id of MODELOS_DE_GROQ) {
      // Qwen escribe lo que "piensa" dentro de la respuesta, entre <think> y </think>, salvo que se le pida aparte
      // ("parsed"). A gpt-oss no se le puede pedir eso (responde con un error): ya lo manda aparte.
      modelos.push(
        id.startsWith("qwen/")
          ? wrapLanguageModel({
              model: proveedor(id),
              middleware: defaultSettingsMiddleware({ settings: { providerOptions: { groq: { reasoningFormat: "parsed" } } } }),
            })
          : proveedor(id),
      );
    }
  }

  if (gemini) modelos.push(createGoogle({ apiKey: gemini })(MODELO_DE_GEMINI));

  return modelos;
}

// Los países donde el plan gratis de Gemini no se puede usar: la Unión Europea (con sus regiones fuera de Europa),
// el resto del Espacio Económico Europeo (Islandia, Liechtenstein y Noruega), Suiza y el Reino Unido.
// Para esos visitantes, el asistente no le pregunta nada a Gemini: ni para conversar ni para buscar
// en la información del club (busca por palabras).
// Son códigos ISO 3166-1, los mismos que pone Vercel en x-vercel-ip-country.
const PAISES_SIN_GEMINI = new Set(
  (
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE " +
    "AX GF GP MQ YT RE MF " +
    "IS LI NO CH GB"
  ).split(" "),
);

// Sin país (en local, o si Vercel no lo supo) se puede usar
export function puedeUsarGemini(pais: string | undefined) {
  return !pais || !PAISES_SIN_GEMINI.has(pais.toUpperCase());
}

// El modelo que calcula los vectores de la información del club (ver conocimiento.ts).
//
// Es de Gemini: su plan gratis no alcanza para conversar, pero sí para esto, porque cada pregunta es un solo
// pedido corto. Si se cambia el modelo o las dimensiones, hay que volver a correr `npm run indexar`.
export const MODELO_DE_VECTORES = "gemini-embedding-2";

// Gemini entrega 3.072 números por texto, pero se le pueden pedir menos. Con 768 el índice pesa 4 veces menos,
// y para unos pocos documentos busca igual de bien.
export const DIMENSIONES_DE_LOS_VECTORES = 768;

export function modeloDeVectores(apiKey: string): EmbeddingModel {
  return createGoogle({ apiKey }).embedding(MODELO_DE_VECTORES);
}
