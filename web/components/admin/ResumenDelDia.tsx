"use client";

import { useResumen } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { rangoDeDias } from "@/lib/fechas";
import type { Resumen } from "@/lib/tipos";
import { Aviso } from "../Aviso";

// Los números del día para el dueño del club. Se actualizan solos cuando alguien reserva o cancela.
export function ResumenDelDia({ dia }: { dia: string }) {
  const resumen = useResumen(dia);

  if (resumen.isError) {
    return <Aviso>No se pudo cargar el resumen del día. Intenta de nuevo en un momento.</Aviso>;
  }
  return <TarjetasDelResumen resumen={resumen.data} />;
}

// Mientras cargan los datos ("resumen" sin valor), las tarjetas ya ocupan su lugar, para que la página no salte
export function TarjetasDelResumen({ resumen }: { resumen: Resumen | undefined }) {
  const porcentaje = resumen ? Math.round(resumen.dia.ocupacion * 100) : 0;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tarjeta
        titulo="Ocupación del día"
        valor={resumen && `${porcentaje} %`}
        detalle={resumen && `${resumen.dia.reservas} de ${resumen.dia.horasDelDia} horas reservadas`}
      >
        <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${porcentaje}%` }} />
        </div>
      </Tarjeta>
      <Tarjeta
        titulo="Ingresos del día"
        valor={resumen && formatearPesos(resumen.dia.ingresos)}
        detalle={resumen && `${resumen.dia.reservas} ${resumen.dia.reservas === 1 ? "reserva" : "reservas"}`}
      />
      <Tarjeta
        titulo="Ingresos de la semana"
        valor={resumen && formatearPesos(resumen.semana.ingresos)}
        detalle={resumen && `${resumen.semana.reservas} reservas, del ${rangoDeDias(resumen.semana.desde, resumen.semana.hasta)}`}
      />
      <Tarjeta
        titulo="Hora más pedida"
        valor={resumen && (resumen.horaMasPedida?.hora ?? "—")}
        detalle={
          resumen &&
          (resumen.horaMasPedida
            ? `${resumen.horaMasPedida.reservas} reservas en los últimos 30 días`
            : "Todavía no hay reservas")
        }
      />
    </dl>
  );
}

type PropsTarjeta = {
  titulo: string;
  valor: string | undefined;
  detalle: string | undefined;
  children?: React.ReactNode;
};

function Tarjeta({ titulo, valor, detalle, children }: PropsTarjeta) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-600">{titulo}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{valor ?? "…"}</dd>
      <dd className="mt-0.5 text-xs text-slate-500">{detalle ?? "Cargando…"}</dd>
      {children}
    </div>
  );
}
