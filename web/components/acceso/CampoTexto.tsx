import { useId, type ComponentProps } from "react";

type Props = ComponentProps<"input"> & {
  etiqueta: string;
  ayuda?: string;
  errores?: string[]; // los mensajes que mandó la API para este campo
};

// Un campo de formulario con su etiqueta y, si hay, su mensaje de error debajo
export function CampoTexto({ etiqueta, ayuda, errores, ...props }: Props) {
  const id = useId();
  const error = errores?.[0];
  const idDescripcion = `${id}-descripcion`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || ayuda ? idDescripcion : undefined}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-xs outline-blue-600 focus:border-blue-600 focus:outline-2 focus:-outline-offset-1 aria-invalid:border-red-500"
        {...props}
      />
      {(error || ayuda) && (
        <p id={idDescripcion} className={`mt-1 text-sm ${error ? "text-red-700" : "text-slate-500"}`}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}
