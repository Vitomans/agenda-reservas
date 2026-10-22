import { MockEmbeddingModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buscarEnElClub,
  buscarPorPalabras,
  cortarEnPedazos,
  indiceDelClub,
  leerDocumentos,
  MAXIMO_PEDAZOS,
  raices,
} from "../src/asistente/conocimiento.ts";
import { DIMENSIONES_DE_LOS_VECTORES, MODELO_DE_VECTORES } from "../src/asistente/modelos.ts";
import { HORA_APERTURA, HORA_CIERRE } from "../src/servicios/horario.ts";

// La información del club (RAG). Estos tests no le piden nada a Gemini: usan el índice guardado en el repo
// y, para buscar por significado, un modelo de vectores falso.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cortarEnPedazos", () => {
  const SERVICIOS = [
    "# Servicios del club",
    "",
    "## Arriendo de paletas",
    "",
    "A $3.000 por hora.",
    "",
    "Se devuelven al terminar.",
    "",
    "## Pelotas",
    "",
    "Se venden tubos.",
    "",
  ].join("\n");

  it("corta un documento en un pedazo por sección, con el título del documento y el de la sección", () => {
    expect(cortarEnPedazos("servicios.md", SERVICIOS)).toEqual([
      {
        id: "servicios#arriendo-de-paletas",
        documento: "Servicios del club",
        seccion: "Arriendo de paletas",
        texto: "A $3.000 por hora.\n\nSe devuelven al terminar.",
      },
      { id: "servicios#pelotas", documento: "Servicios del club", seccion: "Pelotas", texto: "Se venden tubos." },
    ]);
  });

  it("da lo mismo con los saltos de línea de Windows, así el índice no cambia según el computador", () => {
    expect(cortarEnPedazos("servicios.md", SERVICIOS.replaceAll("\n", "\r\n"))).toEqual(
      cortarEnPedazos("servicios.md", SERVICIOS),
    );
  });

  it("el id de la sección no lleva tildes, signos ni espacios", () => {
    const [pedazo] = cortarEnPedazos("preguntas.md", "# Preguntas\n\n## ¿Las canchas son techadas?\n\nSí.");

    expect(pedazo.id).toBe("preguntas#las-canchas-son-techadas");
  });

  it("falla si el documento no tiene título", () => {
    expect(() => cortarEnPedazos("sin-titulo.md", "## Sección\n\nTexto.")).toThrow(/sin-titulo.md no tiene un título/);
  });
});

describe("los documentos del club", () => {
  it("el índice está al día con los documentos (si falla, corre npm run indexar)", () => {
    const secciones = indiceDelClub().pedazos.map(({ vector: _vector, ...pedazo }) => pedazo);

    expect(secciones).toEqual(leerDocumentos());
  });

  it("el índice se hizo con el mismo modelo y las mismas dimensiones con que se buscan las preguntas", () => {
    const indice = indiceDelClub();

    expect(indice.modelo).toBe(MODELO_DE_VECTORES);
    expect(indice.pedazos.every(({ vector }) => vector.length === DIMENSIONES_DE_LOS_VECTORES)).toBe(true);
  });

  it("cada sección tiene un id distinto", () => {
    const ids = leerDocumentos().map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no dicen horas en que el club está cerrado (los documentos no pueden contradecir a la página)", () => {
    const horas = leerDocumentos().flatMap(({ texto }) => [...texto.matchAll(/\b(\d{2}):00\b/g)].map(([, hora]) => Number(hora)));

    expect(horas.length).toBeGreaterThan(0);
    expect(horas.filter((hora) => hora < HORA_APERTURA || hora > HORA_CIERRE)).toEqual([]);
  });
});

describe("buscarPorPalabras (el respaldo cuando no se puede usar Gemini)", () => {
  const pedazos = leerDocumentos();
  const encontradas = (pregunta: string) => buscarPorPalabras(pregunta, pedazos).map(({ id }) => id);

  it("se queda con las palabras importantes, sin tildes y cortadas en 5 letras", () => {
    expect(raices("¿Dónde están las Paletas para niños?")).toEqual(["palet", "ninos"]);
  });

  it("encuentra la sección aunque cambien las tildes, las mayúsculas o el plural", () => {
    expect(encontradas("¿Arriendan paletas?")[0]).toBe("servicios#arriendo-de-paletas");
    expect(encontradas("¿tienen DUCHAS?")[0]).toBe("servicios#camarines-y-duchas");
    expect(encontradas("¿Puedo jugar con zapatillas de running?")[0]).toBe("reglamento#calzado-y-ropa");
  });

  it(`devuelve como mucho ${MAXIMO_PEDAZOS} secciones`, () => {
    expect(encontradas("¿Hacen clases de pádel para principiantes?").length).toBeLessThanOrEqual(MAXIMO_PEDAZOS);
  });

  it("no devuelve nada si ninguna palabra importante coincide", () => {
    expect(encontradas("¿Cuál es la capital de Francia?")).toEqual([]);
  });
});

describe("buscarEnElClub", () => {
  // Un modelo de vectores falso que, pregunten lo que pregunten, responde con este vector
  function modeloQueResponde(vector: number[]) {
    return new MockEmbeddingModelV4({ doEmbed: async () => ({ embeddings: [vector], warnings: [] }) });
  }
  const vectorDe = (id: string) => indiceDelClub().pedazos.find((pedazo) => pedazo.id === id)!.vector;

  it("con Gemini busca por significado: devuelve primero la sección con el vector más parecido", async () => {
    // La pregunta no tiene ninguna palabra de la sección: por palabras no la encontraría
    const resultado = await buscarEnElClub("¿Dónde dejo el auto?", modeloQueResponde(vectorDe("servicios#estacionamiento")));

    expect(resultado.forma).toBe("significado");
    expect(resultado.pedazos[0]).toMatchObject({ id: "servicios#estacionamiento", seccion: "Estacionamiento" });
  });

  it("le manda a Gemini la pregunta con el formato de búsqueda y le pide 768 números", async () => {
    const modelo = modeloQueResponde(vectorDe("servicios#estacionamiento"));

    await buscarEnElClub("¿Dónde dejo el auto?", modelo);

    expect(modelo.doEmbedCalls[0].values).toEqual(["task: search result | query: ¿Dónde dejo el auto?"]);
    expect(modelo.doEmbedCalls[0].dimensions).toBe(DIMENSIONES_DE_LOS_VECTORES);
  });

  it("si ninguna sección se parece lo suficiente (una pregunta que no es del club), no devuelve nada", async () => {
    const resultado = await buscarEnElClub("¿Cuál es la capital de Francia?", modeloQueResponde(Array(768).fill(0)));

    expect(resultado).toEqual({ pedazos: [], forma: "significado" });
  });

  it("si Gemini falla, busca por palabras y deja el error en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const modelo = new MockEmbeddingModelV4({
      doEmbed: async () => {
        throw new Error("Se acabó la cuota de Gemini");
      },
    });

    const resultado = await buscarEnElClub("¿Arriendan paletas?", modelo);

    expect(resultado.forma).toBe("palabras");
    expect(resultado.pedazos[0].id).toBe("servicios#arriendo-de-paletas");
    expect(log).toHaveBeenCalled();
  });

  it("sin modelo de vectores (sin la clave de Gemini), busca por palabras", async () => {
    const resultado = await buscarEnElClub("¿Arriendan paletas?", null);

    expect(resultado.forma).toBe("palabras");
    expect(resultado.pedazos[0].id).toBe("servicios#arriendo-de-paletas");
  });
});
