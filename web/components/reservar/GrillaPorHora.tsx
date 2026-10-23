import { formatearPesos } from "@/lib/dinero";
import type { HoraDelClub } from "@/lib/tipos";
import { CLASES_BOTON_DE_HORA, CLASES_ELEGIDO, CLASES_RESALTADO, ESTADOS } from "./GrillaDeHorarios";

type Props = {
  horas: HoraDelClub[];
  elegida: string | null; // el "inicio" de la hora elegida
  onElegir: (hora: HoraDelClub) => void;
  resaltados?: string[]; // los "inicio" de las horas en que otra persona acaba de reservar o liberar una cancha
};

// "¿A qué hora quieres jugar?": cada hora del día con cuántas canchas quedan libres.
// Al elegir una hora, la barra de abajo deja elegir la cancha.
export function GrillaPorHora({ horas, elegida, onElegir, resaltados = [] }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {horas.map((hora) => {
        const libres = hora.canchas.filter((cancha) => cancha.estado === "libre").length;
        const tuReserva = hora.canchas.some((cancha) => cancha.estado === "mio");
        const sePuedeElegir = libres > 0 && !tuReserva;
        // Si otra persona tomó la última cancha libre, la hora se muestra llena y no como elegida
        const estaElegida = hora.inicio === elegida && sePuedeElegir;

        const estado = tuReserva ? ESTADOS.mio : sePuedeElegir ? ESTADOS.libre : ESTADOS.ocupado;
        const texto = tuReserva ? "Tu reserva" : libres === 0 ? "Lleno" : `${libres} ${libres === 1 ? "libre" : "libres"}`;
        // El lector de pantalla dice la frase completa; en la pantalla va corta para que quepa en el celular
        const textoCompleto = sePuedeElegir ? `${libres} ${libres === 1 ? "cancha libre" : "canchas libres"}` : texto;
        const precio = sePuedeElegir ? formatearPesos(hora.precio) : null;

        return (
          <li key={hora.inicio}>
            <button
              type="button"
              data-hora={hora.hora}
              disabled={!sePuedeElegir}
              aria-pressed={sePuedeElegir ? estaElegida : undefined}
              // Así un lector de pantalla dice "19:00, 3 canchas libres, $16.000"
              aria-label={[hora.hora, textoCompleto, precio].filter(Boolean).join(", ")}
              onClick={() => onElegir(hora)}
              className={`${CLASES_BOTON_DE_HORA} ${estaElegida ? CLASES_ELEGIDO : estado.clases} ${
                resaltados.includes(hora.inicio) ? CLASES_RESALTADO : ""
              }`}
            >
              <span className="text-base font-semibold tabular-nums">{hora.hora}</span>
              {precio && <span className="text-xs tabular-nums">{precio}</span>}
              <span className={`text-xs ${sePuedeElegir && !estaElegida ? "text-slate-600" : ""}`}>{texto}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
