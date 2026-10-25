import { z } from "zod";
import { CIELOS } from "./meteorologo.ts";
import { MENSAJES_AL_DIA, MENSAJES_CADA_10_MINUTOS, MENSAJES_DEL_CLUB_AL_DIA } from "./rutas/asistente.ts";
import { MAXIMO_RESERVAS_ACTIVAS } from "./servicios/reservas.ts";
import { MAXIMO_CARACTERES_POR_MENSAJE, MENSAJES_QUE_SE_MANDAN } from "./validacion/asistente.ts";
import { esquemaLogin, esquemaRegistro } from "./validacion/auth.ts";
import { esquemaEditarRecurso, esquemaNuevoRecurso } from "./validacion/recursos.ts";
import { esquemaNuevaReserva } from "./validacion/reservas.ts";

// La documentación de la API en formato OpenAPI. app.ts la muestra en /docs con Swagger UI,
// una página donde se puede leer cada ruta y probarla desde el navegador.
//
// Los cuerpos de los pedidos salen de los mismos esquemas de Zod que validan la API,
// así la documentación no puede quedar distinta a lo que la API acepta de verdad.

// Convierte un esquema de Zod a JSON Schema (el formato que usa OpenAPI).
// "input" describe lo que se manda, antes de que Zod lo transforme (por ejemplo, "inicio" es un texto y no un Date).
function desdeZod(esquema: z.ZodType) {
  const json = z.toJSONSchema(esquema, {
    io: "input",
    // Si el campo ya dice su formato (date-time, date), la expresión regular que agrega Zod no aporta nada al leerla
    override: ({ jsonSchema }) => {
      if (jsonSchema.format) delete jsonSchema.pattern;
    },
  });
  delete json.$schema; // la versión de JSON Schema ya la dice OpenAPI
  return json;
}

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });

function respuestaJson(descripcion: string, schema: object) {
  return { description: descripcion, content: { "application/json": { schema } } };
}

const error = (descripcion: string) => respuestaJson(descripcion, ref("Error"));

function cuerpoJson(esquema: z.ZodType, ejemplo: object) {
  return { required: true, content: { "application/json": { schema: desdeZod(esquema), example: ejemplo } } };
}

const conSesion = [{ cookieSesion: [] }];

const parametroFecha = {
  name: "fecha",
  in: "query",
  required: true,
  description: "Día en la hora del club, con el formato AAAA-MM-DD",
  schema: { type: "string", format: "date", example: "2026-10-25" },
};

const parametroId = (descripcion: string) => ({
  name: "id",
  in: "path",
  required: true,
  description: descripcion,
  schema: { type: "string", format: "uuid" },
});

const id = { type: "string", format: "uuid" };
const fechaHora = { type: "string", format: "date-time", description: "En UTC" };
const pesos = { type: "integer", description: "Pesos chilenos", example: 16000 };

const esquemas = {
  Error: {
    type: "object",
    properties: {
      error: { type: "string", example: "Tienes que iniciar sesión" },
      detalles: {
        type: "object",
        description: "Solo en los errores 400: los problemas de cada campo",
        additionalProperties: { type: "array", items: { type: "string" } },
        example: { email: ["El email no es válido"] },
      },
    },
    required: ["error"],
  },
  Usuario: {
    type: "object",
    properties: {
      id,
      nombre: { type: "string", example: "Invitado 4F2A" },
      email: { type: "string", format: "email" },
      rol: { type: "string", enum: ["ADMIN", "CLIENTE"] },
    },
    required: ["id", "nombre", "email", "rol"],
  },
  Cancha: {
    type: "object",
    properties: { id, nombre: { type: "string", example: "Cancha 1" } },
    required: ["id", "nombre"],
  },
  CanchaAdmin: {
    type: "object",
    properties: { id, nombre: { type: "string", example: "Cancha 1" }, activo: { type: "boolean" } },
    required: ["id", "nombre", "activo"],
  },
  EstadoBloque: {
    type: "string",
    enum: ["libre", "ocupado", "mio", "pasado"],
    description: "Cómo ve el bloque quien pregunta. Sin sesión, ningún bloque es \"mio\". Un bloque que ya empezó es \"pasado\".",
  },
  Bloque: {
    type: "object",
    properties: {
      inicio: fechaHora,
      fin: fechaHora,
      hora: { type: "string", example: "19:00", description: "En la hora del club" },
      estado: ref("EstadoBloque"),
      precio: pesos,
    },
    required: ["inicio", "fin", "hora", "estado", "precio"],
  },
  HoraDelPronostico: {
    type: "object",
    properties: {
      hora: { type: "string", example: "19:00", description: "En la hora del club. El tiempo es el de cuando empieza esa hora." },
      grados: { type: "integer", example: 18, description: "Temperatura en °C" },
      cielo: { type: "string", enum: [...CIELOS], example: "lluvia-ligera" },
      descripcion: { type: "string", example: "lluvia ligera", description: "El cielo en palabras" },
      deNoche: { type: "boolean", description: "Si a esa hora ya es de noche (para elegir el ícono)" },
    },
    required: ["hora", "grados", "cielo", "descripcion", "deNoche"],
  },
  HoraDelClub: {
    type: "object",
    properties: {
      inicio: fechaHora,
      fin: fechaHora,
      hora: { type: "string", example: "19:00", description: "En la hora del club" },
      precio: pesos,
      canchas: {
        type: "array",
        description: "Las canchas activas, cada una con su estado a esa hora",
        items: {
          type: "object",
          properties: { id, nombre: { type: "string", example: "Cancha 1" }, estado: ref("EstadoBloque") },
          required: ["id", "nombre", "estado"],
        },
      },
    },
    required: ["inicio", "fin", "hora", "precio", "canchas"],
  },
  Reserva: {
    type: "object",
    properties: {
      id,
      inicio: fechaHora,
      fin: fechaHora,
      estado: { type: "string", enum: ["CONFIRMADA", "CANCELADA"] },
      precio: { ...pesos, description: "Lo que costó, guardado al reservar" },
      recurso: ref("Cancha"),
    },
    required: ["id", "inicio", "fin", "estado", "precio", "recurso"],
  },
  ReservaAdmin: {
    allOf: [
      ref("Reserva"),
      {
        type: "object",
        properties: {
          usuario: {
            type: "object",
            properties: { id, nombre: { type: "string" }, email: { type: "string", format: "email" } },
            required: ["id", "nombre", "email"],
          },
        },
        required: ["usuario"],
      },
    ],
  },
  Horario: {
    type: "object",
    properties: {
      zonaHoraria: { type: "string", example: "America/Santiago" },
      horaApertura: { type: "integer", example: 8 },
      horaCierre: { type: "integer", example: 23 },
      dias: {
        type: "array",
        description: "Los 7 días que se pueden reservar, desde hoy",
        items: { type: "string", format: "date" },
      },
      tarifa: {
        type: "object",
        properties: {
          precioNormal: { ...pesos, example: 12000 },
          precioPunta: { ...pesos, example: 16000 },
          inicioPuntaEntreSemana: {
            type: "integer",
            example: 18,
            description: "De lunes a viernes, la hora punta empieza a esta hora. El fin de semana es todo el día.",
          },
        },
        required: ["precioNormal", "precioPunta", "inicioPuntaEntreSemana"],
      },
    },
    required: ["zonaHoraria", "horaApertura", "horaCierre", "dias", "tarifa"],
  },
  Resumen: {
    type: "object",
    properties: {
      fecha: { type: "string", format: "date" },
      dia: {
        type: "object",
        properties: {
          reservas: { type: "integer" },
          ingresos: pesos,
          horasDelDia: { type: "integer", description: "Canchas activas × horas que abre el club" },
          ocupacion: { type: "number", minimum: 0, maximum: 1, example: 0.37 },
        },
        required: ["reservas", "ingresos", "horasDelDia", "ocupacion"],
      },
      semana: {
        type: "object",
        description: "De lunes a domingo, la semana del día pedido",
        properties: {
          desde: { type: "string", format: "date" },
          hasta: { type: "string", format: "date" },
          reservas: { type: "integer" },
          ingresos: pesos,
        },
        required: ["desde", "hasta", "reservas", "ingresos"],
      },
      horaMasPedida: {
        description: "En los 30 días que terminan ese día, o null si no hubo reservas",
        oneOf: [
          {
            type: "object",
            properties: { hora: { type: "string", example: "19:00" }, reservas: { type: "integer" } },
            required: ["hora", "reservas"],
          },
          { type: "null" },
        ],
      },
    },
    required: ["fecha", "dia", "semana", "horaMasPedida"],
  },
  MensajeDelChat: {
    type: "object",
    description: "Un mensaje de la conversación, con el formato de los mensajes del AI SDK (UIMessage)",
    properties: {
      id: { type: "string" },
      role: { type: "string", enum: ["user", "assistant"] },
      parts: {
        type: "array",
        description:
          "Las partes del mensaje, en orden: `text` (lo que se escribió) y, en las respuestas del asistente, `step-start` y `tool-<herramienta>` (cada herramienta que usó, con lo que pidió y lo que recibió)",
        items: { type: "object", properties: { type: { type: "string", example: "text" } }, required: ["type"] },
      },
    },
    required: ["id", "role", "parts"],
  },
  ErrorDelAsistente: {
    type: "object",
    properties: {
      error: { type: "string", example: "El asistente está descansando. Mientras tanto, puedes reservar en la grilla." },
      cerrarElChat: {
        type: "boolean",
        description: "true si el asistente no va a poder responder por un buen rato: la página cierra el chat y ofrece la grilla",
      },
    },
    required: ["error"],
  },
  Correo: {
    type: "object",
    properties: {
      para: { type: "string", format: "email" },
      asunto: { type: "string", example: "Reserva confirmada: Cancha 1, sábado 25 de octubre a las 19:00" },
      html: { type: "string", description: "El correo tal como se envía" },
      seEnvia: { type: "boolean", description: "false si el correo es de example.com (jugadores demo): a esos no se les envía" },
    },
    required: ["para", "asunto", "html", "seEnvia"],
  },
};

export const documentacion = {
  openapi: "3.1.0",
  info: {
    title: "API de Volea",
    version: "1.0.0",
    description: [
      "Reservas de canchas para Volea, un club de pádel ficticio (es un demo de portafolio).",
      "",
      "**Cómo probar las rutas con sesión:** abre **POST /api/auth/invitado**, toca *Try it out* y *Execute*.",
      "La API deja la cookie de sesión en tu navegador, y desde ahí las demás rutas la mandan solas.",
      "Para las rutas de admin, usa **POST /api/auth/login** con `admin@example.com` y `demo1234`.",
      "",
      "Las fechas viajan en UTC; los días y las horas (por ejemplo `\"hora\": \"19:00\"`) están en la hora del club, `America/Santiago`.",
      "Los avisos en vivo van por Socket.io y no aparecen aquí: están explicados en el README del repo.",
    ].join("\n"),
    license: { name: "MIT" },
  },
  // Rutas relativas: los pedidos van al mismo sitio donde está abierta la documentación
  servers: [{ url: "/" }],
  tags: [
    { name: "Sesión", description: "Registro, login y jugadores invitados" },
    { name: "Horarios", description: "Las canchas, sus horarios libres y los precios. Se ven sin iniciar sesión." },
    { name: "Pronóstico", description: "El tiempo en Santiago a cada hora del club. Datos de MET Norway (licencia CC BY 4.0)." },
    { name: "Reservas", description: "Reservar y cancelar (jugadores)" },
    { name: "Admin", description: "El panel del dueño del club (solo ADMIN)" },
    { name: "Asistente", description: "El chat con IA: responde preguntas del club y reserva con la confirmación de la persona" },
  ],
  paths: {
    "/api/salud": {
      get: {
        tags: ["Horarios"],
        summary: "Revisa que la API esté funcionando",
        description: "No consulta la base de datos. La usa el servicio que visita la API cada 5 minutos para que no se duerma.",
        responses: { 200: respuestaJson("La API está viva", { type: "object", properties: { estado: { const: "ok" } } }) },
      },
    },
    "/api/auth/registro": {
      post: {
        tags: ["Sesión"],
        summary: "Crea una cuenta de jugador e inicia sesión",
        description: "Siempre crea un CLIENTE: si se manda un rol, se ignora. El email se guarda en minúsculas.",
        requestBody: cuerpoJson(esquemaRegistro, { nombre: "Ana Pérez", email: "ana@example.com", password: "clave-segura" }),
        responses: {
          201: respuestaJson("Cuenta creada. La respuesta trae la cookie de sesión.", {
            type: "object",
            properties: { usuario: ref("Usuario") },
          }),
          400: error("Faltan datos o no son válidos"),
          409: error("Ya existe una cuenta con ese email"),
          429: error("Demasiados intentos: 20 cada 15 minutos por visitante"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Sesión"],
        summary: "Inicia sesión",
        description: "Responde lo mismo si el email no existe o si la contraseña está mal, para no dar pistas.",
        requestBody: cuerpoJson(esquemaLogin, { email: "admin@example.com", password: "demo1234" }),
        responses: {
          200: respuestaJson("Sesión iniciada. La respuesta trae la cookie de sesión.", {
            type: "object",
            properties: { usuario: ref("Usuario") },
          }),
          400: error("Faltan datos"),
          401: error("Email o contraseña incorrectos"),
          429: error("Demasiados intentos: 20 cada 15 minutos por visitante"),
        },
      },
    },
    "/api/auth/invitado": {
      post: {
        tags: ["Sesión"],
        summary: "Entra como un jugador invitado nuevo",
        description: "Crea un jugador solo para quien lo pide (\"Invitado 4F2A\") con la sesión iniciada. Los invitados se borran al día siguiente.",
        responses: {
          201: respuestaJson("Invitado creado. La respuesta trae la cookie de sesión.", {
            type: "object",
            properties: { usuario: ref("Usuario") },
          }),
          429: error("Demasiados intentos: 20 cada 15 minutos por visitante"),
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Sesión"],
        summary: "Cierra la sesión",
        description: "No pide sesión, así también sirve para borrar una cookie vencida.",
        responses: { 204: { description: "Listo: la cookie se borró" } },
      },
    },
    "/api/auth/yo": {
      get: {
        tags: ["Sesión"],
        summary: "Quién inició sesión",
        description: "Sin sesión responde 200 con `usuario: null`: no haber entrado no es un error.",
        responses: {
          200: respuestaJson("El usuario de la sesión, o null", {
            type: "object",
            properties: { usuario: { oneOf: [ref("Usuario"), { type: "null" }] } },
          }),
        },
      },
    },
    "/api/horario": {
      get: {
        tags: ["Horarios"],
        summary: "El horario del club, los días que se pueden reservar y la tarifa",
        description: "Qué día es \"hoy\" lo decide el servidor, en la hora del club.",
        responses: { 200: respuestaJson("El horario", ref("Horario")) },
      },
    },
    "/api/recursos": {
      get: {
        tags: ["Horarios"],
        summary: "Las canchas que se pueden reservar",
        responses: {
          200: respuestaJson("Las canchas activas", {
            type: "object",
            properties: { recursos: { type: "array", items: ref("Cancha") } },
          }),
        },
      },
    },
    "/api/recursos/{id}/disponibilidad": {
      get: {
        tags: ["Horarios"],
        summary: "Los horarios de una cancha en un día",
        description: "Cada bloque de 1 hora, de 08:00 a 22:00, con su estado y su precio. Con sesión, marca las reservas propias como \"mio\".",
        parameters: [parametroId("La cancha"), parametroFecha],
        responses: {
          200: respuestaJson("Los bloques del día", {
            type: "object",
            properties: { fecha: { type: "string", format: "date" }, bloques: { type: "array", items: ref("Bloque") } },
          }),
          400: error("La fecha falta, está mal escrita o queda fuera de los próximos 7 días"),
          404: error("La cancha no existe o está desactivada"),
        },
      },
    },
    "/api/disponibilidad": {
      get: {
        tags: ["Horarios"],
        summary: "Todo el club en un día, hora por hora",
        description: "Para cada hora: su precio y cómo está cada cancha activa. Sirve para responder \"¿hay cancha el sábado a las 19:00?\".",
        parameters: [parametroFecha],
        responses: {
          200: respuestaJson("Las horas del día", {
            type: "object",
            properties: { fecha: { type: "string", format: "date" }, horas: { type: "array", items: ref("HoraDelClub") } },
          }),
          400: error("La fecha falta, está mal escrita o queda fuera de los próximos 7 días"),
        },
      },
    },
    "/api/pronostico": {
      get: {
        tags: ["Pronóstico"],
        summary: "El pronóstico del tiempo de un día, hora por hora",
        description: [
          "La temperatura y el cielo a cada hora del club, con datos de MET Norway (el instituto de meteorología de Noruega).",
          "Las canchas son techadas: sirve para saber qué llevar y cómo llegar.",
          "Hora por hora en los próximos 2 o 3 días y en bloques de 6 horas después. La API guarda el pronóstico unos 30 minutos.",
          "Las horas que ya terminaron no vienen.",
        ].join("\n"),
        parameters: [parametroFecha],
        responses: {
          200: respuestaJson("El pronóstico del día", {
            type: "object",
            properties: { fecha: { type: "string", format: "date" }, horas: { type: "array", items: ref("HoraDelPronostico") } },
          }),
          400: error("La fecha falta, está mal escrita o queda fuera de los próximos 7 días"),
          503: error("El servicio del pronóstico no responde"),
        },
      },
    },
    "/api/reservas": {
      post: {
        tags: ["Reservas"],
        summary: "Reserva un horario",
        description: `Solo jugadores. \`inicio\` es el de un bloque de la disponibilidad. Cada jugador puede tener como máximo ${MAXIMO_RESERVAS_ACTIVAS} reservas activas. Si dos personas reservan lo mismo a la vez, una recibe 201 y la otra 409. Al reservar se envía un correo de confirmación.`,
        security: conSesion,
        requestBody: cuerpoJson(esquemaNuevaReserva, { recursoId: "id de una cancha de GET /api/recursos", inicio: "2026-10-25T22:00:00.000Z" }),
        responses: {
          201: respuestaJson("Reserva hecha", { type: "object", properties: { reserva: ref("Reserva") } }),
          400: error("El horario no existe, ya pasó o queda fuera de los próximos 7 días"),
          401: error("Falta iniciar sesión"),
          403: error("Los admins no reservan"),
          404: error("La cancha no existe"),
          409: error(`El horario ya está reservado, o ya tienes ${MAXIMO_RESERVAS_ACTIVAS} reservas activas`),
        },
      },
    },
    "/api/reservas/mias": {
      get: {
        tags: ["Reservas"],
        summary: "Mis próximas reservas",
        security: conSesion,
        responses: {
          200: respuestaJson("Las reservas confirmadas que todavía no terminan", {
            type: "object",
            properties: { reservas: { type: "array", items: ref("Reserva") } },
          }),
          401: error("Falta iniciar sesión"),
          403: error("Solo jugadores"),
        },
      },
    },
    "/api/reservas/{id}/correo": {
      get: {
        tags: ["Reservas"],
        summary: "El correo de confirmación de una reserva",
        description: "Para mostrarlo en la página. Lo puede ver el dueño de la reserva o un admin.",
        security: conSesion,
        parameters: [parametroId("La reserva")],
        responses: {
          200: respuestaJson("El correo", ref("Correo")),
          401: error("Falta iniciar sesión"),
          403: error("La reserva es de otra persona"),
          404: error("La reserva no existe"),
        },
      },
    },
    "/api/reservas/{id}": {
      delete: {
        tags: ["Reservas"],
        summary: "Cancela una reserva",
        description: "La puede cancelar su dueño o un admin, antes de que empiece. La reserva no se borra: queda como CANCELADA y el horario se libera.",
        security: conSesion,
        parameters: [parametroId("La reserva")],
        responses: {
          204: { description: "Reserva cancelada" },
          400: error("La reserva ya empezó"),
          401: error("Falta iniciar sesión"),
          403: error("La reserva es de otra persona"),
          404: error("La reserva no existe"),
          409: error("La reserva ya estaba cancelada"),
        },
      },
    },
    "/api/admin/reservas": {
      get: {
        tags: ["Admin"],
        summary: "Todas las reservas de un día",
        description: "Confirmadas y canceladas, de todas las canchas, con el jugador. Acepta cualquier fecha, también días pasados.",
        security: conSesion,
        parameters: [parametroFecha],
        responses: {
          200: respuestaJson("Las reservas del día", {
            type: "object",
            properties: { fecha: { type: "string", format: "date" }, reservas: { type: "array", items: ref("ReservaAdmin") } },
          }),
          401: error("Falta iniciar sesión"),
          403: error("Solo admins"),
        },
      },
    },
    "/api/admin/resumen": {
      get: {
        tags: ["Admin"],
        summary: "Los números del día para el dueño",
        description: "Ocupación, reservas e ingresos del día y de su semana, y la hora más pedida de los últimos 30 días.",
        security: conSesion,
        parameters: [parametroFecha],
        responses: {
          200: respuestaJson("El resumen", ref("Resumen")),
          401: error("Falta iniciar sesión"),
          403: error("Solo admins"),
        },
      },
    },
    "/api/admin/recursos": {
      get: {
        tags: ["Admin"],
        summary: "Todas las canchas, también las desactivadas",
        security: conSesion,
        responses: {
          200: respuestaJson("Las canchas", {
            type: "object",
            properties: { recursos: { type: "array", items: ref("CanchaAdmin") } },
          }),
          401: error("Falta iniciar sesión"),
          403: error("Solo admins"),
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Crea una cancha",
        security: conSesion,
        requestBody: cuerpoJson(esquemaNuevoRecurso, { nombre: "Cancha 5" }),
        responses: {
          201: respuestaJson("Cancha creada", { type: "object", properties: { recurso: ref("CanchaAdmin") } }),
          400: error("Falta el nombre o es muy largo"),
          401: error("Falta iniciar sesión"),
          403: error("Solo admins"),
          409: error("Ya existe una cancha con ese nombre"),
        },
      },
    },
    "/api/admin/recursos/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Cambia el nombre de una cancha, o la activa y desactiva",
        description: "Se manda solo lo que cambia. Las canchas no se borran: una desactivada deja de recibir reservas nuevas, y sus reservas siguen valiendo.",
        security: conSesion,
        parameters: [parametroId("La cancha")],
        requestBody: cuerpoJson(esquemaEditarRecurso, { activo: false }),
        responses: {
          200: respuestaJson("Cancha actualizada", { type: "object", properties: { recurso: ref("CanchaAdmin") } }),
          400: error("Los datos no son válidos"),
          401: error("Falta iniciar sesión"),
          403: error("Solo admins"),
          404: error("La cancha no existe"),
          409: error("Ya existe una cancha con ese nombre"),
        },
      },
    },
    "/api/asistente": {
      post: {
        tags: ["Asistente"],
        summary: "Le escribe al asistente de IA y recibe la respuesta de a poco",
        description: [
          `La página guarda la conversación y la manda completa en cada mensaje (la API usa los últimos ${MENSAJES_QUE_SE_MANDAN}), así la API no guarda nada.`,
          "La respuesta llega de a poco (*streaming*), con el protocolo de mensajes del AI SDK: una línea `data: {...}` por evento.",
          "",
          "El asistente usa herramientas: `verHorariosLibres`, `buscarInformacion` (los documentos del club), `verPronostico` (el tiempo en Santiago), `reservar`, `verMisReservas` y `cancelarReserva`.",
          "**Reservar y cancelar esperan a la persona:** la respuesta termina con un evento `tool-approval-request`, y para confirmar se vuelve a mandar",
          "la conversación con esa parte en el estado `approval-responded` (`approved: true`). Antes de pedir la confirmación, la API revisa que se pueda hacer;",
          "si no, la rechaza sola y el asistente explica por qué.",
          "",
          "Se puede usar sin iniciar sesión. Con sesión, el asistente ve las reservas propias y reserva a nombre de quien conversa.",
          `Límites: ${MAXIMO_CARACTERES_POR_MENSAJE} caracteres por mensaje, ${MENSAJES_CADA_10_MINUTOS} mensajes cada 10 minutos y ${MENSAJES_AL_DIA} al día por visitante,`,
          `y ${MENSAJES_DEL_CLUB_AL_DIA} al día entre todos (la cuota gratis de la IA).`,
          "",
          "En esta página, *Try it out* muestra la respuesta completa al final, no de a poco.",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { messages: { type: "array", items: ref("MensajeDelChat") } },
                required: ["messages"],
              },
              example: { messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "¿Hay cancha mañana después de las 7?" }] }] },
            },
          },
        },
        responses: {
          200: {
            description: "La respuesta, evento por evento (cabecera `x-vercel-ai-ui-message-stream: v1`)",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
                example: [
                  '{"type":"start"}',
                  '{"type":"start-step"}',
                  '{"type":"tool-input-available","toolCallId":"call_1","toolName":"verHorariosLibres","input":{"fecha":"2026-10-26","desde":19}}',
                  '{"type":"tool-output-available","toolCallId":"call_1","output":{"horas":[{"hora":"19:00","precio":16000,"canchas":["Cancha 2","Cancha 4"]}],"tusReservas":[]}}',
                  '{"type":"finish-step"}',
                  '{"type":"start-step"}',
                  '{"type":"text-start","id":"t1"}',
                  '{"type":"text-delta","id":"t1","delta":"Mañana hay libres a las 19:00, "}',
                  '{"type":"text-delta","id":"t1","delta":"a $16.000 por ser hora punta."}',
                  '{"type":"text-end","id":"t1"}',
                  '{"type":"finish-step"}',
                  '{"type":"finish","finishReason":"stop"}',
                  "[DONE]",
                ]
                  .map((evento) => `data: ${evento}`)
                  .join("\n\n"),
              },
            },
          },
          400: error(
            `La conversación no tiene el formato esperado, trae instrucciones (\`system\`), partes que el asistente no conoce o un mensaje de más de ${MAXIMO_CARACTERES_POR_MENSAJE} caracteres`,
          ),
          429: {
            description: `Demasiados mensajes: ${MENSAJES_CADA_10_MINUTOS} cada 10 minutos o ${MENSAJES_AL_DIA} al día por visitante (el del día trae \`cerrarElChat\`)`,
            content: {
              "application/json": {
                schema: ref("ErrorDelAsistente"),
                example: { error: "Le escribiste muchos mensajes seguidos al asistente. Espera unos minutos y vuelve a probar." },
              },
            },
          },
          503: respuestaJson(
            "El asistente no puede responder: la IA no está configurada, todos los modelos se quedaron sin cuota o el club llegó al máximo de mensajes del día",
            ref("ErrorDelAsistente"),
          ),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieSesion: {
        type: "apiKey",
        in: "cookie",
        name: "sesion",
        description: "La cookie que dejan el registro, el login y el invitado. Es httpOnly: el navegador la manda solo.",
      },
    },
    schemas: esquemas,
  },
};
