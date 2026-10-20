import Link from "next/link";
import { SoloSinSesion } from "../Guardias";
import { LineasDeCancha } from "../LineasDeCancha";
import { Logo } from "../Logo";

// El marco del login y del registro: el logo y una tarjeta centrada sobre el azul de la cancha
export function PantallaDeAcceso({
  titulo,
  subtitulo,
  pie,
  children,
}: {
  titulo: string;
  subtitulo: string;
  pie: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SoloSinSesion>
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-blue-900 px-4 py-10">
        <LineasDeCancha className="pointer-events-none absolute top-1/2 left-1/2 w-[64rem] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 text-white/10 sm:rotate-0" />

        <div className="relative w-full max-w-sm">
          {/* Los horarios se ven sin entrar: el logo lleva a ellos */}
          <Link href="/" aria-label="Volea, ver los horarios" className="mb-8 flex justify-center text-3xl">
            <Logo tono="claro" />
          </Link>
          <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <h1 className="font-display text-3xl font-bold uppercase italic">{titulo}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-blue-100 [&_a]:text-lime-300">{pie}</p>
          <p className="mt-2 text-center text-sm">
            <Link href="/" className="font-medium text-white underline">
              Ver los horarios sin entrar
            </Link>
          </p>
        </div>
      </main>
    </SoloSinSesion>
  );
}
