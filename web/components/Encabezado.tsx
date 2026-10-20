"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { paginaDeInicio, useCerrarSesion } from "@/lib/consultas";
import type { Usuario } from "@/lib/tipos";
import { Boton } from "./Boton";
import { Logo } from "./Logo";

const ENLACES = {
  CLIENTE: [
    { href: "/", texto: "Reservar" },
    { href: "/mis-reservas", texto: "Mis reservas" },
  ],
  ADMIN: [{ href: "/admin", texto: "Panel" }],
};

// "usuario" es null para quien todavía no entró: ve los horarios y un botón para entrar
export function Encabezado({ usuario }: { usuario: Usuario | null }) {
  const rutaActual = usePathname();
  const cerrarSesion = useCerrarSesion();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={usuario ? paginaDeInicio(usuario.rol) : "/"} className="text-lg" aria-label="Volea, ir al inicio">
          <Logo />
        </Link>

        {/* En el celular el menú baja a una segunda línea */}
        {usuario && (
          <nav aria-label="Principal" className="order-last -mx-3 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
            {ENLACES[usuario.rol].map((enlace) => {
              const activo = rutaActual === enlace.href;
              return (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  aria-current={activo ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    activo ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {enlace.texto}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {usuario ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {usuario.nombre}
                {usuario.rol === "ADMIN" && (
                  <span className="ml-2 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-medium text-lime-800">Admin</span>
                )}
              </span>
              <Boton variante="secundario" cargando={cerrarSesion.isPending} onClick={() => cerrarSesion.mutate()}>
                Salir
              </Boton>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
