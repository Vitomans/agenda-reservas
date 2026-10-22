import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Asistente } from "@/components/asistente/Asistente";
import { MAXIMO_CARACTERES, SUGERENCIAS } from "@/lib/asistente";

// La respuesta de la API llega como eventos ("data: {...}"), en el mismo formato que manda la API de verdad
function respuestaDeLaApi(...pedazos: string[]) {
  const eventos = [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "txt-0" },
    ...pedazos.map((delta) => ({ type: "text-delta", id: "txt-0", delta })),
    { type: "text-end", id: "txt-0" },
    { type: "finish-step" },
    { type: "finish", finishReason: "stop" },
  ];
  const cuerpo = `${eventos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(cuerpo, {
    headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
  });
}

function simularApi(respuesta: () => Response) {
  const fetchFalso = vi.fn(async () => respuesta());
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function dibujar({ abierto = true } = {}) {
  const onCerrar = vi.fn();
  render(<Asistente abierto={abierto} onCerrar={onCerrar} />);
  return { onCerrar };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Asistente", () => {
  it("cerrado no muestra nada", () => {
    dibujar({ abierto: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al abrirse saluda, propone preguntas y deja el cursor en el campo", () => {
    dibujar();

    expect(screen.getByRole("dialog", { name: "Asistente" })).toBeInTheDocument();
    expect(screen.getByText(/Soy el asistente de Volea/)).toBeInTheDocument();
    for (const sugerencia of SUGERENCIAS) {
      expect(screen.getByRole("button", { name: sugerencia })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Escribe tu pregunta")).toHaveFocus();
  });

  it("manda la pregunta a la API y muestra la respuesta a medida que llega", async () => {
    const fetchFalso = simularApi(() => respuestaDeLaApi("Abrimos de ", "08:00 a 23:00."));
    dibujar();

    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "¿A qué hora abren?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Abrimos de 08:00 a 23:00.")).toBeInTheDocument();
    expect(screen.getByText("¿A qué hora abren?")).toBeInTheDocument();
    expect(screen.getByLabelText("Escribe tu pregunta")).toHaveValue("");

    const [url, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/asistente");
    expect(String(opciones.body)).toContain("¿A qué hora abren?");
    // Las preguntas sugeridas se esconden cuando ya empezó la conversación
    expect(screen.queryByRole("button", { name: SUGERENCIAS[0] })).not.toBeInTheDocument();
  });

  it("una pregunta sugerida se manda al tocarla", async () => {
    const fetchFalso = simularApi(() => respuestaDeLaApi("Cuesta $12.000."));
    dibujar();

    await userEvent.click(screen.getByRole("button", { name: SUGERENCIAS[0] }));

    expect(await screen.findByText("Cuesta $12.000.")).toBeInTheDocument();
    expect(String((fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toContain(SUGERENCIAS[0]);
    // El botón de la sugerencia desaparece, así que el cursor vuelve al campo (y Escape sigue cerrando el chat)
    expect(screen.getByLabelText("Escribe tu pregunta")).toHaveFocus();
  });

  it("si la API rechaza el mensaje, muestra su explicación en español", async () => {
    simularApi(
      () =>
        new Response(JSON.stringify({ error: "Le escribiste muchos mensajes seguidos al asistente." }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
    );
    dibujar();

    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "Hola");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Le escribiste muchos mensajes seguidos al asistente.");
  });

  it("no deja enviar un mensaje vacío ni uno más largo que el límite de la API", async () => {
    dibujar();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "   ");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByLabelText("Escribe tu pregunta")).toHaveAttribute("maxLength", String(MAXIMO_CARACTERES));
  });

  it("se cierra con el botón o con Escape", async () => {
    const { onCerrar } = dibujar();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar el asistente" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(2));
  });
});
