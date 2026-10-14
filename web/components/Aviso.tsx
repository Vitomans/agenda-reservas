"use client";

import { useEffect, useState } from "react";
import { Ruedita } from "./Boton";

type Tipo = "error" | "exito";

const CLASES: Record<Tipo, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  exito: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

// Un mensaje en un recuadro. Los lectores de pantalla lo leen apenas aparece.
export function Aviso({ tipo = "error", children }: { tipo?: Tipo; children: React.ReactNode }) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${CLASES[tipo]}`}>
      {children}
    </div>
  );
}

// Después de este tiempo cargando, lo más probable es que el servidor estuviera dormido
export const DEMORA_AVISO_SERVIDOR_MS = 5000;

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  const [tardando, setTardando] = useState(false);

  useEffect(() => {
    const temporizador = setTimeout(() => setTardando(true), DEMORA_AVISO_SERVIDOR_MS);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-slate-500">
      <div className="flex items-center gap-3">
        <Ruedita />
        {texto}
      </div>
      {/* La API está en un plan gratis que se apaga cuando nadie la usa (ver "Cómo está publicada" en el README) */}
      {tardando && (
        <p className="max-w-xs text-center">
          Está tardando más de lo normal: el servidor de esta demo se duerme cuando nadie la usa y puede tardar
          hasta un minuto en despertar.
        </p>
      )}
    </div>
  );
}
