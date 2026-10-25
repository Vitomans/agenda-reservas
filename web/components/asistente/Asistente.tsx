"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  debeEnviarseSolo,
  errorDelAsistente,
  estadoDeLaTarjeta,
  ID_DEL_BOTON,
  MAXIMO_CARACTERES,
  type MensajeDelAsistente,
  pedidoDeCancelacion,
  pedidoDeHora,
  reservaQueCambio,
  reservasCanceladas,
  SUGERENCIAS,
} from "@/lib/asistente";
import { claves, useEntrarComoInvitado } from "@/lib/consultas";
import { horaEnPunto } from "@/lib/fechas";
import type { ReservaDelChat } from "@/lib/tipos";
import { Boton, Ruedita } from "../Boton";
import { LineasDeCancha } from "../LineasDeCancha";
import { Pelota } from "../Logo";
import { PronosticoDeLaHora } from "../Pronostico";
import { FuentesDelClub } from "./FuentesDelClub";
import { HorasLibres } from "./HorasLibres";
import { Icono } from "./Iconos";
import { PronosticoDelChat } from "./PronosticoDelChat";
import { ReservasDelChat } from "./ReservasDelChat";
import { TarjetaDeConfirmacion } from "./TarjetaDeConfirmacion";

// Los mensajes van a la API por el mismo puente que todo lo demás (web/proxy.ts), así viaja la cookie de sesión
const transporte = new DefaultChatTransport({ api: "/api/asistente" });

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  // Sin sesión, al confirmar una reserva primero se crea un jugador invitado (como en la barra para reservar)
  conSesion: boolean;
  // Cuando el asistente reserva o cancela algo: la página muestra esa hora en la grilla
  onCambioDeReserva?: (reserva: ReservaDelChat) => void;
};

// Al cerrar el chat, el foco del teclado vuelve al botón que lo abrió
function devolverElFoco() {
  document.getElementById(ID_DEL_BOTON)?.focus();
}

// Las pantallas angostas (menos de 640 px, el "sm" de Tailwind), donde el chat ocupa toda la pantalla
const PANTALLA_ANGOSTA = "(width < 40rem)";

// jsdom (donde corren los tests) no tiene matchMedia: ahí la pantalla se toma como ancha
const consultarPantalla = () => (typeof window.matchMedia === "function" ? window.matchMedia(PANTALLA_ANGOSTA) : null);

// Si la pantalla es angosta. Se actualiza sola al girar el celular o al cambiar el tamaño de la ventana.
function usePantallaAngosta() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = consultarPantalla();
      consulta?.addEventListener("change", avisar);
      return () => consulta?.removeEventListener("change", avisar);
    },
    () => consultarPantalla()?.matches ?? false,
    () => false, // en el servidor no se sabe
  );
}

// El chat con el asistente de IA. En el celular ocupa toda la pantalla. En el computador es una columna a la derecha,
// y la página se corre para dejarle lugar (ver app/layout.tsx): así se ve la grilla al lado mientras se conversa.
// En una pantalla mediana (una tablet) flota sobre la página.
// Sigue montado aunque esté cerrado (solo no se dibuja), para no perder la conversación al cerrarlo.
//
// useChat (del AI SDK) guarda los mensajes, los manda a la API y va agregando la respuesta a medida que llega.
export function Asistente({ abierto, onCerrar, conSesion, onCambioDeReserva }: Props) {
  const queryClient = useQueryClient();
  const entrarComoInvitado = useEntrarComoInvitado();
  // useChat guarda las funciones que recibe al empezar: con una referencia, onFinish usa siempre la más nueva
  const avisarCambio = useRef(onCambioDeReserva);
  useEffect(() => {
    avisarCambio.current = onCambioDeReserva;
  });
  const { messages, sendMessage, status, error, stop, regenerate, clearError, addToolApprovalResponse } =
    useChat<MensajeDelAsistente>({
      transport: transporte,
      // Al tocar "Confirmar" en una tarjeta, la conversación se manda sola para que la API haga la reserva
      sendAutomaticallyWhen: debeEnviarseSolo,
      // Si el asistente reservó o canceló, la grilla y "Mis reservas" se vuelven a pedir, y la página muestra esa
      // hora. En las pantallas de los demás, la grilla se actualiza por el aviso en vivo, como al reservar en la grilla.
      onFinish: ({ message }) => {
        const reserva = reservaQueCambio(message);
        if (reserva) {
          void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
          void queryClient.invalidateQueries({ queryKey: claves.misReservas });
          avisarCambio.current?.(reserva);
        }
      },
    });
  const [texto, setTexto] = useState("");
  const pantallaAngosta = usePantallaAngosta();
  const conversacion = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botonDeLaGrilla = useRef<HTMLButtonElement>(null);
  // "submitted": esperando que la IA empiece; "streaming": la respuesta va llegando
  const ocupado = status === "submitted" || status === "streaming";
  const problema = error ? errorDelAsistente(error) : undefined;
  // Si la API avisa que el asistente no va a poder responder por un buen rato, el chat se cierra:
  // no se puede escribir ni tocar los botones de las respuestas, y se ofrece la grilla
  const cerrado = problema?.cerrarElChat ?? false;
  const bloqueado = ocupado || cerrado;

  // Al abrir el chat, el cursor queda listo para escribir
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  // Si el chat se cierra, el campo queda deshabilitado y el foco del teclado se perdería: pasa a "Ir a la grilla"
  useEffect(() => {
    if (cerrado) botonDeLaGrilla.current?.focus();
  }, [cerrado]);

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

  const canceladas = reservasCanceladas(messages);

  function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || bloqueado) return;
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

  // En el celular el chat tapa toda la página: Tab da la vuelta dentro del chat, en vez de irse a la página de
  // atrás, que no se ve. En el computador no hace falta, porque la página se ve y se puede usar al lado.
  function mantenerElFoco(evento: React.KeyboardEvent<HTMLElement>) {
    if (evento.key !== "Tab" || !pantallaAngosta) return;
    const enfocables = evento.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled)");
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  // La respuesta a una tarjeta para confirmar. Sin sesión, antes de confirmar se crea el jugador invitado:
  // así la cookie de sesión ya va en el pedido que hace la reserva.
  async function responderTarjeta(idDeLaConfirmacion: string, confirma: boolean) {
    if (confirma && !conSesion) {
      try {
        await entrarComoInvitado.mutateAsync();
      } catch {
        return; // el error se muestra abajo (entrarComoInvitado.error)
      }
    }
    clearError();
    void addToolApprovalResponse({ id: idDeLaConfirmacion, approved: confirma });
  }

  // Cada parte de un mensaje, en el orden en que llegó: el texto como burbuja y cada herramienta con su tarjeta.
  // "esElUltimo": si es del último mensaje. "respondiendo": si el asistente sigue escribiendo ese mensaje.
  function dibujarParte(
    parte: MensajeDelAsistente["parts"][number],
    clave: string,
    { dePersona, esElUltimo, respondiendo }: { dePersona: boolean; esElUltimo: boolean; respondiendo: boolean },
  ) {
    if (parte.type === "text") {
      return parte.text ? (
        <Burbuja key={clave} de={dePersona ? "persona" : "asistente"}>
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
            deshabilitado={bloqueado}
          />
        );
      }
      // Mientras la API busca. Si falló, o la persona tocó "Detener", no se muestra nada:
      // el asistente explica con palabras lo que pasó.
      return respondiendo && parte.state !== "output-error" ? <Buscando key={clave}>Buscando horarios…</Buscando> : null;
    }

    if (parte.type === "tool-buscarInformacion") {
      if (parte.state === "output-available") {
        return <FuentesDelClub key={clave} informacion={parte.output} />;
      }
      return respondiendo && parte.state !== "output-error" ? (
        <Buscando key={clave}>Buscando en la información del club…</Buscando>
      ) : null;
    }

    if (parte.type === "tool-verPronostico") {
      if (parte.state === "output-available") {
        return <PronosticoDelChat key={clave} pedido={parte.input} pronostico={parte.output} />;
      }
      return respondiendo && parte.state !== "output-error" ? <Buscando key={clave}>Buscando el pronóstico…</Buscando> : null;
    }

    if (parte.type === "tool-verMisReservas") {
      if (parte.state === "output-available") {
        return (
          <ReservasDelChat
            key={clave}
            misReservas={parte.output}
            canceladas={canceladas}
            onCancelar={(reserva) => enviar(pedidoDeCancelacion(reserva))}
            deshabilitado={bloqueado}
          />
        );
      }
      return respondiendo && parte.state !== "output-error" ? <Buscando key={clave}>Buscando tus reservas…</Buscando> : null;
    }

    if (parte.type === "tool-reservar" || parte.type === "tool-cancelarReserva") {
      const accion = parte.type === "tool-reservar" ? "reservar" : "cancelar";
      const estado = estadoDeLaTarjeta(parte, { esElUltimo, respondiendo, fallo: error !== undefined });
      if (estado === null) return null;
      if (estado === "revisando") {
        return <Buscando key={clave}>{accion === "reservar" ? "Revisando la reserva…" : "Revisando la cancelación…"}</Buscando>;
      }
      // La confirmación que pidió la API: su id es lo que se le responde, y su texto es lo que dice la tarjeta
      const confirmacion = parte.approval;
      // Al reservar, el tiempo que hará a esa hora (la página lo pide a la API, sin preguntarle a la IA)
      const pedido = parte.type === "tool-reservar" ? parte.input : undefined;
      const pronostico =
        pedido?.fecha && pedido.hora !== undefined ? (
          <PronosticoDeLaHora fecha={pedido.fecha} hora={horaEnPunto(pedido.hora)} tono="claro" />
        ) : undefined;
      return (
        <TarjetaDeConfirmacion
          key={clave}
          accion={accion}
          estado={estado}
          descripcion={confirmacion?.requestReason}
          pronostico={pronostico}
          conSesion={conSesion}
          ocupado={bloqueado || entrarComoInvitado.isPending}
          onResponder={(confirma) => {
            if (confirmacion) void responderTarjeta(confirmacion.id, confirma);
          }}
        />
      );
    }

    return null;
  }

  return (
    <section
      role="dialog"
      aria-labelledby="titulo-del-asistente"
      // En el celular tapa toda la página: el lector de pantalla se queda dentro del chat
      aria-modal={pantallaAngosta || undefined}
      data-panel-del-asistente=""
      onKeyDown={mantenerElFoco}
      className="fixed inset-0 z-30 flex flex-col bg-white motion-safe:animate-abrir-panel sm:inset-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-96 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl lg:top-0 lg:right-0 lg:bottom-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-xl"
    >
      {/* El encabezado con la marca del club: el azul, las líneas de la cancha y la pelota del logo */}
      <header className="relative flex items-center gap-3 overflow-hidden bg-blue-900 py-3 pr-2 pl-4 text-white">
        <LineasDeCancha className="pointer-events-none absolute top-1/2 -right-12 w-72 -translate-y-1/2 -rotate-6 text-white/10" />
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
          <Pelota className="size-7" />
        </span>
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="titulo-del-asistente" className="font-display text-2xl leading-none font-bold uppercase italic">
              Asistente
            </h2>
            <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wider text-slate-900">
              IA
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-blue-200">Horarios, reservas y dudas del club</p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar el asistente"
          className="relative grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime-300"
        >
          <Icono nombre="cerrar" className="size-5" />
        </button>
      </header>

      {/* role="log": los lectores de pantalla leen lo que se agrega. aria-busy hace que esperen a que termine la respuesta. */}
      <div
        ref={conversacion}
        role="log"
        aria-label="Conversación con el asistente"
        aria-busy={ocupado}
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <DelAsistente>
          <Burbuja de="asistente">
            ¡Hola! Soy el asistente de Volea. Te busco una hora libre y te la reservo, o te cuento de los precios, los
            servicios y las reglas del club.
          </Burbuja>

          {messages.length === 0 && (
            <ul aria-label="Preguntas sugeridas" className="flex flex-col items-start gap-2 pt-1">
              {SUGERENCIAS.map(({ texto: sugerencia, icono }) => (
                <li key={sugerencia}>
                  <button
                    type="button"
                    onClick={() => enviar(sugerencia)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3.5 py-1.5 text-left text-sm font-medium text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <Icono nombre={icono} className="size-4 text-blue-600" />
                    {sugerencia}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DelAsistente>

        {messages.map((mensaje, numero) => {
          const dePersona = mensaje.role === "user";
          const esElUltimo = numero === messages.length - 1;
          const partes = mensaje.parts
            .map((parte, i) =>
              dibujarParte(parte, `${mensaje.id}-${i}`, { dePersona, esElUltimo, respondiendo: ocupado && esElUltimo }),
            )
            .filter(Boolean);
          // Por ejemplo, una reserva que la API rechazó sola, antes de que el asistente escriba por qué
          if (partes.length === 0) return null;
          return dePersona ? (
            <div key={mensaje.id} className="space-y-2">
              {partes}
            </div>
          ) : (
            <DelAsistente key={mensaje.id}>{partes}</DelAsistente>
          );
        })}

        {/* Mientras la IA piensa la respuesta a lo que escribió la persona. Al confirmar una tarjeta no hace falta:
            la tarjeta ya dice "Reservando…". */}
        {status === "submitted" && messages.at(-1)?.role === "user" && (
          <DelAsistente>
            <Escribiendo />
          </DelAsistente>
        )}

        {entrarComoInvitado.error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {entrarComoInvitado.error.message}
          </div>
        )}

        {/* Cuando el asistente no va a poder responder por un rato (por ejemplo, se acabó la cuota gratis de la IA),
            no es un error de la persona: el aviso es tranquilo y ofrece la grilla, que funciona sin IA. Si es algo
            pasajero (muchas consultas a la vez, sin conexión), va en amarillo y deja reintentar. */}
        {problema &&
          (cerrado ? (
            <div role="alert" className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
              <p className="flex items-start gap-2">
                <Icono nombre="luna" className="mt-0.5 size-4 text-blue-700" />
                {problema.mensaje}
              </p>
              <Boton ref={botonDeLaGrilla} onClick={cerrar} className="mt-3 w-full">
                Ir a la grilla
              </Boton>
            </div>
          ) : (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="flex items-start gap-2">
                <Icono nombre="alerta" className="mt-0.5 size-4 text-amber-700" />
                {problema.mensaje}
              </p>
              <Boton
                variante="secundario"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
                className="mt-3"
              >
                Reintentar
              </Boton>
            </div>
          ))}
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(texto);
        }}
        className="border-t border-slate-200 p-3"
      >
        <div
          className={`flex items-center gap-2 rounded-xl border py-1 pr-1 pl-3 transition-colors focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 ${
            cerrado ? "border-slate-200 bg-slate-100" : "border-slate-300 bg-white"
          }`}
        >
          <label htmlFor="pregunta-al-asistente" className="sr-only">
            Escribe tu pregunta
          </label>
          {/* En el celular la letra es de 16 px: con menos, el iPhone se acerca solo al tocar el campo */}
          <input
            id="pregunta-al-asistente"
            ref={campo}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            maxLength={MAXIMO_CARACTERES}
            placeholder={cerrado ? "El asistente está descansando" : "Escribe tu pregunta…"}
            disabled={cerrado}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base focus:outline-none disabled:text-slate-500 sm:text-sm"
          />
          {ocupado ? (
            <button
              type="button"
              onClick={() => void stop()}
              aria-label="Detener"
              title="Detener la respuesta"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Icono nombre="detener" className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!texto.trim() || cerrado}
              aria-label="Enviar"
              title="Enviar"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Icono nombre="enviar" className="size-5" />
            </button>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Icono nombre="info" className="mt-px size-3.5" />
          Responde una IA y puede equivocarse. No escribas datos personales.
        </p>
      </form>
    </section>
  );
}

// Mientras una herramienta trabaja: "Buscando horarios…"
function Buscando({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <Ruedita /> {children}
    </p>
  );
}

// Lo que dice el asistente va a la derecha de su "cara": la pelota del logo
function DelAsistente({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Pelota className="size-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

// Los tres puntos que se encienden mientras la IA piensa la respuesta.
// Si la persona pidió menos animaciones, quedan quietos.
function Escribiendo() {
  return (
    <p className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-3">
      <span className="sr-only">El asistente está escribiendo…</span>
      {[0, 150, 300].map((demora) => (
        <span
          key={demora}
          aria-hidden="true"
          style={{ animationDelay: `${demora}ms` }}
          className="size-1.5 rounded-full bg-slate-500 motion-safe:animate-escribiendo"
        />
      ))}
    </p>
  );
}

function Burbuja({ de, children }: { de: "persona" | "asistente"; children: React.ReactNode }) {
  const dePersona = de === "persona";
  return (
    <p
      className={`w-fit rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
        dePersona ? "ml-auto max-w-[85%] rounded-br-sm bg-blue-700 text-white" : "max-w-full rounded-tl-sm bg-slate-100 text-slate-900"
      }`}
    >
      <span className="sr-only">{dePersona ? "Tú: " : "Asistente: "}</span>
      {children}
    </p>
  );
}
