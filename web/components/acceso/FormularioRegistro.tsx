"use client";

import type { FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import { useRegistrarse } from "@/lib/consultas";
import { Aviso } from "../Aviso";
import { Boton } from "../Boton";
import { CampoTexto } from "./CampoTexto";

export function FormularioRegistro() {
  const registrarse = useRegistrarse();
  const error = registrarse.error instanceof ErrorApi ? registrarse.error : null;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    registrarse.mutate({
      nombre: String(datos.get("nombre")),
      email: String(datos.get("email")),
      password: String(datos.get("password")),
    });
  }

  // Al crear la cuenta la sesión queda iniciada, y SoloSinSesion lleva a la página de reservas
  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {/* Si el error es de un campo, el mensaje ya aparece debajo de ese campo */}
      {error && Object.keys(error.detalles).length === 0 && <Aviso>{error.message}</Aviso>}
      <CampoTexto etiqueta="Nombre" name="nombre" autoComplete="name" required errores={error?.detalles.nombre} />
      <CampoTexto
        etiqueta="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errores={error?.detalles.email}
      />
      <CampoTexto
        etiqueta="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        ayuda="Al menos 8 caracteres."
        errores={error?.detalles.password}
      />
      <Boton type="submit" className="w-full" cargando={registrarse.isPending}>
        Crear cuenta
      </Boton>
    </form>
  );
}
