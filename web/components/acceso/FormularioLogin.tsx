"use client";

import type { FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import { useIniciarSesion } from "@/lib/consultas";
import { Aviso } from "../Aviso";
import { Boton } from "../Boton";
import { CampoTexto } from "./CampoTexto";

// Las cuentas de demostración que crea el seed de la API.
// No son secretas: sirven para que cualquiera pruebe la app sin registrarse.
const CUENTAS_DEMO = {
  jugador: { email: "cliente@example.com", password: "demo1234" },
  admin: { email: "admin@example.com", password: "demo1234" },
};

export function FormularioLogin() {
  const iniciarSesion = useIniciarSesion();
  const error = iniciarSesion.error instanceof ErrorApi ? iniciarSesion.error : null;
  // Con qué email se está entrando, para mostrar la ruedita solo en ese botón
  const emailEnCurso = iniciarSesion.isPending ? iniciarSesion.variables.email : null;
  const esDemo = emailEnCurso === CUENTAS_DEMO.jugador.email || emailEnCurso === CUENTAS_DEMO.admin.email;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    iniciarSesion.mutate({ email: String(datos.get("email")), password: String(datos.get("password")) });
  }

  // Al entrar bien, SoloSinSesion lleva a cada uno a su página
  return (
    <>
      <form onSubmit={enviar} noValidate className="space-y-4">
        {/* Si el error es de un campo, el mensaje ya aparece debajo de ese campo */}
        {error && Object.keys(error.detalles).length === 0 && <Aviso>{error.message}</Aviso>}
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
          autoComplete="current-password"
          required
          errores={error?.detalles.password}
        />
        <Boton
          type="submit"
          className="w-full"
          cargando={iniciarSesion.isPending && !esDemo}
          disabled={iniciarSesion.isPending}
        >
          Entrar
        </Boton>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <p className="text-sm text-slate-600">¿Solo quieres probarla? Entra con una cuenta de demostración:</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Boton
            variante="secundario"
            cargando={emailEnCurso === CUENTAS_DEMO.jugador.email}
            disabled={iniciarSesion.isPending}
            onClick={() => iniciarSesion.mutate(CUENTAS_DEMO.jugador)}
          >
            Jugador demo
          </Boton>
          <Boton
            variante="secundario"
            cargando={emailEnCurso === CUENTAS_DEMO.admin.email}
            disabled={iniciarSesion.isPending}
            onClick={() => iniciarSesion.mutate(CUENTAS_DEMO.admin)}
          >
            Admin demo
          </Boton>
        </div>
      </div>
    </>
  );
}
