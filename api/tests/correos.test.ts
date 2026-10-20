import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { crearApp } from "../src/app.ts";
import { type Cartero, type Correo, carteroDeBrevo, conLimiteDiario } from "../src/cartero.ts";
import { db } from "../src/db.ts";
import {
  correoDeReservaCancelada,
  correoDeReservaConfirmada,
  esCorreoDeVerdad,
  eventoDeCalendario,
  linkDeGoogleCalendar,
} from "../src/servicios/correos.ts";
import {
  bloque,
  borrarDatosDePrueba,
  crearCanchaDePrueba,
  entrarComoAdmin,
  entrarComoJugadorConCorreo,
  entrarComoJugadorNuevo,
} from "./ayudantes.ts";

afterAll(async () => {
  await borrarDatosDePrueba();
  await db.$disconnect();
});

// El 21 de octubre de 2026 (miércoles), las 22:00 UTC son las 19:00 en Chile
const DATOS = {
  reserva: {
    id: "reserva-1",
    inicio: new Date("2026-10-21T22:00:00Z"),
    fin: new Date("2026-10-21T23:00:00Z"),
    precio: 16_000,
    recurso: { nombre: "Cancha 1" },
  },
  usuario: { nombre: "Ana", email: "ana@correo.cl" },
};

// Un cartero de mentira que guarda los correos que le pidieron enviar
function carteroFalso() {
  return { enviar: vi.fn<Cartero["enviar"]>(async () => {}) };
}

describe("el correo de confirmación", () => {
  it("trae la cancha, el día, el horario y el precio, en HTML y en texto", () => {
    const correo = correoDeReservaConfirmada(DATOS);

    expect(correo.para).toEqual(DATOS.usuario);
    expect(correo.asunto).toBe("Reserva confirmada: Cancha 1, miércoles 21 de octubre a las 19:00");
    for (const parte of [correo.html, correo.texto]) {
      expect(parte).toContain("19:00 a 20:00");
      expect(parte).toContain("$16.000");
    }
  });

  it("escapa el HTML de lo que escriben los usuarios", () => {
    const correo = correoDeReservaConfirmada({ ...DATOS, usuario: { ...DATOS.usuario, nombre: "<script>alert(1)</script>" } });

    expect(correo.html).not.toContain("<script>");
    expect(correo.html).toContain("&lt;script&gt;");
  });

  it("trae un link de Google Calendar con la hora en UTC", () => {
    const link = new URL(linkDeGoogleCalendar(DATOS));

    expect(link.hostname).toBe("calendar.google.com");
    expect(link.searchParams.get("dates")).toBe("20261021T220000Z/20261021T230000Z");
    expect(correoDeReservaConfirmada(DATOS).html).toContain("calendar.google.com");
  });

  it("adjunta el evento de calendario (.ics)", () => {
    const [adjunto] = correoDeReservaConfirmada(DATOS).adjuntos!;
    const conComa = eventoDeCalendario({ ...DATOS, reserva: { ...DATOS.reserva, recurso: { nombre: "Cancha 1, techada" } } });

    expect(adjunto.nombre).toBe("reserva-volea.ics");
    expect(adjunto.contenido).toContain("DTSTART:20261021T220000Z\r\nDTEND:20261021T230000Z");
    // En los archivos .ics la coma separa valores, así que en el texto va escapada
    expect(conComa).toContain("SUMMARY:Pádel en Volea · Cancha 1\\, techada");
  });
});

describe("el correo de cancelación", () => {
  it("dice si canceló el jugador o el club", () => {
    expect(correoDeReservaCancelada(DATOS, { porElClub: false }).html).toContain("Cancelaste tu reserva");
    expect(correoDeReservaCancelada(DATOS, { porElClub: true }).html).toContain("El club canceló tu reserva");
    expect(correoDeReservaCancelada(DATOS, { porElClub: true }).asunto).toMatch(/^Reserva cancelada: /);
  });
});

describe("esCorreoDeVerdad", () => {
  it("descarta los correos de example.com, que no existen", () => {
    expect(esCorreoDeVerdad("admin@example.com")).toBe(false);
    expect(esCorreoDeVerdad("invitado-1@invitados.example.com")).toBe(false);
    expect(esCorreoDeVerdad("socio-01@socios.example.com")).toBe(false);
    expect(esCorreoDeVerdad("ana@gmail.com")).toBe(true);
    expect(esCorreoDeVerdad("ana@example.com.cl")).toBe(true);
  });
});

describe("carteroDeBrevo", () => {
  const remitente = { email: "club@correo.cl", nombre: "Club Volea" };

  it("envía el correo a la API de Brevo, con el adjunto en base64", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("{}", { status: 201 }));
    const cartero = carteroDeBrevo({ apiKey: "clave-de-prueba", remitente, fetch });

    await cartero.enviar(correoDeReservaConfirmada(DATOS));

    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(opciones?.headers).toMatchObject({ "api-key": "clave-de-prueba" });
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo).toMatchObject({
      sender: { email: "club@correo.cl", name: "Club Volea" },
      to: [{ email: "ana@correo.cl", name: "Ana" }],
      subject: "Reserva confirmada: Cancha 1, miércoles 21 de octubre a las 19:00",
    });
    expect(Buffer.from(cuerpo.attachment[0].content, "base64").toString()).toContain("BEGIN:VCALENDAR");
  });

  it("avisa con un error si Brevo no acepta el correo", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("clave inválida", { status: 401 }));
    const cartero = carteroDeBrevo({ apiKey: "clave-mala", remitente, fetch });

    await expect(cartero.enviar(correoDeReservaConfirmada(DATOS))).rejects.toThrow("Brevo respondió 401");
  });
});

describe("conLimiteDiario", () => {
  it("deja pasar como mucho el máximo de correos al día para cada destinatario", async () => {
    const falso = carteroFalso();
    let hoy = new Date("2026-10-21T12:00:00Z");
    const cartero = conLimiteDiario(falso, 2, () => hoy);
    const paraAna: Correo = { ...correoDeReservaConfirmada(DATOS) };
    const paraBeto: Correo = { ...paraAna, para: { email: "beto@correo.cl", nombre: "Beto" } };
    vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i < 3; i++) await cartero.enviar(paraAna);
    await cartero.enviar(paraBeto);
    expect(falso.enviar).toHaveBeenCalledTimes(3); // 2 para Ana y 1 para Beto

    hoy = new Date("2026-10-22T12:00:00Z"); // al día siguiente, Ana puede recibir de nuevo
    await cartero.enviar(paraAna);
    expect(falso.enviar).toHaveBeenCalledTimes(4);
  });
});

describe("correos al reservar y al cancelar", () => {
  it("al reservar, le manda la confirmación al jugador", async () => {
    const cartero = carteroFalso();
    const app = crearApp({ cartero });
    const cancha = await crearCanchaDePrueba();
    const { navegador, usuario } = await entrarComoJugadorConCorreo(app);

    await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 10) }).expect(201);

    // El correo se envía después de responder, así que se espera un momento a que llegue
    await vi.waitFor(() => expect(cartero.enviar).toHaveBeenCalledTimes(1));
    const [correo] = cartero.enviar.mock.calls[0];
    expect(correo.para.email).toBe(usuario.email);
    expect(correo.asunto).toMatch(/^Reserva confirmada: /);
  });

  it("a los jugadores con correos de example.com (como los demo) no les manda nada", async () => {
    const cartero = carteroFalso();
    const app = crearApp({ cartero });
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorNuevo(app);

    await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 11) }).expect(201);
    await new Promise((listo) => setTimeout(listo, 200));

    expect(cartero.enviar).not.toHaveBeenCalled();
  });

  it("si el admin cancela, le avisa al jugador que lo canceló el club", async () => {
    const cartero = carteroFalso();
    const app = crearApp({ cartero });
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorConCorreo(app);
    const admin = await entrarComoAdmin(app);
    const { body } = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 12) });
    await vi.waitFor(() => expect(cartero.enviar).toHaveBeenCalledTimes(1));

    await admin.delete(`/api/reservas/${body.reserva.id}`).expect(204);

    await vi.waitFor(() => expect(cartero.enviar).toHaveBeenCalledTimes(2));
    const [correo] = cartero.enviar.mock.calls[1];
    expect(correo.asunto).toMatch(/^Reserva cancelada: /);
    expect(correo.html).toContain("El club canceló tu reserva");
  });

  it("si el correo no se puede enviar, la reserva igual queda hecha", async () => {
    const cartero = { enviar: vi.fn<Cartero["enviar"]>(async () => Promise.reject(new Error("Brevo no responde"))) };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = crearApp({ cartero });
    const cancha = await crearCanchaDePrueba();
    const { navegador } = await entrarComoJugadorConCorreo(app);

    const respuesta = await navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 13) });

    expect(respuesta.status).toBe(201);
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(await db.reserva.count({ where: { id: respuesta.body.reserva.id, estado: "CONFIRMADA" } })).toBe(1);
  });
});

describe("GET /api/reservas/:id/correo", () => {
  it("le muestra al dueño el correo de su reserva y si se envía de verdad", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const conCorreo = await entrarComoJugadorConCorreo(app);
    const demo = await entrarComoJugadorNuevo(app);
    const deConCorreo = await conCorreo.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 14) });
    const deDemo = await demo.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 15) });

    const respuesta = await conCorreo.navegador.get(`/api/reservas/${deConCorreo.body.reserva.id}/correo`);
    const respuestaDemo = await demo.navegador.get(`/api/reservas/${deDemo.body.reserva.id}/correo`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ para: conCorreo.usuario.email, seEnvia: true });
    expect(respuesta.body.asunto).toMatch(/^Reserva confirmada: /);
    expect(respuesta.body.html).toContain("<!doctype html>");
    expect(respuestaDemo.body.seEnvia).toBe(false);
  });

  it("solo la ve el dueño o un admin", async () => {
    const app = crearApp();
    const cancha = await crearCanchaDePrueba();
    const dueno = await entrarComoJugadorNuevo(app);
    const otro = await entrarComoJugadorNuevo(app);
    const admin = await entrarComoAdmin(app);
    const { body } = await dueno.navegador.post("/api/reservas").send({ recursoId: cancha.id, inicio: bloque(1, 16) });

    expect((await otro.navegador.get(`/api/reservas/${body.reserva.id}/correo`)).status).toBe(403);
    expect((await admin.get(`/api/reservas/${body.reserva.id}/correo`)).status).toBe(200);
    expect((await request(app).get(`/api/reservas/${body.reserva.id}/correo`)).status).toBe(401);
    expect((await admin.get("/api/reservas/no-existe/correo")).status).toBe(404);
  });
});
