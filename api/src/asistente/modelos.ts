import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

// El modelo de lenguaje con el que conversa el asistente.
//
// Se usa Groq porque su plan gratis da 1.000 pedidos al día (Gemini gratis da solo 20).
// gpt-oss-120b es un modelo abierto de OpenAI que Groq atiende muy rápido y que sabe usar herramientas.
export const MODELO_DE_GROQ = "openai/gpt-oss-120b";

export function modeloDeGroq(apiKey: string): LanguageModel {
  return createGroq({ apiKey })(MODELO_DE_GROQ);
}
