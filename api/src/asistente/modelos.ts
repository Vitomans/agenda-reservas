import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { EmbeddingModel, LanguageModel } from "ai";

// Los modelos de IA que usa el asistente.

// El modelo de lenguaje con el que conversa.
//
// Se usa Groq porque su plan gratis da 1.000 pedidos al día (Gemini gratis da solo 20).
// gpt-oss-120b es un modelo abierto de OpenAI que Groq atiende muy rápido y que sabe usar herramientas.
export const MODELO_DE_GROQ = "openai/gpt-oss-120b";

export function modeloDeGroq(apiKey: string): LanguageModel {
  return createGroq({ apiKey })(MODELO_DE_GROQ);
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
