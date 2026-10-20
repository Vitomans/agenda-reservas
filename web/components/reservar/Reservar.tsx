"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCambiosEnVivo } from "@/lib/cambios";
import { buscarCasilla, casillasDeLaCancha, casillasDelClub, type Eleccion } from "@/lib/casillas";
import {
  useDisponibilidad,
  useDisponibilidadDelClub,
  useEntrarComoInvitado,
  useHorario,
  useRecursos,
  useReservar,
  useSesion,
} from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { describirHorario, diaLargo } from "@/lib/fechas";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Reserva } from "@/lib/tipos";
import { Aviso, Cargando } from "../Aviso";
import { EnVivo } from "../EnVivo";
import { VistaDelCorreo } from "../VistaDelCorreo";
import { AvisoDeCambios } from "./AvisoDeCambios";
import { BarraParaReservar } from "./BarraParaReservar";
import { GrillaDeHorarios, Leyenda } from "./GrillaDeHorarios";
import { GrillaPorHora } from "./GrillaPorHora";
import { SelectorDeCancha } from "./SelectorDeCancha";
import { SelectorDeVista, type Vista } from "./SelectorDeVista";
import { TiraDeDias } from "./TiraDeDias";

// La pantalla principal: elige el día, la cancha y la hora, y reserva.
// Se ve sin iniciar sesión. Quien no entró puede reservar igual: se crea un jugador invitado en el mismo paso.
export function Reservar() {
  const { data: usuario = null } = useSesion();
  const horario = useHorario();
  const recursos = useRecursos();
  const reservar = useReservar();
  const entrarComoInvitado = useEntrarComoInvitado();

  const [vista, setVista] = useState<Vista>("cancha");
  const [recursoElegido, setRecursoElegido] = useState<string | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [reservaHecha, setReservaHecha] = useState<Reserva | null>(null);
  const [viendoCorreo, setViendoCorreo] = useState(false);

  // Si no se eligió nada (o lo elegido ya no está, por ejemplo al cambiar el día a medianoche),
  // se usa la primera cancha y el día de hoy
  const dias = horario.data?.dias ?? [];
  const dia = diaElegido && dias.includes(diaElegido) ? diaElegido : dias[0];
  const recurso = recursos.data?.find((r) => r.id === recursoElegido) ?? recursos.data?.[0];

  // Cada vista pide solo lo suyo: la grilla de una cancha, o todo el club hora por hora
  const porCancha = useDisponibilidad(vista === "cancha" ? recurso?.id : undefined, dia);
  const delClub = useDisponibilidadDelClub(vista === "hora" ? dia : undefined);
  const datos = vista === "cancha" ? porCancha : delClub;
  // En vivo: la cancha que se mira o, en la vista por hora, todas
  const canchasEnVivo = vista === "cancha" ? (recurso ? [recurso.id] : []) : (recursos.data?.map((r) => r.id) ?? []);
  const enVivo = useTiempoReal(canchasEnVivo);

  // Las dos vistas se pasan a casillas (una cancha a una hora). useMemo hace que el arreglo cambie
  // solo cuando llegan datos nuevos, que es lo que necesita useCambiosEnVivo para comparar.
  const casillas = useMemo(() => {
    if (vista === "cancha") return recurso && porCancha.data ? casillasDeLaCancha(recurso, porCancha.data) : undefined;
    return delClub.data ? casillasDelClub(delClub.data) : undefined;
  }, [vista, recurso, porCancha.data, delClub.data]);

  // Las horas en que otra persona acaba de reservar o liberar algo de lo que se está mirando
  const cambios = useCambiosEnVivo(casillas, `${vista}|${vista === "cancha" ? recurso?.id : "club"}|${dia}`);
  const casillaElegida = buscarCasilla(casillas, eleccion);
  // Lo elegido, solo si sigue libre (alguien podría haberlo tomado mientras tanto)
  const elegidaLibre = casillaElegida?.estado === "libre" ? casillaElegida : undefined;
  // Lo elegido, si otra persona lo reservó mientras se decidía
  const elegidaTomada = casillaElegida?.estado === "ocupado" ? casillaElegida : undefined;

  if (horario.isPending || recursos.isPending) {
    return <Cargando />;
  }
  if (horario.isError || recursos.isError) {
    return <Aviso>No se pudieron cargar las canchas. Intenta de nuevo en un momento.</Aviso>;
  }
  if (!recurso || !dia) {
    return <Aviso>Por ahora no hay canchas disponibles.</Aviso>;
  }

  const { zonaHoraria, tarifa } = horario.data;
  // En la vista por hora, las canchas libres a la hora elegida (para cambiar de cancha en la barra)
  const canchasLibres =
    vista === "hora" && elegidaLibre
      ? (casillas ?? []).filter((c) => c.inicio === elegidaLibre.inicio && c.estado === "libre").map((c) => c.cancha)
      : [];

  // Al cambiar algo se borran la elección y los mensajes anteriores
  function empezarDeNuevo() {
    setEleccion(null);
    setReservaHecha(null);
    reservar.reset();
    entrarComoInvitado.reset();
  }

  async function confirmar() {
    if (!elegidaLibre) return;
    if (!usuario) {
      try {
        await entrarComoInvitado.mutateAsync();
      } catch {
        return; // el error se muestra abajo (entrarComoInvitado.error)
      }
    }
    reservar.mutate(
      { recursoId: elegidaLibre.cancha.id, inicio: elegidaLibre.inicio },
      {
        onSuccess: (reserva) => {
          setReservaHecha(reserva);
          setEleccion(null);
        },
      },
    );
  }

  const error = reservar.error ?? entrarComoInvitado.error;

  return (
    <div className="space-y-6">
      <AvisoDeCambios cambios={cambios} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservar cancha</h1>
          <p className="mt-1 text-sm text-slate-600">
            Elige el día, la cancha y la hora. Cada reserva dura 1 hora y cuesta {formatearPesos(tarifa.precioNormal)}, o{" "}
            {formatearPesos(tarifa.precioPunta)} en hora punta (de lunes a viernes desde las {tarifa.inicioPuntaEntreSemana}
            :00, y todo el fin de semana).
          </p>
        </div>
        <EnVivo conectado={enVivo} />
      </div>

      <div className="space-y-3">
        <SelectorDeVista
          vista={vista}
          onCambiar={(nueva) => {
            setVista(nueva);
            empezarDeNuevo();
          }}
        />
        {vista === "cancha" && (
          <SelectorDeCancha
            recursos={recursos.data}
            elegido={recurso.id}
            onElegir={(id) => {
              setRecursoElegido(id);
              empezarDeNuevo();
            }}
          />
        )}
        <TiraDeDias
          dias={dias}
          elegido={dia}
          onElegir={(nuevoDia) => {
            setDiaElegido(nuevoDia);
            empezarDeNuevo();
          }}
        />
      </div>

      {reservaHecha && (
        <Aviso tipo="exito">
          ¡Listo! Reservaste la {reservaHecha.recurso.nombre} el{" "}
          {describirHorario(reservaHecha.inicio, reservaHecha.fin, zonaHoraria)} ({formatearPesos(reservaHecha.precio)}).{" "}
          <Link href="/mis-reservas" className="font-medium underline">
            Ver mis reservas
          </Link>{" "}
          ·{" "}
          <button type="button" onClick={() => setViendoCorreo(true)} className="font-medium underline">
            Ver el correo de confirmación
          </button>
        </Aviso>
      )}
      {reservaHecha && viendoCorreo && <VistaDelCorreo reservaId={reservaHecha.id} onCerrar={() => setViendoCorreo(false)} />}
      {error && <Aviso>{error.message}</Aviso>}
      {elegidaTomada && !error && (
        <Aviso>
          Otra persona acaba de reservar la {elegidaTomada.cancha.nombre} a las {elegidaTomada.hora}. Elige otro horario.
        </Aviso>
      )}

      <section aria-labelledby="titulo-horarios" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="titulo-horarios" className="font-semibold first-letter:uppercase">
              {vista === "cancha" ? `${recurso.nombre} · ${diaLargo(dia)}` : `Todas las canchas · ${diaLargo(dia)}`}
            </h2>
            {vista === "hora" && (
              <p className="mt-0.5 text-sm text-slate-500">¿A qué hora quieres jugar? Elige la hora y después la cancha.</p>
            )}
          </div>
          {vista === "cancha" && <Leyenda />}
        </div>

        {datos.isPending ? (
          <Cargando texto="Buscando horarios…" />
        ) : datos.isError ? (
          <Aviso>{datos.error.message}</Aviso>
        ) : vista === "cancha" ? (
          <GrillaDeHorarios
            bloques={porCancha.data ?? []}
            elegido={elegidaLibre?.inicio ?? null}
            resaltados={cambios.map((cambio) => cambio.inicio)}
            onElegir={(bloque) => {
              empezarDeNuevo();
              setEleccion({ recursoId: recurso.id, inicio: bloque.inicio });
            }}
          />
        ) : (
          <GrillaPorHora
            horas={delClub.data ?? []}
            elegida={elegidaLibre?.inicio ?? null}
            resaltados={cambios.map((cambio) => cambio.inicio)}
            onElegir={(hora) => {
              empezarDeNuevo();
              // Se elige la primera cancha libre; en la barra se puede cambiar
              const libre = hora.canchas.find((cancha) => cancha.estado === "libre");
              if (libre) setEleccion({ recursoId: libre.id, inicio: hora.inicio });
            }}
          />
        )}
      </section>

      {elegidaLibre && (
        <BarraParaReservar
          casilla={elegidaLibre}
          dia={dia}
          zonaHoraria={zonaHoraria}
          canchasLibres={canchasLibres}
          onElegirCancha={(recursoId) => setEleccion({ recursoId, inicio: elegidaLibre.inicio })}
          conSesion={usuario !== null}
          cargando={reservar.isPending || entrarComoInvitado.isPending}
          onReservar={confirmar}
          onCancelar={() => setEleccion(null)}
        />
      )}
    </div>
  );
}
