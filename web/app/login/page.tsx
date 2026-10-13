import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLogin } from "@/components/acceso/FormularioLogin";
import { PantallaDeAcceso } from "@/components/acceso/PantallaDeAcceso";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return (
    <PantallaDeAcceso
      titulo="Iniciar sesión"
      subtitulo="Reserva tu cancha de pádel en segundos."
      pie={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-blue-700 hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      <FormularioLogin />
    </PantallaDeAcceso>
  );
}
