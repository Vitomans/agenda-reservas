"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { paginaDeInicio, useSesion } from "@/lib/consultas";
import type { Rol, Usuario } from "@/lib/tipos";
import { Aviso, Cargando } from "./Aviso";
import { Encabezado } from "./Encabezado";
import { PieDePagina } from "./PieDePagina";

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
    return <SinConexion />;
  }

  if (!usuario || usuario.rol !== rol) {
    return <Cargando />;
  }

  return <ConEncabezado usuario={usuario}>{children}</ConEncabezado>;
}

// Para las páginas que también se ven sin entrar (reservar). Un visitante las ve con un botón para entrar,
// y un admin va a su panel, porque los admins no reservan.
export function ZonaAbierta({ children }: { children: React.ReactNode }) {
  const { data: usuario, isPending, isError } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (usuario?.rol === "ADMIN") {
      router.replace(paginaDeInicio(usuario.rol));
    }
  }, [usuario, router]);

  if (isError) {
    return <SinConexion />;
  }

  if (isPending || usuario?.rol === "ADMIN") {
    return <Cargando />;
  }

  return <ConEncabezado usuario={usuario}>{children}</ConEncabezado>;
}

function ConEncabezado({ usuario, children }: { usuario: Usuario | null; children: React.ReactNode }) {
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      <PieDePagina />
    </>
  );
}

function SinConexion() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Aviso>No se pudo conectar con el servidor. Intenta de nuevo en un momento.</Aviso>
    </main>
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
