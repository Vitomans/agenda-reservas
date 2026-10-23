// Los dibujos chicos del chat del asistente. Toman el color del texto (currentColor)
// y son solo decoración: el lector de pantalla los salta (aria-hidden).

const DIBUJOS = {
  // Las preguntas sugeridas
  calendario: "M4 5.5h12v11H4z M4 9h12 M7.5 3v4 M12.5 3v4",
  precio: "M3.5 10.6V3.5h7.1l6 6-7.1 7.1z M7 7h.01",
  club: "M10 2.5a5 5 0 0 1 5 5c0 3-2.2 5.5-5 5.5S5 10.5 5 7.5a5 5 0 0 1 5-5z M10 13v4.5 M8.5 6.5h.01 M11.5 6.5h.01 M10 9h.01", // una paleta, con sus agujeros
  // El campo para escribir
  enviar: "M3.5 10h11 M10 4.5l5.5 5.5-5.5 5.5",
  detener: "M6 6h8v8H6z",
  // Los avisos
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M10 9.5V14 M10 6.5h.01",
  luna: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z",
  alerta: "M10 3.5l7 12.5H3z M10 8.5v3.5 M10 14.5h.01",
  // Las tarjetas
  reloj: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M10 6v4l2.5 2.5",
  ticket: "M3 6.5h14v2a1.5 1.5 0 0 0 0 3v2H3v-2a1.5 1.5 0 0 0 0-3z M12 6.5v7",
  listo: "M4.5 10.5l3.5 3.5 7.5-8",
  flecha: "M4 10h11 M11 6l4 4-4 4",
  cerrar: "M5 5l10 10M15 5L5 15",
} as const;

export type NombreDelIcono = keyof typeof DIBUJOS;

export function Icono({ nombre, className = "size-4" }: { nombre: NombreDelIcono; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={DIBUJOS[nombre]} />
    </svg>
  );
}
