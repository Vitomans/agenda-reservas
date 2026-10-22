"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  ID_DEL_BOTON,
  MAXIMO_CARACTERES,
  type MensajeDelAsistente,
  mensajeDelError,
  pedidoDeHora,
  SUGERENCIAS,
} from "@/lib/asistente";
import { Boton, Ruedita } from "../Boton";
import { FuentesDelClub } from "./FuentesDelClub";
import { HorasLibres } from "./HorasLibres";

// Los mensajes van a la API por el mismo puente que todo lo demás (web/proxy.ts), así viaja la cookie de sesión
const transporte = new DefaultChatTransport({ api: "/api/asistente" });

type Props = {
  abierto: boolean;
  onCerrar: () => void;
};

// Al cerrar el chat, el foco del teclado vuelve al botón que lo abrió
function devolverElFoco() {
  document.getElementById(ID_DEL_BOTON)?.focus();
}

// El chat con el asistente de IA. En el celular ocupa toda la pantalla; en el computador es un panel a la derecha.
// Sigue montado aunque esté cerrado (solo no se dibuja), para no perder la conversación al cerrarlo.
//
// useChat (del AI SDK) guarda los mensajes, los manda a la API y va agregando la respuesta a medida que llega.
export function Asistente({ abierto, onCerrar }: Props) {
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat<MensajeDelAsistente>({
    transport: transporte,
  });
  const [texto, setTexto] = useState("");
  const conversacion = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  // "submitted": esperando que la IA empiece; "streaming": la respuesta va llegando
  const ocupado = status === "submitted" || status === "streaming";

  // Al abrir el chat, el cursor queda listo para escribir
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  // Cuando llega texto nuevo, la conversación baja hasta el final
  useEffect(() => {
    const caja = conversacion.current;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }, [messages, status]);

  // Escape cierra el chat, esté donde esté el foco (se escucha en toda la ventana mientras está abierto)
  useEffect(() => {
    if (!abierto) return;
    function alApretarUnaTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        onCerrar();
        devolverElFoco();
      }
    }
    window.addEventListener("keydown", alApretarUnaTecla);
    return () => window.removeEventListener("keydown", alApretarUnaTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || ocupado) return;
    clearError();
    void sendMessage({ text: limpia });
    setTexto("");
    // Si se tocó una pregunta sugerida, ese botón desaparece: el cursor vuelve al campo para seguir escribiendo
    campo.current?.focus();
  }

  function cerrar() {
    onCerrar();
    devolverElFoco();
  }

  return (
    <section
      role="dialog"
      aria-labelledby="titulo-del-asistente"
      className="fixed inset-0 z-30 flex flex-col bg-white sm:inset-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-96 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl"
    >
      <header className="flex items-center justify-between gap-3 bg-blue-900 px-4 py-3 text-white">
        <div>
          <h2 id="titulo-del-asistente" className="font-display text-2xl leading-none font-bold uppercase italic">
            Asistente
          </h2>
          <p className="mt-0.5 text-xs text-blue-200">Club Volea · responde una IA</p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar el asistente"
          className="rounded-lg p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime-300"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* role="log": los lectores de pantalla leen lo que se agrega. aria-busy hace que esperen a que termine la respuesta. */}
      <div
        ref={conversacion}
        role="log"
        aria-label="Conversación con el asistente"
        aria-busy={ocupado}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        <Burbuja de="asistente">
          ¡Hola! Soy el asistente de Volea. Pregúntame qué horas quedan libres, los precios, los servicios o las reglas
          del club.
        </Burbuja>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => enviar(sugerencia)}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-sm text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {sugerencia}
              </button>
            ))}
          </div>
        )}

        {/* Un mensaje viene en partes, en el orden en que llegaron: texto, el uso de una herramienta, más texto... */}
        {messages.map((mensaje, numero) =>
          mensaje.parts.map((parte, i) => {
            const clave = `${mensaje.id}-${i}`;
            // El último mensaje, mientras el asistente lo sigue escribiendo
            const respondiendo = ocupado && numero === messages.length - 1;

            if (parte.type === "text") {
              return parte.text ? (
                <Burbuja key={clave} de={mensaje.role === "user" ? "persona" : "asistente"}>
                  {parte.text}
                </Burbuja>
              ) : null;
            }

            if (parte.type === "tool-verHorariosLibres") {
              if (parte.state === "output-available") {
                return (
                  <HorasLibres
                    key={clave}
                    pedido={parte.input}
                    horarios={parte.output}
                    onPedir={(hora) => enviar(pedidoDeHora(parte.input.fecha, hora))}
                    deshabilitado={ocupado}
                  />
                );
              }
              // Mientras la API busca. Si falló, o la persona tocó "Detener", no se muestra nada:
              // el asistente explica con palabras lo que pasó.
              return respondiendo && parte.state !== "output-error" ? (
                <Buscando key={clave}>Buscando horarios…</Buscando>
              ) : null;
            }

            if (parte.type === "tool-buscarInformacion") {
              if (parte.state === "output-available") {
                return <FuentesDelClub key={clave} informacion={parte.output} />;
              }
              return respondiendo && parte.state !== "output-error" ? (
                <Buscando key={clave}>Buscando en la información del club…</Buscando>
              ) : null;
            }

            return null;
          }),
        )}

        {status === "submitted" && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Ruedita /> Escribiendo…
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {mensajeDelError(error)}{" "}
            <button
              type="button"
              onClick={() => {
                clearError();
                void regenerate();
              }}
              className="font-medium underline"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(texto);
        }}
        className="border-t border-slate-200 p-3"
      >
        <div className="flex gap-2">
          <label htmlFor="pregunta-al-asistente" className="sr-only">
            Escribe tu pregunta
          </label>
          <input
            id="pregunta-al-asistente"
            ref={campo}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            maxLength={MAXIMO_CARACTERES}
            placeholder="Escribe tu pregunta…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
          {ocupado ? (
            <Boton variante="secundario" onClick={() => void stop()}>
              Detener
            </Boton>
          ) : (
            <Boton type="submit" disabled={!texto.trim()}>
              Enviar
            </Boton>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Responde una IA y puede equivocarse. No escribas datos personales.</p>
      </form>
    </section>
  );
}

function Buscando({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <Ruedita /> {children}
    </p>
  );
}

function Burbuja({ de, children }: { de: "persona" | "asistente"; children: React.ReactNode }) {
  const dePersona = de === "persona";
  return (
    <div className={`flex ${dePersona ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
          dePersona ? "rounded-br-sm bg-blue-700 text-white" : "rounded-bl-sm bg-slate-100 text-slate-900"
        }`}
      >
        <span className="sr-only">{dePersona ? "Tú: " : "Asistente: "}</span>
        {children}
      </p>
    </div>
  );
}
