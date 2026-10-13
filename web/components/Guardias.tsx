"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { paginaDeInicio, useSesion } from "@/lib/consultas";
import type { Rol } from "@/lib/tipos";
import { Aviso, Cargando } from "./Aviso";
import { Encabezado } from "./Encabezado";

// Los "guardias" deciden quién puede ver cada página.
// La seguridad de verdad está en la API (401 y 403); esto solo lleva a cada uno a su lugar.

// Para las páginas con sesión: si nadie entró, manda al login; si el rol no corresponde, a su inicio.
export function ZonaPrivada({ rol, children }: { rol: Rol; children: React.ReactNode }) {
  const { data: usuario, isError } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (usuario === null) {
      router.replace("/login");
    } else if (usuario && usuario.rol !== rol) {
      router.replace(paginaDeInicio(usuario.rol));
    }
  }, [usuario, rol, router]);

  if (isError) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Aviso>No se pudo conectar con el servidor. Intenta de nuevo en un momento.</Aviso>
      </main>
    );
  }

  if (!usuario || usuario.rol !== rol) {
    return <Cargando />;
  }

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}

// Para el login y el registro: si ya hay sesión, no tiene sentido mostrarlos.
// También se encarga de llevar a cada uno a su inicio justo después de entrar.
export function SoloSinSesion({ children }: { children: React.ReactNode }) {
  const { data: usuario, isPending } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (usuario) {
      router.replace(paginaDeInicio(usuario.rol));
    }
  }, [usuario, router]);

  if (isPending || usuario) {
    return <Cargando />;
  }

  return children;
}
