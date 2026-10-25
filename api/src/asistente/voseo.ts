import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

// El asistente habla de "tú" (lo piden las instrucciones), pero el modelo a veces escribe palabras de "vos":
// "podés", "tenés" o las chilenas "podís" y "tenís". Las instrucciones bajan la probabilidad, pero no la dejan
// en cero: en las evals del 2026-10-25 aparecieron "podís" y "tenés" en 2 de 24 respuestas. Este filtro cambia
// esas palabras por las de "tú" mientras la respuesta llega, antes de que la vea la persona. A diferencia del
// modelo, el código siempre hace lo mismo.
//
// Solo están las palabras que nunca son de "tú". "Elegí" no está, porque también es "yo elegí".
const DE_TU: Record<string, string> = {
  podés: "puedes",
  podís: "puedes",
  querés: "quieres",
  querís: "quieres",
  tenés: "tienes",
  tenís: "tienes",
  sabés: "sabes",
  sabís: "sabes",
  tocá: "toca",
  mirá: "mira",
  fijate: "fíjate",
  decime: "dime",
  contame: "cuéntame",
  avisame: "avísame",
  escribime: "escríbeme",
  reservá: "reserva",
  confirmá: "confirma",
  cancelá: "cancela",
};

// Una palabra entera: letras seguidas, también las con tilde (\p{L} es "cualquier letra")
const PALABRA = /\p{L}+/gu;

// "Si llueve, podís cancelar" → "Si llueve, puedes cancelar". Respeta la mayúscula del principio ("Podés" → "Puedes").
export function sinVoseo(texto: string) {
  return texto.replace(PALABRA, (palabra) => {
    const deTu = DE_TU[palabra.toLowerCase()];
    if (!deTu) return palabra;
    return palabra[0] === palabra[0].toUpperCase() ? deTu[0].toUpperCase() + deTu.slice(1) : deTu;
  });
}

// El filtro para la respuesta que llega de a poco. Una palabra puede venir cortada en dos pedazos ("pod" y
// "ís cancelar"), así que las letras del final de cada pedazo se guardan hasta saber dónde termina la palabra:
// se mandan con el pedazo siguiente o cuando termina el texto.
export function filtroSinVoseo<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    // Por cada texto de la respuesta (su id), las letras que todavía pueden seguir en el próximo pedazo
    const pendientes = new Map<string, string>();

    function soltar(id: string, controlador: TransformStreamDefaultController<TextStreamPart<TOOLS>>) {
      const resto = pendientes.get(id);
      pendientes.delete(id);
      if (resto) controlador.enqueue({ type: "text-delta", id, text: sinVoseo(resto) });
    }

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(parte, controlador) {
        if (parte.type === "text-delta") {
          const texto = (pendientes.get(parte.id) ?? "") + parte.text;
          // Dónde empieza la última palabra (si el pedazo termina en una letra)
          const corte = texto.search(/\p{L}*$/u);
          pendientes.set(parte.id, texto.slice(corte));
          if (corte > 0) controlador.enqueue({ ...parte, text: sinVoseo(texto.slice(0, corte)) });
          return;
        }
        // Antes de cualquier otra parte (el fin del texto, una herramienta, el fin del paso) se suelta lo guardado
        for (const id of [...pendientes.keys()]) soltar(id, controlador);
        controlador.enqueue(parte);
      },
      flush(controlador) {
        for (const id of [...pendientes.keys()]) soltar(id, controlador);
      },
    });
  };
}
