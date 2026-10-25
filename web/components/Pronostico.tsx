import { usePronostico } from "@/lib/consultas";
import type { Cielo, HoraDelPronostico } from "@/lib/tipos";

// El pronóstico del tiempo en la página: los íconos, la línea "18 °C · lluvia ligera" de la barra para reservar
// y de la tarjeta del asistente, y el crédito a MET Norway, que lo pide su licencia (CC BY 4.0).

// ---------- Los íconos ----------

// Dibujos de 20 × 20, con líneas como los del chat (ver asistente/Iconos.tsx)
const SOL = "M10 13.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M10 2.5v1.8 M10 15.7v1.8 M2.5 10h1.8 M15.7 10h1.8 M4.7 4.7 6 6 M14 14l1.3 1.3 M4.7 15.3 6 14 M14 6l1.3-1.3";
const LUNA = "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z";
const NUBE = "M6 15.5h8.25a3.25 3.25 0 0 0 .5-6.46 4.75 4.75 0 0 0-9.1 1.21A2.65 2.65 0 0 0 6 15.5z";
// Una nube más arriba, para dibujar debajo lo que cae
const NUBE_ALTA = "M6 12.5h8.25a3.25 3.25 0 0 0 .5-6.46 4.75 4.75 0 0 0-9.1 1.21A2.65 2.65 0 0 0 6 12.5z";
// Una nube chica abajo a la derecha, con el sol o la luna asomando arriba a la izquierda
const NUBE_CHICA = "M8.5 17h6.5a2.6 2.6 0 0 0 .4-5.17 3.8 3.8 0 0 0-7.27.97A2.12 2.12 0 0 0 8.5 17z";
const SOL_CHICO = "M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6.5 1.5v.8 M1.5 6.5h.8 M2.9 2.9l.6.6 M10.1 2.9l-.6.6 M2.9 10.1l.6-.6";
const LUNA_CHICA = "M8.8 6.8A3.6 3.6 0 0 1 4.6 2.6a3.6 3.6 0 1 0 4.2 4.2z";

const GOTAS = { pocas: "M8 15l-1 2.5 M12.5 15l-1 2.5", varias: "M6.5 15l-1 2.5 M10 15l-1 2.5 M13.5 15l-1 2.5" };
const COPOS = "M7 16.5h.01 M10.5 17.5h.01 M14 16.5h.01";
const RAYO = "M11 13.5l-2 3h3l-2 3";
const NIEBLA = "M3.5 7h13 M5.5 10.5h11 M3.5 14h13";

function dibujoDelCielo(cielo: Cielo, deNoche: boolean): string[] {
  switch (cielo) {
    case "despejado":
      return [deNoche ? LUNA : SOL];
    case "poco-nublado":
    case "parcial":
      return [deNoche ? LUNA_CHICA : SOL_CHICO, NUBE_CHICA];
    case "nublado":
      return [NUBE];
    case "niebla":
      return [NIEBLA];
    case "lluvia-ligera":
      return [NUBE_ALTA, GOTAS.pocas];
    case "lluvia":
    case "lluvia-fuerte":
      return [NUBE_ALTA, GOTAS.varias];
    case "aguanieve":
      return [NUBE_ALTA, "M8 15l-1 2.5", "M12.5 16.5h.01"];
    case "nieve":
      return [NUBE_ALTA, COPOS];
    case "tormenta":
      return [NUBE_ALTA, RAYO];
  }
}

// Toma el color del texto (currentColor) y es solo decoración: el texto de al lado dice lo mismo
export function IconoDelTiempo({ cielo, deNoche, className = "size-5" }: { cielo: Cielo; deNoche: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dibujoDelCielo(cielo, deNoche).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// ---------- Lo que se muestra ----------

// El crédito que pide la licencia de MET Norway, con el link a su sitio
export function CreditoDeMet({ className = "" }: { className?: string }) {
  return (
    <a href="https://www.met.no/en" target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${className}`}>
      Datos de MET Norway
    </a>
  );
}

// "16 °C" o "16 a 18 °C"
export function textoDeGrados(minima: number, maxima = minima) {
  return minima === maxima ? `${minima} °C` : `${minima} a ${maxima} °C`;
}

const TONOS = {
  // Sobre la barra negra para reservar
  oscuro: { texto: "text-slate-200", icono: "text-sky-300", credito: "text-slate-400 hover:text-white" },
  // Sobre la tarjeta lima del asistente
  claro: { texto: "text-slate-700", icono: "text-blue-700", credito: "text-slate-500 hover:text-slate-800" },
};

// "☁ 18 °C · lluvia ligera · Datos de MET Norway". El lector de pantalla dice antes "Pronóstico:".
export function LineaDelPronostico({ pronostico, tono }: { pronostico: HoraDelPronostico; tono: keyof typeof TONOS }) {
  const clases = TONOS[tono];
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm ${clases.texto}`}>
      <IconoDelTiempo cielo={pronostico.cielo} deNoche={pronostico.deNoche} className={`size-5 ${clases.icono}`} />
      <span className="tabular-nums">
        <span className="sr-only">Pronóstico: </span>
        {textoDeGrados(pronostico.grados)} · {pronostico.descripcion}
      </span>
      <span aria-hidden="true" className={clases.credito}>
        ·
      </span>
      <CreditoDeMet className={`text-xs ${clases.credito}`} />
    </p>
  );
}

// La línea del pronóstico para una hora de un día, que pide ella misma a la API. Si no hay pronóstico para esa
// hora (o todavía no llega), no muestra nada.
export function PronosticoDeLaHora({ fecha, hora, tono }: { fecha: string; hora: string; tono: keyof typeof TONOS }) {
  const { data: horas } = usePronostico(fecha);
  const pronostico = horas?.find((h) => h.hora === hora);
  return pronostico ? <LineaDelPronostico pronostico={pronostico} tono={tono} /> : null;
}
