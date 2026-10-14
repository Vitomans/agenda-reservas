"use client";

import type { FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import { useEntrarComoInvitado, useIniciarSesion } from "@/lib/consultas";
import { Aviso } from "../Aviso";
import { Boton } from "../Boton";
import { CampoTexto } from "./CampoTexto";

// La cuenta de admin de demostración que crea el seed de la API.
// No es secreta: sirve para que cualquiera pruebe el panel de admin sin registrarse.
const ADMIN_DEMO = { email: "admin@example.com", password: "demo1234" };

export function FormularioLogin() {
  const iniciarSesion = useIniciarSesion();
  // "Jugador demo" no usa una cuenta fija: la API crea un jugador nuevo para cada visitante
  const entrarComoInvitado = useEntrarComoInvitado();
  const ocupado = iniciarSesion.isPending || entrarComoInvitado.isPending;
  // Al tocar un botón se borra el error del otro, así que hay como mucho uno
  const algunError = iniciarSesion.error ?? entrarComoInvitado.error;
  const error = algunError instanceof ErrorApi ? algunError : null;
  const entrandoComoAdmin = iniciarSesion.isPending && iniciarSesion.variables.email === ADMIN_DEMO.email;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    entrarComoInvitado.reset();
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
          cargando={iniciarSesion.isPending && !entrandoComoAdmin}
          disabled={ocupado}
        >
          Entrar
        </Boton>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <p className="text-sm text-slate-600">¿Solo quieres probarla? Entra sin registrarte:</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Boton
            variante="secundario"
            cargando={entrarComoInvitado.isPending}
            disabled={ocupado}
            onClick={() => {
              iniciarSesion.reset();
              entrarComoInvitado.mutate();
            }}
          >
            Jugador demo
          </Boton>
          <Boton
            variante="secundario"
            cargando={entrandoComoAdmin}
            disabled={ocupado}
            onClick={() => {
              entrarComoInvitado.reset();
              iniciarSesion.mutate(ADMIN_DEMO);
            }}
          >
            Admin demo
          </Boton>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El jugador demo es una cuenta nueva solo para ti, y se borra al día siguiente.
        </p>
      </div>
    </>
  );
}
