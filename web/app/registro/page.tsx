import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "@/components/acceso/FormularioRegistro";
import { PantallaDeAcceso } from "@/components/acceso/PantallaDeAcceso";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
  return (
    <PantallaDeAcceso
      titulo="Crear cuenta"
      subtitulo="Crea tu cuenta para reservar canchas."
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-blue-700 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <FormularioRegistro />
    </PantallaDeAcceso>
  );
}
