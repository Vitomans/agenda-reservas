import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pedirApi } from "./api";
import type {
  Bloque,
  Horario,
  HoraDelClub,
  Recurso,
  RecursoAdmin,
  Reserva,
  ReservaAdmin,
  Resumen,
  Rol,
  Usuario,
  VistaDeCorreo,
} from "./tipos";

// Todo lo que la página le pide a la API pasa por aquí.
//
// TanStack Query guarda cada respuesta con una "clave" (como un casillero con nombre).
// Si dos componentes piden lo mismo, la API se consulta una sola vez. Y cuando algo cambia
// (por ejemplo, alguien reserva), se marcan esos casilleros como viejos y se vuelven a pedir.
export const claves = {
  sesion: ["sesion"],
  horario: ["horario"],
  recursos: ["recursos"],
  disponibilidad: ["disponibilidad"],
  disponibilidadDelClub: ["disponibilidad", "club"],
  misReservas: ["mis-reservas"],
  correo: ["correo"],
  reservasDelDia: ["admin", "reservas"],
  resumen: ["admin", "resumen"],
  canchasAdmin: ["admin", "recursos"],
} as const;

// A dónde va cada rol después de entrar
export function paginaDeInicio(rol: Rol) {
  return rol === "ADMIN" ? "/admin" : "/";
}

// ---------- Consultas (leer datos) ----------

// El usuario que tiene la sesión iniciada, o null si nadie entró (la API responde usuario: null)
export function useSesion() {
  return useQuery({
    queryKey: claves.sesion,
    queryFn: async () => (await pedirApi<{ usuario: Usuario | null }>("/auth/yo")).usuario,
    // Solo cambia al entrar o salir, y eso se avisa a mano (setQueryData)
    staleTime: Infinity,
  });
}

export function useHorario() {
  return useQuery({
    queryKey: claves.horario,
    queryFn: () => pedirApi<Horario>("/horario"),
  });
}

export function useRecursos() {
  return useQuery({
    queryKey: claves.recursos,
    queryFn: async () => (await pedirApi<{ recursos: Recurso[] }>("/recursos")).recursos,
  });
}

export function useDisponibilidad(recursoId: string | undefined, fecha: string | undefined) {
  return useQuery({
    queryKey: [...claves.disponibilidad, recursoId, fecha],
    queryFn: async () =>
      (await pedirApi<{ bloques: Bloque[] }>(`/recursos/${recursoId}/disponibilidad?fecha=${fecha}`)).bloques,
    // No se pide hasta saber qué cancha y qué día mirar
    enabled: Boolean(recursoId && fecha),
  });
}

// Todo el club en un día, hora por hora: la vista "¿A qué hora quieres jugar?".
// Su clave empieza igual que la de las grillas, así se marca como vieja junto con ellas al reservar o cancelar.
export function useDisponibilidadDelClub(fecha: string | undefined) {
  return useQuery({
    queryKey: [...claves.disponibilidadDelClub, fecha],
    queryFn: async () => (await pedirApi<{ horas: HoraDelClub[] }>(`/disponibilidad?fecha=${fecha}`)).horas,
    enabled: Boolean(fecha),
  });
}

export function useMisReservas() {
  return useQuery({
    queryKey: claves.misReservas,
    queryFn: async () => (await pedirApi<{ reservas: Reserva[] }>("/reservas/mias")).reservas,
  });
}

// El correo de confirmación de una reserva. No cambia, así que se pide una sola vez.
export function useVistaDelCorreo(reservaId: string) {
  return useQuery({
    queryKey: [...claves.correo, reservaId],
    queryFn: () => pedirApi<VistaDeCorreo>(`/reservas/${reservaId}/correo`),
    staleTime: Infinity,
  });
}

export function useReservasDelDia(fecha: string | undefined) {
  return useQuery({
    queryKey: [...claves.reservasDelDia, fecha],
    queryFn: async () => (await pedirApi<{ reservas: ReservaAdmin[] }>(`/admin/reservas?fecha=${fecha}`)).reservas,
    enabled: Boolean(fecha),
  });
}

export function useResumen(fecha: string | undefined) {
  return useQuery({
    queryKey: [...claves.resumen, fecha],
    queryFn: () => pedirApi<Resumen>(`/admin/resumen?fecha=${fecha}`),
    enabled: Boolean(fecha),
    // Al cambiar de día se siguen viendo los números anteriores hasta que llegan los nuevos (así no saltan)
    placeholderData: keepPreviousData,
  });
}

export function useCanchasAdmin() {
  return useQuery({
    queryKey: claves.canchasAdmin,
    queryFn: async () => (await pedirApi<{ recursos: RecursoAdmin[] }>("/admin/recursos")).recursos,
  });
}

// ---------- Mutaciones (cambiar datos) ----------

export function useIniciarSesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (datos: { email: string; password: string }) =>
      (await pedirApi<{ usuario: Usuario }>("/auth/login", { metodo: "POST", cuerpo: datos })).usuario,
    onSuccess: (usuario) => queryClient.setQueryData(claves.sesion, usuario),
  });
}

// Crea un jugador nuevo solo para este visitante (el botón "Jugador demo")
export function useEntrarComoInvitado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => (await pedirApi<{ usuario: Usuario }>("/auth/invitado", { metodo: "POST" })).usuario,
    onSuccess: (usuario) => queryClient.setQueryData(claves.sesion, usuario),
  });
}

export function useRegistrarse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (datos: { nombre: string; email: string; password: string }) =>
      (await pedirApi<{ usuario: Usuario }>("/auth/registro", { metodo: "POST", cuerpo: datos })).usuario,
    onSuccess: (usuario) => queryClient.setQueryData(claves.sesion, usuario),
  });
}

export function useCerrarSesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pedirApi<null>("/auth/logout", { metodo: "POST" }),
    onSettled: () => {
      // Primero se avisa que nadie entró (así ZonaPrivada manda al login)...
      queryClient.setQueryData(claves.sesion, null);
      // ...y después se olvidan los demás datos, para que el siguiente usuario no los vea
      queryClient.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== claves.sesion[0] });
    },
  });
}

export function useReservar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (datos: { recursoId: string; inicio: string }) =>
      (await pedirApi<{ reserva: Reserva }>("/reservas", { metodo: "POST", cuerpo: datos })).reserva,
    // Haya salido bien o mal (por ejemplo, si otro la tomó antes), se vuelve a pedir la grilla
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
      queryClient.invalidateQueries({ queryKey: claves.misReservas });
    },
  });
}

export function useCancelarReserva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservaId: string) => pedirApi<null>(`/reservas/${reservaId}`, { metodo: "DELETE" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
      queryClient.invalidateQueries({ queryKey: claves.misReservas });
      queryClient.invalidateQueries({ queryKey: claves.reservasDelDia });
      queryClient.invalidateQueries({ queryKey: claves.resumen });
    },
  });
}

export function useCrearCancha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nombre: string) => pedirApi<{ recurso: RecursoAdmin }>("/admin/recursos", { metodo: "POST", cuerpo: { nombre } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.canchasAdmin });
      queryClient.invalidateQueries({ queryKey: claves.recursos });
    },
  });
}

export function useEditarCancha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string; nombre?: string; activo?: boolean }) =>
      pedirApi<{ recurso: RecursoAdmin }>(`/admin/recursos/${id}`, { metodo: "PATCH", cuerpo: cambios }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.canchasAdmin });
      queryClient.invalidateQueries({ queryKey: claves.recursos });
      queryClient.invalidateQueries({ queryKey: claves.reservasDelDia });
      queryClient.invalidateQueries({ queryKey: claves.resumen });
    },
  });
}
