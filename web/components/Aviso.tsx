import { Ruedita } from "./Boton";

type Tipo = "error" | "exito";

const CLASES: Record<Tipo, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  exito: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

// Un mensaje en un recuadro. Los lectores de pantalla lo leen apenas aparece.
export function Aviso({ tipo = "error", children }: { tipo?: Tipo; children: React.ReactNode }) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${CLASES[tipo]}`}>
      {children}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Ruedita />
      {texto}
    </div>
  );
}
