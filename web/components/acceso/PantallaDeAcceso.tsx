import { SoloSinSesion } from "../Guardias";
import { Logo } from "../Logo";

// El marco del login y del registro: el logo y una tarjeta centrada
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
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center text-2xl">
            <Logo />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold">{titulo}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">{pie}</p>
        </div>
      </main>
    </SoloSinSesion>
  );
}
