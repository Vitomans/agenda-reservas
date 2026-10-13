import type { ComponentProps } from "react";

type Variante = "principal" | "destacado" | "secundario" | "peligro";

const CLASES: Record<Variante, string> = {
  principal: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300",
  destacado: "bg-lime-400 text-slate-900 hover:bg-lime-300 disabled:bg-lime-200",
  secundario: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
  peligro: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300",
};

type Props = ComponentProps<"button"> & {
  variante?: Variante;
  cargando?: boolean; // muestra una ruedita y desactiva el botón mientras espera a la API
};

export function Boton({ variante = "principal", cargando = false, disabled, className = "", children, ...props }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed ${CLASES[variante]} ${className}`}
      {...props}
    >
      {cargando && <Ruedita />}
      {children}
    </button>
  );
}

export function Ruedita() {
  return (
    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
