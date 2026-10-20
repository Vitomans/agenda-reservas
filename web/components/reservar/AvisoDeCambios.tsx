import { textoDelCambio, type CambioEnLaGrilla } from "@/lib/cambios";

// Un aviso arriba de la pantalla cuando otra persona reserva o libera una hora de la grilla que se está mirando.
// La región está siempre en la página, aunque vacía, para que los lectores de pantalla lean cada aviso nuevo.
export function AvisoDeCambios({ cambios }: { cambios: CambioEnLaGrilla[] }) {
  const texto = textoDelCambio(cambios);

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-3 z-20 flex justify-center px-4">
      {texto && (
        <p
          // Con otra "key" el aviso se vuelve a dibujar y repite la animación de entrada
          key={cambios.map((cambio) => `${cambio.inicio}-${cambio.tipo}`).join(",")}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg motion-safe:animate-entrar"
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-lime-400" />
          {texto}
        </p>
      )}
    </div>
  );
}
