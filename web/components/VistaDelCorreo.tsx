"use client";

import { useEffect, useRef } from "react";
import { useVistaDelCorreo } from "@/lib/consultas";
import { Aviso, Cargando } from "./Aviso";
import { Boton } from "./Boton";

// Muestra el correo de confirmación de una reserva tal como le llega al jugador.
// Usa un <dialog> del navegador: se abre encima de la página, se cierra con Escape y no deja tocar lo de atrás.
export function VistaDelCorreo({ reservaId, onCerrar }: { reservaId: string; onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const correo = useVistaDelCorreo(reservaId);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      aria-labelledby="titulo-correo"
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-correo" className="font-semibold">
              Correo de confirmación
            </h2>
            {correo.data && (
              <p className="truncate text-sm text-slate-600">
                {correo.data.asunto}
              </p>
            )}
          </div>
          <Boton variante="secundario" onClick={() => dialogo.current?.close()}>
            Cerrar
          </Boton>
        </div>

        {correo.isPending ? (
          <Cargando texto="Armando el correo…" />
        ) : correo.isError ? (
          <Aviso>{correo.error.message}</Aviso>
        ) : (
          <>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {correo.data.seEnvia
                ? `Te lo enviamos a ${correo.data.para}.`
                : "Este correo no se envió, porque los jugadores demo no tienen un correo real. Si creas una cuenta con tu correo, te llega a ti."}
            </p>
            {/* El correo va en un marco aislado (sandbox): su HTML no puede ejecutar código ni tocar la página.
                Solo se le permite abrir sus links (como el de Google Calendar) en una pestaña nueva. */}
            <iframe
              title="Vista previa del correo"
              srcDoc={correo.data.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[60vh] w-full rounded-lg border border-slate-200"
            />
          </>
        )}
      </div>
    </dialog>
  );
}
