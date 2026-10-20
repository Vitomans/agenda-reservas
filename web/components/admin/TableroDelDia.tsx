import { formatearPesos } from "@/lib/dinero";
import { horaEnElClub } from "@/lib/fechas";
import type { Recurso, ReservaAdmin } from "@/lib/tipos";

type Props = {
  dia: string;
  hoy: string;
  canchas: Recurso[]; // las canchas activas, una columna por cancha
  reservas: ReservaAdmin[];
  horas: string[]; // "08:00", "09:00"... una fila por hora
  zonaHoraria: string;
  ahora: number; // para mostrar más claras las horas que ya empezaron
};

// Todo el club de un vistazo: una fila por hora y una columna por cancha, con quién reservó cada hora.
// Es una tabla de verdad (<table>), así un lector de pantalla puede decir "Cancha 2, 19:00: Camila Rojas".
export function TableroDelDia({ dia, hoy, canchas, reservas, horas, zonaHoraria, ahora }: Props) {
  // Las reservas confirmadas, ordenadas por cancha y hora para encontrarlas rápido
  const porCelda = new Map(
    reservas
      .filter((reserva) => reserva.estado === "CONFIRMADA")
      .map((reserva) => [`${reserva.recurso.id}|${horaEnElClub(reserva.inicio, zonaHoraria)}`, reserva]),
  );
  const horaActual = horaEnElClub(new Date(ahora).toISOString(), zonaHoraria);
  // Los días se comparan como texto ("2026-10-19" < "2026-10-20"), y las horas también ("14:00" <= "14:23")
  const yaEmpezo = (hora: string) => dia < hoy || (dia === hoy && hora <= horaActual);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-1 text-xs">
        <caption className="sr-only">Reservas confirmadas de cada cancha, hora por hora</caption>
        <thead>
          <tr>
            <th scope="col" className="w-10 sm:w-12">
              <span className="sr-only">Hora</span>
            </th>
            {canchas.map((cancha) => (
              <th key={cancha.id} scope="col" className="truncate px-1 pb-1 text-left font-medium text-slate-700 sm:text-sm">
                {cancha.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora} className={yaEmpezo(hora) ? "opacity-50" : ""}>
              <th scope="row" className="pr-1 text-right font-medium text-slate-500 tabular-nums">
                {hora}
              </th>
              {canchas.map((cancha) => {
                const reserva = porCelda.get(`${cancha.id}|${hora}`);
                return (
                  <td
                    key={cancha.id}
                    className={`h-11 rounded-lg px-2 align-middle ${
                      reserva ? "bg-blue-50 text-blue-950 ring-1 ring-blue-200 ring-inset" : "bg-slate-50"
                    }`}
                  >
                    {reserva ? (
                      <>
                        {/* En el celular las columnas son angostas: se muestra solo el primer nombre */}
                        <p className="truncate font-medium" title={reserva.usuario.nombre}>
                          <span className="sm:hidden">{reserva.usuario.nombre.split(" ")[0]}</span>
                          <span className="hidden sm:inline">{reserva.usuario.nombre}</span>
                        </p>
                        <p className="text-blue-700 tabular-nums">{formatearPesos(reserva.precio)}</p>
                      </>
                    ) : (
                      <span className="sr-only">Libre</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
