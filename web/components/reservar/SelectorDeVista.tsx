export type Vista = "cancha" | "hora";

const VISTAS: { vista: Vista; texto: string }[] = [
  { vista: "cancha", texto: "Por cancha" },
  { vista: "hora", texto: "Por hora" },
];

// Dos formas de buscar: elegir una cancha y ver sus horas, o elegir la hora y ver qué canchas quedan libres
export function SelectorDeVista({ vista, onCambiar }: { vista: Vista; onCambiar: (vista: Vista) => void }) {
  return (
    <div role="group" aria-label="Buscar" className="inline-grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {VISTAS.map((opcion) => {
        const activa = opcion.vista === vista;
        return (
          <button
            key={opcion.vista}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(opcion.vista)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activa ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {opcion.texto}
          </button>
        );
      })}
    </div>
  );
}
