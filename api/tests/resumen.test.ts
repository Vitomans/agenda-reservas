import { DateTime } from "luxon";
import { afterAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { HORA_APERTURA, HORA_CIERRE, ZONA_HORARIA } from "../src/servicios/horario.ts";
import { borrarDatosDePrueba, crearCanchaDePrueba, entrarComoAdmin, entrarComoJugadorNuevo } from "./ayudantes.ts";

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

// Una semana dentro de unos 200 días: tan lejos que no tiene reservas de los socios simulados,
// así se sabe exactamente qué números deberían salir
const lunes = DateTime.now().setZone(ZONA_HORARIA).plus({ days: 200 }).startOf("week");
const enLaSemana = (dias: number, hora: number) => lunes.plus({ days: dias }).set({ hour: hora }).toJSDate();
const miercoles = lunes.plus({ days: 2 }).toISODate()!;

describe("GET /api/admin/resumen", () => {
  it("resume el día, su semana y la hora más pedida, contando solo las reservas confirmadas de canchas activas", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const desactivada = await crearCanchaDePrueba({ activo: false });
    const { usuario } = await entrarComoJugadorNuevo(app);

    const reservar = (recursoId: string, dias: number, hora: number, precio: number, estado = "CONFIRMADA" as const) =>
      db.reserva.create({
        data: {
          recursoId,
          usuarioId: usuario.id,
          inicio: enLaSemana(dias, hora),
          fin: enLaSemana(dias, hora + 1),
          precio,
          estado,
        },
      });

    await reservar(cancha.id, 1, 19, 16_000); // martes
    await reservar(cancha.id, 2, 10, 12_000); // miércoles
    await reservar(cancha.id, 2, 19, 16_000); // miércoles
    await reservar(cancha.id, 2, 20, 16_000); // miércoles
    await db.reserva.create({
      data: { recursoId: cancha.id, usuarioId: usuario.id, inicio: enLaSemana(2, 21), fin: enLaSemana(2, 22), precio: 16_000, estado: "CANCELADA" },
    });
    await reservar(desactivada.id, 2, 11, 12_000); // en una cancha desactivada: no cuenta
    await reservar(cancha.id, 4, 19, 16_000); // viernes
    await reservar(cancha.id, 7, 19, 16_000); // el lunes siguiente: ya es otra semana

    const admin = await entrarComoAdmin(app);
    const respuesta = await admin.get(`/api/admin/resumen?fecha=${miercoles}`);

    expect(respuesta.status).toBe(200);
    const horasDelDia = (await db.recurso.count({ where: { activo: true } })) * (HORA_CIERRE - HORA_APERTURA);
    expect(respuesta.body).toEqual({
      fecha: miercoles,
      dia: { reservas: 3, ingresos: 44_000, horasDelDia, ocupacion: 3 / horasDelDia },
      semana: { desde: lunes.toISODate(), hasta: lunes.plus({ days: 6 }).toISODate(), reservas: 5, ingresos: 76_000 },
      // En los 30 días que terminan el miércoles, las 19:00 tienen 2 reservas (martes y miércoles)
      horaMasPedida: { hora: "19:00", reservas: 2 },
    });
  });

  it("en un día sin reservas, todo está en cero y no hay hora más pedida", async () => {
    const admin = await entrarComoAdmin(crearApp());
    const lejos = DateTime.now().setZone(ZONA_HORARIA).plus({ days: 400 }).toISODate();

    const respuesta = await admin.get(`/api/admin/resumen?fecha=${lejos}`);

    expect(respuesta.body.dia).toMatchObject({ reservas: 0, ingresos: 0, ocupacion: 0 });
    expect(respuesta.body.horaMasPedida).toBeNull();
  });
});
