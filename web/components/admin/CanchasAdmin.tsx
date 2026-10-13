"use client";

import { useState, type FormEvent } from "react";
import { useCanchasAdmin, useCrearCancha, useEditarCancha } from "@/lib/consultas";
import { Aviso, Cargando } from "../Aviso";
import { Boton } from "../Boton";

const claseCampo =
  "min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base outline-blue-600 focus:border-blue-600 focus:outline-2 focus:-outline-offset-1 sm:text-sm";

export function CanchasAdmin() {
  const canchas = useCanchasAdmin();
  const crear = useCrearCancha();
  const editar = useEditarCancha();
  // La cancha a la que se le está cambiando el nombre
  const [renombrando, setRenombrando] = useState<string | null>(null);

  const error = crear.error ?? editar.error;

  function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    editar.reset();
    crear.mutate(String(new FormData(formulario).get("nombre")), { onSuccess: () => formulario.reset() });
  }

  function renombrar(evento: FormEvent<HTMLFormElement>, id: string) {
    evento.preventDefault();
    crear.reset();
    editar.mutate(
      { id, nombre: String(new FormData(evento.currentTarget).get("nombre")) },
      { onSuccess: () => setRenombrando(null) },
    );
  }

  return (
    <section aria-labelledby="titulo-canchas" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 id="titulo-canchas" className="font-semibold">
        Canchas
      </h2>
      <p className="text-sm text-slate-600">Las desactivadas no aparecen para los jugadores.</p>

      <div className="mt-4 space-y-3">
        {error && <Aviso>{error.message}</Aviso>}

        {canchas.isPending ? (
          <Cargando />
        ) : canchas.isError ? (
          <Aviso>{canchas.error.message}</Aviso>
        ) : (
          <ul className="divide-y divide-slate-100">
            {canchas.data.map((cancha) => (
              <li key={cancha.id} className="py-3">
                {renombrando === cancha.id ? (
                  <form onSubmit={(evento) => renombrar(evento, cancha.id)} className="flex gap-2">
                    <input
                      name="nombre"
                      defaultValue={cancha.nombre}
                      aria-label={`Nuevo nombre para ${cancha.nombre}`}
                      autoFocus
                      className={claseCampo}
                    />
                    <Boton type="submit" cargando={editar.isPending}>
                      Guardar
                    </Boton>
                    <Boton variante="secundario" onClick={() => setRenombrando(null)}>
                      No
                    </Boton>
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${cancha.activo ? "" : "text-slate-400"}`}>{cancha.nombre}</p>
                      {!cancha.activo && <p className="text-xs text-slate-500">Desactivada</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        editar.reset();
                        setRenombrando(cancha.id);
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Renombrar
                    </button>
                    <button
                      type="button"
                      disabled={editar.isPending}
                      onClick={() => {
                        crear.reset();
                        editar.mutate({ id: cancha.id, activo: !cancha.activo });
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                    >
                      {cancha.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={agregar} className="flex gap-2 border-t border-slate-100 pt-4">
          <input name="nombre" placeholder="Nombre de la cancha nueva" aria-label="Nombre de la cancha nueva" className={claseCampo} />
          <Boton type="submit" cargando={crear.isPending}>
            Agregar
          </Boton>
        </form>
      </div>
    </section>
  );
}
