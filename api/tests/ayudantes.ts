import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { DateTime } from "luxon";
import request from "supertest";
import { db } from "../src/db.ts";
import { ZONA_HORARIA } from "../src/servicios/horario.ts";

// Herramientas que comparten los tests. Los tests usan la base de datos de verdad,
// así que todo lo que crean lleva una marca para poder borrarlo al final.

const DOMINIO_DE_PRUEBA = "@tests.example.com";
const PREFIJO_CANCHA_DE_PRUEBA = "Prueba ";

export function emailNuevo() {
  return `jugador-${randomUUID()}${DOMINIO_DE_PRUEBA}`;
}

// Supertest devuelve las cookies como texto, por ejemplo "sesion=abc; Path=/; HttpOnly; SameSite=Lax"
export function cookieDeSesion(respuesta: request.Response) {
  const cookies = respuesta.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find((cookie) => cookie.startsWith("sesion="));
}

// Registra un jugador nuevo y devuelve un "navegador" (agent) que ya tiene la sesión iniciada
export async function entrarComoJugadorNuevo(app: Express) {
  const navegador = request.agent(app);
  const respuesta = await navegador
    .post("/api/auth/registro")
    .send({ nombre: "Jugador de prueba", email: emailNuevo(), password: "clave-segura" });

  return { navegador, usuario: respuesta.body.usuario as { id: string } };
}

export async function entrarComoAdmin(app: Express) {
  const navegador = request.agent(app);
  await navegador.post("/api/auth/login").send({ email: "admin@example.com", password: "demo1234" });
  return navegador;
}

// Cada test usa su propia cancha, así no choca con otros tests ni con reservas hechas a mano
export function crearCanchaDePrueba({ activo = true } = {}) {
  return db.recurso.create({ data: { nombre: `${PREFIJO_CANCHA_DE_PRUEBA}${randomUUID()}`, activo } });
}

// El inicio de un bloque en la hora del club. Por ejemplo, bloque(1, 10) = mañana a las 10:00.
export function bloque(diasDesdeHoy: number, hora: number, minuto = 0) {
  return DateTime.now()
    .setZone(ZONA_HORARIA)
    .startOf("day")
    .plus({ days: diasDesdeHoy })
    .set({ hour: hora, minute: minuto })
    .toUTC()
    .toISO()!;
}

// Fecha "AAAA-MM-DD" en la hora del club
export function dia(diasDesdeHoy: number) {
  return DateTime.now().setZone(ZONA_HORARIA).plus({ days: diasDesdeHoy }).toISODate()!;
}

// Borra lo que crearon los tests (primero las reservas, porque apuntan a usuarios y canchas)
export async function borrarDatosDePrueba() {
  const deUsuarioDePrueba = { usuario: { email: { endsWith: DOMINIO_DE_PRUEBA } } };
  const deCanchaDePrueba = { recurso: { nombre: { startsWith: PREFIJO_CANCHA_DE_PRUEBA } } };

  await db.reserva.deleteMany({ where: { OR: [deUsuarioDePrueba, deCanchaDePrueba] } });
  await db.usuario.deleteMany({ where: { email: { endsWith: DOMINIO_DE_PRUEBA } } });
  await db.recurso.deleteMany({ where: { nombre: { startsWith: PREFIJO_CANCHA_DE_PRUEBA } } });
}
