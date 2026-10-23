import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Asistente } from "@/components/asistente/Asistente";
import { MAXIMO_CARACTERES, SUGERENCIAS } from "@/lib/asistente";
import type { HorariosLibres, InformacionDelClub } from "@/lib/tipos";

// La respuesta de la API llega como eventos ("data: {...}"), en el mismo formato que manda la API de verdad
function respuestaConEventos(eventos: object[]) {
  const todos = [{ type: "start" }, ...eventos, { type: "finish", finishReason: "stop" }];
  const cuerpo = `${todos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(cuerpo, {
    headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
  });
}

// Un paso en que el asistente escribe un texto
function pasoQueEscribe(...pedazos: string[]) {
  return [
    { type: "start-step" },
    { type: "text-start", id: "txt-0" },
    ...pedazos.map((delta) => ({ type: "text-delta", id: "txt-0", delta })),
    { type: "text-end", id: "txt-0" },
    { type: "finish-step" },
  ];
}

function respuestaDeLaApi(...pedazos: string[]) {
  return respuestaConEventos(pasoQueEscribe(...pedazos));
}

// Una respuesta en que el asistente primero usa una herramienta y después escribe
function respuestaConHerramienta(herramienta: string, pedido: object, resultado: object, texto: string) {
  return respuestaConEventos([
    { type: "start-step" },
    { type: "tool-input-available", toolCallId: "llamada-1", toolName: herramienta, input: pedido },
    { type: "tool-output-available", toolCallId: "llamada-1", output: resultado },
    { type: "finish-step" },
    ...pasoQueEscribe(texto),
  ]);
}

// Reservar por el chat: primero la API responde con la tarjeta para confirmar (y espera)...
const PEDIDO = { fecha: "2026-10-23", hora: 19, cancha: "Cancha 2" };
const DESCRIPCION = "Cancha 2 · viernes 23 de octubre · 19:00 a 20:00 · $16.000";
const RESERVA = { id: "r-1", cancha: "Cancha 2", fecha: "2026-10-23", hora: "19:00", precio: 16_000 };

function respuestaConTarjeta() {
  return respuestaConEventos([
    { type: "start-step" },
    { type: "tool-input-available", toolCallId: "llamada-1", toolName: "reservar", input: PEDIDO },
    { type: "tool-approval-request", approvalId: "confirmacion-1", toolCallId: "llamada-1", reason: DESCRIPCION },
    { type: "finish-step" },
  ]);
}

// ...y, cuando la persona confirma, responde con la reserva hecha y el texto del asistente
function respuestaConLaReservaHecha() {
  return respuestaConEventos([
    { type: "tool-output-available", toolCallId: "llamada-1", output: { reserva: RESERVA } },
    ...pasoQueEscribe("¡Listo, quedó reservada!"),
  ]);
}

// Una API falsa que responde cada pedido al asistente con la siguiente respuesta de la lista.
// "/api/auth/invitado" crea un jugador invitado, como la de verdad.
function simularConversacion(...respuestas: (() => Response)[]) {
  const fetchFalso = vi.fn(async (url: string) => {
    if (url === "/api/auth/invitado") {
      const usuario = { id: "u-1", nombre: "Invitado 4F2A", email: "invitado-1@invitados.example.com", rol: "CLIENTE" };
      return new Response(JSON.stringify({ usuario }), { status: 201 });
    }
    return respuestas.shift()!();
  });
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

// El cuerpo de cada pedido que se le hizo al asistente
function conversacionesEnviadas(fetchFalso: ReturnType<typeof simularConversacion>) {
  return (fetchFalso.mock.calls as unknown as [string, RequestInit][])
    .filter(([url]) => url === "/api/asistente")
    .map(([, opciones]) => String(opciones.body));
}

async function pedirUnaReserva() {
  await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "Resérvame mañana a las 7 de la tarde");
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  return screen.findByRole("group", { name: "¿Confirmas esta reserva?" });
}

function simularApi(respuesta: () => Response) {
  const fetchFalso = vi.fn(async () => respuesta());
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function dibujar({ abierto = true, conSesion = true } = {}) {
  const onCerrar = vi.fn();
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Asistente abierto={abierto} onCerrar={onCerrar} conSesion={conSesion} />
    </QueryClientProvider>,
  );
  return { onCerrar, queryClient };
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

  it("muestra las horas libres que encontró el asistente, y al tocar una se la pide", async () => {
    const horarios: HorariosLibres = {
      horas: [{ hora: "19:00", precio: 16_000, canchas: ["Cancha 2", "Cancha 4"] }],
      tusReservas: [],
    };
    const fetchFalso = simularApi(() =>
      respuestaConHerramienta(
        "verHorariosLibres",
        { fecha: "2026-10-23", desde: 19 },
        horarios,
        "Mañana hay libres desde las 19:00.",
      ),
    );
    dibujar();

    await userEvent.click(screen.getByRole("button", { name: SUGERENCIAS[0] }));

    // Primero la tarjeta con las horas y después el texto, en el orden en que llegaron
    const hora = await screen.findByRole("button", { name: "19:00, 2 canchas libres, $16.000" });
    const texto = screen.getByText("Mañana hay libres desde las 19:00.");
    expect(hora.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await waitFor(() => expect(hora).toBeEnabled());
    await userEvent.click(hora);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
    const { messages } = JSON.parse(String((fetchFalso.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(JSON.stringify(messages.at(-1))).toContain("Quiero reservar el viernes 23 de octubre a las 19:00");
    // La conversación que se manda trae el resultado de la herramienta: así el asistente sabe de qué horas se habla
    expect(JSON.stringify(messages)).toContain('"type":"tool-verHorariosLibres"');
  });

  it("muestra de qué información del club sacó la respuesta", async () => {
    const informacion: InformacionDelClub = {
      fuentes: [{ id: "servicios#arriendo-de-paletas", documento: "Servicios del club", seccion: "Arriendo de paletas" }],
      forma: "significado",
    };
    simularApi(() =>
      respuestaConHerramienta(
        "buscarInformacion",
        { pregunta: "arriendo de paletas" },
        informacion,
        "Según los servicios del club, puedes arrendar una paleta a $3.000 por hora.",
      ),
    );
    dibujar();

    await userEvent.click(screen.getByRole("button", { name: "¿Arriendan paletas?" }));

    expect(await screen.findByText(/puedes arrendar una paleta a \$3.000 por hora/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Consultó la información del club:" })).toHaveTextContent(
      "Servicios del club · Arriendo de paletas",
    );
    // Cuando ya respondió, no queda el aviso de que está buscando
    expect(screen.queryByText("Buscando en la información del club…")).not.toBeInTheDocument();
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

describe("reservar y cancelar por el chat", () => {
  it("muestra la tarjeta con lo que armó la API, y al tocar Confirmar la manda sola y muestra la reserva hecha", async () => {
    const fetchFalso = simularConversacion(respuestaConTarjeta, respuestaConLaReservaHecha);
    const { queryClient } = dibujar();
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");

    const tarjeta = await pedirUnaReserva();
    expect(tarjeta).toHaveTextContent(DESCRIPCION);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("group", { name: "Reservada" })).toHaveTextContent(DESCRIPCION);
    expect(screen.getByText("¡Listo, quedó reservada!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver mis reservas" })).toHaveAttribute("href", "/mis-reservas");
    // Se mandó sola, con la respuesta de la persona a la tarjeta
    const [, segunda] = conversacionesEnviadas(fetchFalso);
    expect(segunda).toContain('"state":"approval-responded"');
    expect(segunda).toContain('"approved":true');
    // La grilla y "Mis reservas" se vuelven a pedir, para que aparezca la reserva nueva
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["disponibilidad"] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["mis-reservas"] });
  });

  it("'No, gracias' no le pregunta nada a la API, y la tarjeta dice que no se reservó", async () => {
    const fetchFalso = simularConversacion(respuestaConTarjeta);
    dibujar();

    await pedirUnaReserva();
    await userEvent.click(screen.getByRole("button", { name: "No, gracias" }));

    expect(await screen.findByRole("group", { name: "No la reservaste" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("sin sesión, 'Reservar como invitado' primero crea el jugador invitado y después confirma", async () => {
    const fetchFalso = simularConversacion(respuestaConTarjeta, respuestaConLaReservaHecha);
    dibujar({ conSesion: false });

    await pedirUnaReserva();
    expect(screen.getByText(/se crea un jugador invitado solo para ti/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reservar como invitado" }));

    expect(await screen.findByRole("group", { name: "Reservada" })).toBeInTheDocument();
    const urls = fetchFalso.mock.calls.map(([url]) => url);
    expect(urls).toEqual(["/api/asistente", "/api/auth/invitado", "/api/asistente"]);
  });

  it("si la persona escribe otra cosa en vez de responder, la tarjeta ya no se puede confirmar", async () => {
    simularConversacion(respuestaConTarjeta, () => respuestaDeLaApi("Bueno, te busco a las 20:00."));
    dibujar();

    await pedirUnaReserva();
    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "Mejor a las 8");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Bueno, te busco a las 20:00.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quedó sin confirmar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("si la API la rechaza sola (por ejemplo, una hora ocupada), no muestra tarjeta: lo explica el asistente", async () => {
    simularConversacion(() =>
      respuestaConEventos([
        { type: "start-step" },
        { type: "tool-input-available", toolCallId: "llamada-1", toolName: "reservar", input: PEDIDO },
        { type: "tool-approval-request", approvalId: "confirmacion-1", toolCallId: "llamada-1", isAutomatic: true },
        { type: "tool-approval-response", approvalId: "confirmacion-1", approved: false, reason: "Ya está reservada." },
        { type: "tool-output-denied", toolCallId: "llamada-1" },
        { type: "finish-step" },
        ...pasoQueEscribe("Esa hora ya la tomó otra persona. ¿Te sirve a las 20:00?"),
      ]),
    );
    dibujar();

    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "Resérvame a las 7");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Esa hora ya la tomó otra persona. ¿Te sirve a las 20:00?")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("muestra las próximas reservas, y al tocar 'Cancelar' en una se lo pide al asistente", async () => {
    const fetchFalso = simularConversacion(
      () => respuestaConHerramienta("verMisReservas", {}, { reservas: [RESERVA] }, "Tienes una reserva."),
      () => respuestaDeLaApi("Ok"),
    );
    dibujar();

    await userEvent.type(screen.getByLabelText("Escribe tu pregunta"), "¿Qué reservas tengo?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const cancelar = await screen.findByRole("button", { name: "Cancelar la reserva de la Cancha 2 del viernes 23 de octubre a las 19:00" });
    expect(screen.getByRole("group", { name: "Tus próximas reservas" })).toHaveTextContent("viernes 23 de octubre · 19:00 · $16.000");
    await waitFor(() => expect(cancelar).toBeEnabled());
    await userEvent.click(cancelar);

    await waitFor(() => expect(conversacionesEnviadas(fetchFalso)).toHaveLength(2));
    expect(conversacionesEnviadas(fetchFalso)[1]).toContain("Quiero cancelar mi reserva de la Cancha 2 del viernes 23 de octubre a las 19:00");
  });
});
