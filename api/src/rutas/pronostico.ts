import { Router } from "express";
import type { Meteorologo } from "../meteorologo.ts";
import { ErrorHttp } from "../middlewares/errores.ts";
import { DIAS_DE_ANTICIPACION, diasReservables } from "../servicios/horario.ts";
import { pronosticoDelDia } from "../servicios/pronostico.ts";
import { esquemaFecha } from "../validacion/reservas.ts";

// Rutas de /api/pronostico: el tiempo en Santiago a cada hora del club. Es pública, como los horarios.
// La página la usa en la barra para reservar ("18 °C · lluvia ligera" a la hora elegida) y en la tarjeta
// del asistente para confirmar una reserva.
export function crearRutasPronostico(meteorologo: Meteorologo) {
  const rutas = Router();

  rutas.get("/", async (req, res) => {
    const { fecha } = esquemaFecha.parse(req.query);
    if (!diasReservables().includes(fecha)) {
      throw new ErrorHttp(400, `Solo hay pronóstico de los próximos ${DIAS_DE_ANTICIPACION} días`);
    }

    const datos = await meteorologo.datos();
    if (!datos) {
      throw new ErrorHttp(503, "El pronóstico no está disponible en este momento");
    }

    res.json({ fecha, horas: pronosticoDelDia(datos, fecha) });
  });

  return rutas;
}
