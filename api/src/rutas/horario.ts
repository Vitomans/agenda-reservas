import { Router } from "express";
import { diasReservables, HORA_APERTURA, HORA_CIERRE, ZONA_HORARIA } from "../servicios/horario.ts";

// Rutas de /api/horario. Es pública: solo informa el horario del club.
export function crearRutasHorario() {
  const rutas = Router();

  // El frontend la usa para armar la tira de días y mostrar las horas en la hora del club.
  // Así "hoy" lo decide el servidor y no el reloj del computador de quien mira.
  rutas.get("/", (_req, res) => {
    res.json({
      zonaHoraria: ZONA_HORARIA,
      horaApertura: HORA_APERTURA,
      horaCierre: HORA_CIERRE,
      dias: diasReservables(),
    });
  });

  return rutas;
}
