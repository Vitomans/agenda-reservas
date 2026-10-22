import { useId } from "react";
import type { InformacionDelClub } from "@/lib/tipos";

type Props = {
  informacion: InformacionDelClub; // lo que encontró la herramienta buscarInformacion
};

// De dónde sacó el asistente lo que responde: las secciones de los documentos del club que leyó.
// Si no encontró nada, no se dibuja nada: el asistente dice con palabras que no tiene esa información.
export function FuentesDelClub({ informacion }: Props) {
  const idDelTitulo = useId();

  if (informacion.fuentes.length === 0) return null;

  return (
    <div className="text-xs text-slate-500">
      <p id={idDelTitulo} className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 2.5h6.5L15 6v11.5H5z M11.5 2.5V6H15 M7.5 10h5 M7.5 13h5" strokeLinejoin="round" />
        </svg>
        Consultó la información del club:
      </p>
      <ul aria-labelledby={idDelTitulo} className="mt-1 flex flex-wrap gap-1.5">
        {informacion.fuentes.map(({ id, documento, seccion }) => (
          <li key={id} className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
            {documento} · {seccion}
          </li>
        ))}
      </ul>
    </div>
  );
}
