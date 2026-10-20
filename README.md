# Volea · Reserva de canchas en tiempo real

[![Estado del CI](https://github.com/Vitomans/agenda-reservas/actions/workflows/ci.yml/badge.svg)](https://github.com/Vitomans/agenda-reservas/actions/workflows/ci.yml)

Una app de reservas para un club de pádel ficticio. Cualquiera ve los horarios libres sin iniciar sesión, por cancha o por hora ("¿A qué hora quieres jugar?"), con su precio. Al reservar, quien no tiene cuenta entra como invitado en el mismo paso, y a los jugadores registrados les llega un correo de confirmación. Cuando alguien reserva, el horario aparece ocupado al instante en la pantalla de todos los demás, sin recargar la página. Los administradores ven el club de un vistazo (un tablero con todas las canchas, la ocupación, los ingresos y la hora más pedida) y manejan todas las reservas.

**Demo en vivo: [volea-reservas.vercel.app](https://volea-reservas.vercel.app)**. Los horarios se ven sin entrar: elige una hora y toca **Reservar como invitado** (se crea una cuenta nueva solo para ti). Para ver el panel del dueño, entra con **Admin demo**. El club tiene **socios simulados**: mientras miras una cancha, reservan y cancelan horas, así que vas a ver cambiar la grilla sola. También puedes abrir la demo en dos pantallas, por ejemplo en el celular y en el computador, y reservar tú.

**Documentación de la API: [volea-reservas.vercel.app/docs](https://volea-reservas.vercel.app/docs)**, con Swagger UI, para leer cada ruta y probarla desde el navegador.

![Dos jugadores en la misma cancha: la segunda pantalla se actualiza sola](docs/demo.gif)

*Dos jugadores miran la misma cancha. El jugador 1 reserva las 17:00 y en la pantalla del jugador 2 aparece ocupada al instante. Después los dos eligen las 18:00, el jugador 1 la reserva primero y al jugador 2 se le avisa en el momento.*

## Tecnologías

- **API:** Node.js, Express 5 y TypeScript
- **Base de datos:** PostgreSQL con Prisma ORM (migraciones y datos de ejemplo)
- **Sesión:** JWT en una cookie httpOnly, contraseñas guardadas con bcrypt
- **Seguridad:** helmet, CORS y límite de intentos en el login
- **Validación:** Zod
- **Documentación de la API:** OpenAPI 3.1 con Swagger UI, armada desde los esquemas de Zod
- **Tiempo real:** Socket.io
- **Correos:** API de Brevo, con el evento para el calendario (.ics) adjunto
- **Fechas y zonas horarias:** Luxon
- **Web:** Next.js 16 (App Router), React 19, Tailwind CSS 4 y TanStack Query
- **Tests:** Vitest, Supertest, Testing Library y Playwright (e2e)
- **Herramientas:** Docker Compose para la base de datos local y GitHub Actions para el CI
- **Publicación:** Vercel (web), Render (API), Neon (PostgreSQL) y UptimeRobot, todo en planes gratis

## Arquitectura

```mermaid
flowchart LR
    browser["Navegador<br/>React + TanStack Query"]
    next["Servidor de Next.js · Vercel<br/>proxy.ts: /api y /docs"]
    subgraph apiServer["Servidor de la API · Node.js en Render"]
        express["Express<br/>API REST"]
        socket["Socket.io"]
    end
    db[("PostgreSQL · Neon")]

    browser -->|"HTTP /api/... con la cookie de sesión"| next
    next -->|"+ clave de la página e IP del visitante"| express
    express -->|Prisma| db
    express -->|"reserva creada o cancelada"| socket
    socket -.->|"eventos en vivo · WebSocket"| browser
```

1. La página llama a `/api/...` en su mismo sitio, y el puente de Next.js (`proxy.ts`) le pasa la petición a Express, con la clave de la página y la IP del visitante.
2. Express revisa la clave y la sesión, y valida los datos con Zod. Después aplica las reglas de las reservas y guarda en PostgreSQL con Prisma.
3. Cuando se crea o se cancela una reserva, Express le avisa a Socket.io, que avisa a los navegadores que están mirando esa cancha.
4. Esos navegadores vuelven a pedir los horarios a la API REST.

## Estructura del proyecto

```
agenda-reservas/
├── api/                  ← API REST (Express + Prisma)
│   ├── prisma/           ← esquema de la base de datos, migraciones y datos de ejemplo
│   ├── src/
│   └── tests/
├── web/                  ← frontend (Next.js)
│   ├── app/              ← páginas: reservar, mis-reservas, admin, login y registro, y la imagen para compartir
│   ├── components/
│   ├── lib/              ← cliente de la API, hooks de datos, hook de tiempo real y funciones de fechas
│   ├── proxy.ts          ← el puente que le pasa a la API lo que la página pide en /api y /docs
│   └── tests/            ← tests de Vitest, y en tests/e2e los de Playwright
├── docs/                 ← el GIF del demo
├── docker-compose.yml    ← PostgreSQL local
└── render.yaml           ← configuración de la API publicada en Render
```

## Cómo correrlo en local

Necesitas Node.js 24 (ver `.nvmrc`) y Docker.

```bash
# 1. Levanta PostgreSQL
docker compose up -d

# 2. Prepara la API
cd api
cp .env.example .env   # después pon en JWT_SECRET un valor largo y al azar
npm install
npm run db:migrar    # crea las tablas
npm run db:seed      # agrega usuarios y canchas de ejemplo

# 3. Levanta la API
npm run dev

# 4. En otra terminal, levanta la web
cd web
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y usa los botones **Jugador demo** o **Admin demo**. La API corre en [http://localhost:4000](http://localhost:4000).

En local los correos no se envían: la API los anota en su consola. Para enviarlos de verdad, pon una clave de Brevo en `BREVO_API_KEY` y un remitente confirmado en `CORREO_REMITENTE` (ver `api/.env.example`).

La web le pasa a la API cada petición a `/api/...` y a `/docs` (el puente de `web/proxy.ts`). Para el navegador, la API está en el mismo sitio que la página, así que la cookie de sesión es propia (first-party) y no hay que lidiar con CORS. La conexión en tiempo real es la excepción: el puente no puede mantener una conexión abierta, así que Socket.io se conecta directo a la API. Si la API corre en otro lugar, pon `NEXT_PUBLIC_API_URL` en `web/.env.local`. En local no hace falta `CLAVE_DE_LA_WEB` (ver "Decisiones técnicas").

### Tests e2e

Los tests de Playwright levantan solos la API (sin socios simulados) y la web, así que antes hay que apagar las que estén corriendo. Necesitan PostgreSQL con las migraciones y el seed.

```bash
cd web
npx playwright install chromium   # solo la primera vez
npm run e2e
```

### Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@example.com` | `demo1234` |
| Jugador | `cliente@example.com` | `demo1234` |

El botón **Jugador demo** no usa la cuenta de jugador de la tabla: crea un jugador invitado nuevo para cada visitante (ver "Decisiones técnicas"). La cuenta de la tabla sirve para entrar escribiendo el email y la contraseña.

El seed también crea 12 **socios simulados** (`socio-01@socios.example.com` a `socio-12@socios.example.com`). Nadie conoce su contraseña: solo los usa el simulador del club.

## Rutas de la API

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/salud` | público | Revisa que la API esté funcionando |
| POST | `/api/auth/registro` | público | Crea una cuenta de jugador e inicia sesión |
| POST | `/api/auth/login` | público | Inicia sesión (deja la cookie de sesión) |
| POST | `/api/auth/invitado` | público | Crea un jugador invitado nuevo e inicia sesión (el botón "Jugador demo") |
| POST | `/api/auth/logout` | público | Cierra la sesión (borra la cookie de sesión) |
| GET | `/api/auth/yo` | público | Devuelve el usuario actual, o `null` si nadie entró |
| GET | `/api/horario` | público | El horario del club, los 7 días que se pueden reservar y la tarifa |
| GET | `/api/recursos` | público | Lista las canchas |
| GET | `/api/recursos/:id/disponibilidad?fecha=YYYY-MM-DD` | público | Los horarios de una cancha en un día: libre, ocupado, pasado o (con sesión) mío |
| GET | `/api/disponibilidad?fecha=YYYY-MM-DD` | público | Todo el club en un día, hora por hora: el precio y cómo está cada cancha |
| POST | `/api/reservas` | jugador | Reserva un horario (`201`, o `409` si ya está ocupado) |
| GET | `/api/reservas/mias` | jugador | Mis próximas reservas |
| GET | `/api/reservas/:id/correo` | dueño o admin | El correo de confirmación de una reserva, para mostrarlo en la página |
| DELETE | `/api/reservas/:id` | dueño o admin | Cancela una reserva |
| GET | `/api/admin/reservas?fecha=YYYY-MM-DD` | admin | Todas las reservas de un día, de cualquier fecha |
| GET | `/api/admin/resumen?fecha=YYYY-MM-DD` | admin | La ocupación, las reservas y los ingresos del día y de su semana, y la hora más pedida de los últimos 30 días |
| GET | `/api/admin/recursos` | admin | Todas las canchas, también las desactivadas |
| POST | `/api/admin/recursos` | admin | Crea una cancha |
| PATCH | `/api/admin/recursos/:id` | admin | Cambia el nombre de una cancha o la activa y desactiva |
| GET | `/docs` | público | La documentación con Swagger UI (y el archivo OpenAPI en `/docs/openapi.json`) |

Las rutas que piden sesión responden `401` sin ella, y `403` con sesión pero sin el rol correcto. En la demo publicada, además, todo `/api` (menos `/api/salud`) responde `403` si el pedido no pasa por la página: hay que usarla en `volea-reservas.vercel.app`. Las canchas nunca se borran, solo se desactivan, así el historial de reservas queda completo.

Los errores siempre vuelven en JSON, por ejemplo `{ "error": "Email o contraseña incorrectos" }`. Los errores de validación (400) además traen `detalles`, con los problemas de cada campo.

## Reglas de las reservas

- Los horarios duran 1 hora y empiezan en punto, de 08:00 a 22:00 (hora del club, `America/Santiago`).
- Una hora cuesta $12.000, y $16.000 en hora punta (de lunes a viernes desde las 18:00, y todo el fin de semana). `GET /api/horario` entrega la tarifa, y cada horario de la disponibilidad trae su precio.
- Se puede reservar desde hoy hasta 6 días más adelante, pero nunca en el pasado.
- Una cancha no se puede reservar dos veces en el mismo horario. Si dos personas lo intentan al mismo tiempo, solo una lo consigue y la otra recibe un `409`.
- Cada jugador puede tener como máximo 2 reservas activas.
- Solo el dueño o un admin pueden cancelar una reserva, y solo antes de que empiece. Al cancelar, el registro se mantiene y el horario queda libre.

## Tiempo real

La API y Socket.io comparten un mismo servidor HTTP. Cuando se crea o se cancela una reserva, la API avisa a todos los navegadores que están mirando esa cancha, y cada uno vuelve a pedir sus horarios. Nadie tiene que recargar la página.

- Cada cancha tiene su propia **sala** de Socket.io (`recurso:<id>`). La página avisa qué canchas está mirando con `canchas:seguir`: en la vista por cancha se sigue la que está en pantalla, y en la vista por hora y en el panel de admin, todas.
- El servidor envía `reserva:creada` y `reserva:cancelada` con `{ recursoId, inicio }`. Nada más: en tiempo real no viajan nombres ni emails, así que el socket no necesita la cookie de sesión.
- En la página, un evento solo marca como desactualizados los datos de esa cancha, y TanStack Query los vuelve a pedir por la API normal. La API REST sigue siendo la única fuente de verdad.
- Si se corta la conexión, Socket.io se reconecta solo. Después la página vuelve a entrar a sus salas y actualiza todo, por si se perdió algún evento. Un pequeño indicador "En vivo" muestra si la conexión está activa.
- Cuando otra persona reserva o libera una hora de lo que estás mirando, aparece un aviso arriba ("Alguien acaba de reservar la Cancha 2 a las 19:00") y esa hora se resalta un momento. Para saber qué cambió, la página compara la grilla de antes con la nueva, así no te avisa lo que hiciste tú.
- Si escondes la pestaña, la página corta la conexión, y al volver se conecta y pide todo de nuevo. Una pestaña olvidada no mantiene trabajando al servidor.

## Cómo está publicada

Todo está en planes gratis:

| Parte | Dónde | Por qué ahí |
|---|---|---|
| Web (Next.js) | **Vercel** | Publica Next.js sin configurar nada, y cada push a `main` se publica solo. |
| API (Express + Socket.io) | **Render** | Socket.io necesita un servidor siempre encendido que mantenga las conexiones abiertas. Vercel corre funciones que se encienden, responden y se apagan, así que no sirve para la API. |
| Base de datos | **Neon** (PostgreSQL 17) | Se duerme sin uso, pero despierta sola en cuanto llega una consulta. Supabase pausa la base de datos después de 7 días sin actividad, y la PostgreSQL gratis de Render se borra a los 30 días. |
| Correos | **Brevo** | Envía hasta 300 correos al día gratis, sin tener un dominio propio. |
| Despertador | **UptimeRobot** | Render apaga la API después de 15 minutos sin visitas. UptimeRobot visita `/api/salud` cada 5 minutos para que no se duerma, y avisa por correo si la demo se cae. |

- **La configuración de Render está en el repo** (`render.yaml`), no solo en el panel de Render: cómo compilar, cómo arrancar, la región y las variables que hacen falta. Los secretos no van en el archivo. `DATABASE_URL` se escribe a mano en Render, y Render genera `JWT_SECRET`.
- **La página y la API comparten una clave** (`CLAVE_DE_LA_WEB`), escrita a mano en Vercel y en Render, nunca en el repo. Con ella, la API solo atiende los pedidos que pasan por la página (ver "Decisiones técnicas").
- **Los correos necesitan dos cosas en Render:** la clave `BREVO_API_KEY` (se escribe a mano) y el remitente `CORREO_REMITENTE`, que tiene que estar confirmado en Brevo. Sin la clave, la API funciona igual y los correos solo se anotan en su consola.
- **Las migraciones y el seed corren al final del build**, porque el plan gratis de Render no tiene "pre-deploy command". El seed se puede correr muchas veces sin duplicar nada (usa `upsert`).
- **Render publica solo si el CI pasó** (`autoDeployTrigger: checksPass`).
- **Las cuentas cuadran:** Render da 750 horas gratis al mes, y un mes tiene como máximo 744, así que alcanza para tener la API encendida siempre. `/api/salud` no consulta la base de datos, así que las visitas del despertador no despiertan a Neon y no gastan sus horas gratis de cómputo.
- **La API y la base de datos están en la misma zona** (Virginia, Estados Unidos), para que cada consulta tarde lo menos posible.
- Si el despertador fallara, la primera visita esperaría hasta un minuto a que la API despierte. Si la carga pasa de 5 segundos, la página explica por qué está tardando.

## Decisiones técnicas

**La base de datos bloquea las reservas dobles.** Un índice único parcial sobre `(recursoId, inicio)` (la cancha y la hora de inicio) solo cuenta las reservas confirmadas. La API no pregunta "¿está libre este horario?" antes de guardar: dos peticiones podrían recibir un "sí" al mismo tiempo. Simplemente intenta guardar, y la base de datos deja pasar solo una. La otra recibe un `409`. Las reservas canceladas no cuentan, así que cancelar libera el horario.

**El límite de 2 reservas se cumple aunque lleguen peticiones al mismo tiempo.** Contar las reservas activas del jugador y crear la nueva pasan en una sola transacción que bloquea la fila del jugador (`SELECT ... FOR UPDATE`). Si el mismo jugador envía varias peticiones a la vez, esperan en fila en vez de pasar todas la revisión. Un test envía peticiones en paralelo, y falla si se quita el bloqueo.

**La sesión va en una cookie httpOnly, en el mismo sitio que la página.** El JWT (HS256, válido por 1 día) va en una cookie `httpOnly` y `SameSite=Lax`, así los scripts de la página no lo pueden leer. La web llega a la API por el puente de Next.js (`proxy.ts`), así que la cookie es propia del sitio aunque la API esté en otro dominio. Eso importa porque Safari bloquea las cookies de terceros. También significa que la API REST no necesita CORS.

**401 y 403 significan cosas distintas.** `requiereSesion` responde "¿quién eres?" (`401`), y `soloRoles` responde "¿tienes permiso?" (`403`). El rol se lee del token, sin consultar la base de datos. La contra: si un admin cambia el rol de alguien, el cambio se aplica cuando vence su token.

**Cada reserva guarda lo que costó.** El precio se calcula al reservar y queda guardado en la reserva, en vez de calcularlo cada vez que se necesita. Si el club sube sus tarifas, las reservas que ya existían mantienen su precio y los ingresos del pasado no cambian. Al agregar la columna, la migración le calculó el precio a las reservas que ya existían, con SQL y en la hora del club, y se comprobó que coincidiera con el cálculo de la API en todas.

**La base de datos hace las cuentas del panel.** Los ingresos y las reservas se suman con `aggregate` de Prisma, y la hora más pedida se calcula con un `GROUP BY` en SQL. Así PostgreSQL agrupa y cuenta, y la API recibe solo el resultado, no cientos de reservas. Ojo con la zona horaria: `inicio` está guardado en UTC, así que antes de sacar la hora hay que pasarlo a la hora de Chile. Si no, las 19:00 de Chile aparecerían como las 22:00 o 23:00, y un test lo comprueba.

**Los correos no frenan las reservas.** La API responde primero y envía el correo después. Si Brevo tarda o falla, el jugador no espera, la reserva queda hecha igual y el error queda en el log del servidor. Igual que el avisador del tiempo real, el "cartero" que envía los correos se le pasa a la app desde afuera: en la demo publicada es el de Brevo, en local (sin clave) solo anota los correos en la consola y en los tests es uno falso que guarda lo que le pidieron enviar. Así los tests prueban qué correo se manda a quién sin enviar nada de verdad.

**Los correos solo van a direcciones reales, y con límite.** Los jugadores demo, los socios y los usuarios de los tests usan direcciones de `example.com`, un dominio reservado que no existe, así que a ellos no se les envía nada. Además, una misma dirección recibe como mucho 10 correos al día: si alguien se registra con el correo de otra persona y reserva y cancela muchas veces, no puede llenarle la bandeja.

**El HTML de los correos se trata con cuidado.** El nombre del jugador y el de la cancha los escriben los usuarios, así que se "escapan" antes de ponerlos en el HTML: si alguien se registra con el nombre `<script>`, el correo muestra ese texto en vez de tomarlo como código (un test lo comprueba). En la página, la vista previa del correo va dentro de un `iframe` con `sandbox` y sin `allow-scripts`, así ese HTML no puede ejecutar nada ni tocar la página. Solo puede abrir sus links, como el de Google Calendar, en otra pestaña.

**Las horas se guardan en UTC y se muestran en la hora del club.** Los días y los horarios se calculan en `America/Santiago` con Luxon. El servidor también decide qué día es "hoy" (`GET /api/horario`), así un reloj o una zona horaria mal configurados en el dispositivo del visitante no pueden cambiar las reglas de las reservas.

**Los eventos en tiempo real son solo una señal.** Un evento dice qué cancha y qué horario cambiaron, y nada más: ni nombres ni emails, así que el socket no necesita sesión. La página marca esos datos como desactualizados y TanStack Query los vuelve a pedir a la API REST, que sigue siendo la única fuente de verdad. No hay una segunda copia del estado que mantener sincronizada, y si se pierde un evento, se arregla volviendo a pedir todo al reconectarse.

**No se borra nada.** Cancelar una reserva cambia su estado, y las canchas se desactivan en vez de borrarse. El historial de reservas queda completo.

**Los tests usan un PostgreSQL de verdad.** Las reglas más importantes viven en la base de datos (el índice único y el bloqueo de fila), y una base de datos simulada las escondería. Los tests corren contra Docker en local y contra un servicio de PostgreSQL en el CI. Cada test crea su propia cancha y sus jugadores y los borra al final. `crearApp()` arma la app de Express sin abrir un puerto, así Supertest la puede usar directo. El "notificador" de tiempo real se le pasa a la app, así un test lo puede cambiar por uno falso.

**Los datos se revisan en la entrada.** Zod valida el cuerpo y los parámetros de cada petición, y también las variables de entorno al partir: si falta una, la API no parte y dice cuál falta.

**Cada visitante recibe su propio jugador demo.** Si todos compartieran una cuenta, cada visitante vería las reservas de los demás, y como un jugador puede tener solo 2 reservas activas, la cuenta se llenaría. El botón "Jugador demo" llama a `POST /api/auth/invitado`, que crea un jugador nuevo ("Invitado 4F2A") con la sesión iniciada. Para que la demo no se llene de datos viejos, cada vez que se crea un invitado se borran los que tienen más de un día, con sus reservas, sin necesidad de una tarea programada. Un invitado dura lo mismo que una sesión.

**El club tiene socios simulados, pero solo se mueven si alguien está mirando.** Una demo de reservas con todas las horas libres parece abandonada, y el tiempo real solo se notaba abriéndola en dos pantallas. Por eso cada día de la semana se llena con reservas de 12 socios simulados, con más gente en la tarde y la noche y en las mañanas del fin de semana, como en un club de verdad. Además, mientras alguien mira una cancha, cada 12 a 25 segundos un socio reserva o cancela una hora en ella, y la grilla de quien mira se actualiza en vivo. Los socios reservan más cuando la cancha tiene muchas horas libres y cancelan más cuando está casi llena, así no se llena ni se vacía con el tiempo. Nunca cancelan la reserva de un jugador, y el índice único les impide tomar una hora ya reservada. El simulador revisa en memoria qué canchas tienen a alguien mirando (las salas de Socket.io): si no hay nadie, no consulta la base de datos, porque Neon gratis tiene un límite de horas encendida al mes. Las reservas de los socios se guardan directo en la base de datos, sin pasar por las reglas de los jugadores, porque son datos de ejemplo. En un club de verdad se apaga con `SIMULAR_CLUB=false`.

**La API solo atiende los pedidos que pasan por la página.** El límite de intentos del login cuenta por IP, y antes la API leía esa IP de la cabecera `X-Forwarded-For`, confiando en los últimos 4 intermediarios (un número medido en la demo publicada). Revisándolo apareció un problema: esa cabecera se puede escribir a mano, y como la API también se podía llamar directo en Render, alguien podía inventar una IP distinta en cada intento y saltarse el límite. Ahora el puente de la página (`web/proxy.ts`) le agrega a cada pedido una clave que solo conocen la página y la API (`CLAVE_DE_LA_WEB`) y la IP del visitante, que saca de `x-real-ip`, una cabecera que pone Vercel y que el visitante no puede cambiar. La API rechaza con `403` todo lo que no traiga la clave, y solo en ese caso le cree a la IP. El puente borra esas dos cabeceras si el visitante las mandó escritas a mano, y la API compara la clave con `timingSafeEqual`, que tarda lo mismo aunque la clave esté casi bien, para no dar pistas. Hay tests para cada parte: en la API, en el puente y en los e2e.

**Los horarios se ven sin iniciar sesión.** Una página de reservas que empieza con un login espanta: primero quieres saber si hay hora. Las canchas y su disponibilidad usan `sesionOpcional`: si hay sesión, la grilla marca las reservas propias, y si no, igual se ve (solo dice libre u ocupado, nunca quién reservó). Al reservar, quien no entró toca **Reservar como invitado** y la página crea un jugador invitado y reserva en el mismo paso. De paso, `GET /api/auth/yo` responde `200` con `usuario: null` cuando nadie entró, en vez de `401`: no haber iniciado sesión es normal, no un error, y así la consola del navegador no muestra errores en rojo.

**Dos formas de buscar, un mismo concepto.** La vista por cancha muestra las horas de una cancha; la vista por hora ("¿A qué hora quieres jugar?") muestra cuántas canchas quedan libres a cada hora, con `GET /api/disponibilidad`, que entrega todo el club en una sola consulta (también le va a servir a un chatbot). En la página, las dos se pasan a "casillas": una casilla es una cancha a una hora. Así el resto funciona igual en las dos vistas: qué se eligió, si otra persona lo tomó mientras tanto y qué cambió en vivo.

**La documentación sale del mismo código que valida.** `/docs` muestra la API con Swagger UI. Los cuerpos de los pedidos no se escriben a mano: se generan desde los mismos esquemas de Zod que validan la API (`z.toJSONSchema`), así no pueden quedar distintos. Un test llama a cada ruta documentada y comprueba que exista. La documentación también pasa por el puente de la página, así que "Try it out" funciona en la demo publicada.

## Tests y CI

- **API:** 100 tests con Vitest y Supertest: sesión, jugadores invitados, la clave de la página y el límite de intentos por visitante, reglas de las reservas (incluido dos personas reservando el mismo horario), roles y permisos, eventos en tiempo real con clientes de Socket.io de verdad y los socios simulados (que nunca cancelan la reserva de un jugador y que no hacen nada si nadie mira), los precios, la disponibilidad de todo el club, el resumen del panel de admin, los correos (qué se envía a quién, el HTML escapado, el envío a Brevo con un `fetch` falso y el límite diario) y la documentación.
- **Web:** 61 tests con Vitest y Testing Library: el cliente de la API, el puente a la API (`proxy.ts`), las funciones de fechas y de pesos, la grilla por cancha y la grilla por hora, la barra para reservar (con y sin sesión), el selector de canchas, el tablero y las tarjetas del panel de admin, la vista previa del correo, el formulario de login, el aviso de carga lenta, el hook de tiempo real (también con la pestaña escondida) y los avisos de lo que cambió en vivo.
- **E2E:** 7 tests con Playwright que recorren la app completa (PostgreSQL, la API y la página), en una pantalla de escritorio y en un celular chico: reservar sin entrar como invitado, la vista por hora, el tiempo real entre dos navegadores, Mis reservas con el correo y la cancelación, el panel de admin, la documentación y que la API rechace los pedidos que no pasan por la página.
- **CI:** GitHub Actions corre lint, tipos, tests y build de los dos proyectos en cada push, y los e2e en un tercer trabajo. Los trabajos de la API y de los e2e levantan su propio PostgreSQL.

## Limitaciones conocidas

- Los jugadores invitados y sus reservas se borran al día siguiente. El "Admin demo" sí es una cuenta compartida, así que cualquier visitante puede cancelar reservas desde el panel de admin.
- La API usa planes gratis: si el despertador fallara, la primera visita tardaría hasta un minuto.
- No hay refresh tokens: la sesión dura 1 día y después hay que volver a iniciar sesión.
- "Mis reservas" no se actualiza en vivo. Se actualiza al volver a la pestaña. Para enviarle cambios haría falta una sala privada por usuario, revisando la sesión en el socket.
- El límite de 10 correos al día por dirección vive en la memoria de la API: si se reinicia, la cuenta empieza de cero.
- Los correos salen desde una dirección de Gmail confirmada en Brevo, no desde un dominio propio. Algunos programas de correo los pueden mandar a spam; con un dominio propio y sus registros SPF y DKIM eso mejora.
- La actividad de los socios es simulada: la demo lo dice al pie de cada página y en la pantalla de entrada, y sus cuentas usan el dominio `socios.example.com`.
- El límite de intentos del login, las salas de Socket.io y el simulador del club viven en la memoria de un solo proceso de la API. Para correr varias copias de la API haría falta un almacenamiento compartido, como Redis, y que el simulador corra en una sola de ellas.

## Comandos

Dentro de `api/`:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la API y la reinicia con cada cambio |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Corre la API compilada |
| `npm run lint` | Revisa el código con ESLint |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm test` | Corre los tests |
| `npm run db:migrar` | Aplica las migraciones (y crea nuevas después de cambiar el esquema) |
| `npm run db:seed` | Carga los datos de prueba |
| `npm run db:reiniciar` | Borra todo y vuelve a armar la base de datos desde cero |

Dentro de `web/`: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck` y `npm test` hacen lo mismo para la web, y `npm run e2e` corre los tests de Playwright.

## Licencia

[MIT](LICENSE)
