# Volea · Reserva de canchas en tiempo real

[![Estado del CI](https://github.com/Vitomans/agenda-reservas/actions/workflows/ci.yml/badge.svg)](https://github.com/Vitomans/agenda-reservas/actions/workflows/ci.yml)

Una app de reservas para un club de pádel ficticio. Los jugadores eligen una cancha y un día, ven los horarios libres y reservan uno. Cuando alguien reserva, el horario aparece ocupado al instante en la pantalla de todos los demás, sin recargar la página. Los administradores ven y manejan todas las reservas.

**Demo en vivo: [volea-reservas.vercel.app](https://volea-reservas.vercel.app)**. Entra con **Jugador demo** (una cuenta nueva solo para ti) o **Admin demo**. El club tiene **socios simulados**: mientras miras una cancha, reservan y cancelan horas, así que vas a ver cambiar la grilla sola. También puedes abrir la demo en dos pantallas, por ejemplo en el celular y en el computador, y reservar tú.

![Dos jugadores en la misma cancha: la segunda pantalla se actualiza sola](docs/demo.gif)

*Dos jugadores miran la misma cancha. El jugador 1 reserva las 17:00 y en la pantalla del jugador 2 aparece ocupada al instante. Después los dos eligen las 18:00, el jugador 1 la reserva primero y al jugador 2 se le avisa en el momento.*

## Tecnologías

- **API:** Node.js, Express 5 y TypeScript
- **Base de datos:** PostgreSQL con Prisma ORM (migraciones y datos de ejemplo)
- **Sesión:** JWT en una cookie httpOnly, contraseñas guardadas con bcrypt
- **Seguridad:** helmet, CORS y límite de intentos en el login
- **Validación:** Zod
- **Tiempo real:** Socket.io
- **Fechas y zonas horarias:** Luxon
- **Web:** Next.js 16 (App Router), React 19, Tailwind CSS 4 y TanStack Query
- **Tests:** Vitest, Supertest y Testing Library
- **Herramientas:** Docker Compose para la base de datos local y GitHub Actions para el CI
- **Publicación:** Vercel (web), Render (API), Neon (PostgreSQL) y UptimeRobot, todo en planes gratis

## Arquitectura

```mermaid
flowchart LR
    browser["Navegador<br/>React + TanStack Query"]
    next["Servidor de Next.js · Vercel<br/>rewrites de /api"]
    subgraph apiServer["Servidor de la API · Node.js en Render"]
        express["Express<br/>API REST"]
        socket["Socket.io"]
    end
    db[("PostgreSQL · Neon")]

    browser -->|"HTTP /api/... con la cookie de sesión"| next
    next -->|proxy| express
    express -->|Prisma| db
    express -->|"reserva creada o cancelada"| socket
    socket -.->|"eventos en vivo · WebSocket"| browser
```

1. La página llama a `/api/...` en su mismo sitio, y el servidor de Next.js le pasa la petición a Express.
2. Express revisa la sesión y valida los datos con Zod. Después aplica las reglas de las reservas y guarda en PostgreSQL con Prisma.
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
│   ├── app/              ← páginas: login, registro, reservar, mis-reservas, admin
│   ├── components/
│   ├── lib/              ← cliente de la API, hooks de datos, hook de tiempo real y funciones de fechas
│   └── tests/
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

La web le pasa a la API cada petición a `/api/...` (rewrites de Next.js). Para el navegador, la API está en el mismo sitio que la página, así que la cookie de sesión es propia (first-party) y no hay que lidiar con CORS. La conexión en tiempo real es la excepción: los rewrites no pueden mantener una conexión abierta, así que Socket.io se conecta directo a la API. Si la API corre en otro lugar, pon `NEXT_PUBLIC_API_URL` en `web/.env.local`.

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
| GET | `/api/auth/yo` | con sesión | Devuelve el usuario actual |
| GET | `/api/recursos` | con sesión | Lista las canchas |
| GET | `/api/recursos/:id/disponibilidad?fecha=YYYY-MM-DD` | con sesión | Los horarios de un día: libre, ocupado, mío o pasado |
| POST | `/api/reservas` | jugador | Reserva un horario (`201`, o `409` si ya está ocupado) |
| GET | `/api/reservas/mias` | jugador | Mis próximas reservas |
| DELETE | `/api/reservas/:id` | dueño o admin | Cancela una reserva |
| GET | `/api/admin/reservas?fecha=YYYY-MM-DD` | admin | Todas las reservas de un día, de cualquier fecha |
| GET | `/api/admin/recursos` | admin | Todas las canchas, también las desactivadas |
| POST | `/api/admin/recursos` | admin | Crea una cancha |
| PATCH | `/api/admin/recursos/:id` | admin | Cambia el nombre de una cancha o la activa y desactiva |

Sin sesión, la API responde `401`; con sesión pero sin el rol correcto, `403`. Las canchas nunca se borran, solo se desactivan, así el historial de reservas queda completo.

Los errores siempre vuelven en JSON, por ejemplo `{ "error": "Email o contraseña incorrectos" }`. Los errores de validación (400) además traen `detalles`, con los problemas de cada campo.

## Reglas de las reservas

- Los horarios duran 1 hora y empiezan en punto, de 08:00 a 22:00 (hora del club, `America/Santiago`).
- Se puede reservar desde hoy hasta 6 días más adelante, pero nunca en el pasado.
- Una cancha no se puede reservar dos veces en el mismo horario. Si dos personas lo intentan al mismo tiempo, solo una lo consigue y la otra recibe un `409`.
- Cada jugador puede tener como máximo 2 reservas activas.
- Solo el dueño o un admin pueden cancelar una reserva, y solo antes de que empiece. Al cancelar, el registro se mantiene y el horario queda libre.

## Tiempo real

La API y Socket.io comparten un mismo servidor HTTP. Cuando se crea o se cancela una reserva, la API avisa a todos los navegadores que están mirando esa cancha, y cada uno vuelve a pedir sus horarios. Nadie tiene que recargar la página.

- Cada cancha tiene su propia **sala** de Socket.io (`recurso:<id>`). La página avisa qué canchas está mirando con `canchas:seguir`: un jugador sigue la cancha que tiene en pantalla, y el panel de admin las sigue todas.
- El servidor envía `reserva:creada` y `reserva:cancelada` con `{ recursoId, inicio }`. Nada más: en tiempo real no viajan nombres ni emails, así que el socket no necesita la cookie de sesión.
- En la página, un evento solo marca como desactualizados los datos de esa cancha, y TanStack Query los vuelve a pedir por la API normal. La API REST sigue siendo la única fuente de verdad.
- Si se corta la conexión, Socket.io se reconecta solo. Después la página vuelve a entrar a sus salas y actualiza todo, por si se perdió algún evento. Un pequeño indicador "En vivo" muestra si la conexión está activa.
- Cuando otra persona reserva o libera una hora de lo que estás mirando, aparece un aviso arriba ("Alguien acaba de reservar las 19:00") y esa hora se resalta un momento. Para saber qué cambió, la página compara la grilla de antes con la nueva, así no te avisa lo que hiciste tú.
- Si escondes la pestaña, la página corta la conexión, y al volver se conecta y pide todo de nuevo. Una pestaña olvidada no mantiene trabajando al servidor.

## Cómo está publicada

Todo está en planes gratis:

| Parte | Dónde | Por qué ahí |
|---|---|---|
| Web (Next.js) | **Vercel** | Publica Next.js sin configurar nada, y cada push a `main` se publica solo. |
| API (Express + Socket.io) | **Render** | Socket.io necesita un servidor siempre encendido que mantenga las conexiones abiertas. Vercel corre funciones que se encienden, responden y se apagan, así que no sirve para la API. |
| Base de datos | **Neon** (PostgreSQL 17) | Se duerme sin uso, pero despierta sola en cuanto llega una consulta. Supabase pausa la base de datos después de 7 días sin actividad, y la PostgreSQL gratis de Render se borra a los 30 días. |
| Despertador | **UptimeRobot** | Render apaga la API después de 15 minutos sin visitas. UptimeRobot visita `/api/salud` cada 5 minutos para que no se duerma, y avisa por correo si la demo se cae. |

- **La configuración de Render está en el repo** (`render.yaml`), no solo en el panel de Render: cómo compilar, cómo arrancar, la región y las variables que hacen falta. Los secretos no van en el archivo. `DATABASE_URL` se escribe a mano en Render, y Render genera `JWT_SECRET`.
- **Las migraciones y el seed corren al final del build**, porque el plan gratis de Render no tiene "pre-deploy command". El seed se puede correr muchas veces sin duplicar nada (usa `upsert`).
- **Render publica solo si el CI pasó** (`autoDeployTrigger: checksPass`).
- **Las cuentas cuadran:** Render da 750 horas gratis al mes, y un mes tiene como máximo 744, así que alcanza para tener la API encendida siempre. `/api/salud` no consulta la base de datos, así que las visitas del despertador no despiertan a Neon y no gastan sus horas gratis de cómputo.
- **La API y la base de datos están en la misma zona** (Virginia, Estados Unidos), para que cada consulta tarde lo menos posible.
- Si el despertador fallara, la primera visita esperaría hasta un minuto a que la API despierte. Si la carga pasa de 5 segundos, la página explica por qué está tardando.

## Decisiones técnicas

**La base de datos bloquea las reservas dobles.** Un índice único parcial sobre `(recursoId, inicio)` (la cancha y la hora de inicio) solo cuenta las reservas confirmadas. La API no pregunta "¿está libre este horario?" antes de guardar: dos peticiones podrían recibir un "sí" al mismo tiempo. Simplemente intenta guardar, y la base de datos deja pasar solo una. La otra recibe un `409`. Las reservas canceladas no cuentan, así que cancelar libera el horario.

**El límite de 2 reservas se cumple aunque lleguen peticiones al mismo tiempo.** Contar las reservas activas del jugador y crear la nueva pasan en una sola transacción que bloquea la fila del jugador (`SELECT ... FOR UPDATE`). Si el mismo jugador envía varias peticiones a la vez, esperan en fila en vez de pasar todas la revisión. Un test envía peticiones en paralelo, y falla si se quita el bloqueo.

**La sesión va en una cookie httpOnly, en el mismo sitio que la página.** El JWT (HS256, válido por 1 día) va en una cookie `httpOnly` y `SameSite=Lax`, así los scripts de la página no lo pueden leer. La web llega a la API por los rewrites de Next.js, así que la cookie es propia del sitio aunque la API esté en otro dominio. Eso importa porque Safari bloquea las cookies de terceros. También significa que la API REST no necesita CORS.

**401 y 403 significan cosas distintas.** `requiereSesion` responde "¿quién eres?" (`401`), y `soloRoles` responde "¿tienes permiso?" (`403`). El rol se lee del token, sin consultar la base de datos. La contra: si un admin cambia el rol de alguien, el cambio se aplica cuando vence su token.

**Las horas se guardan en UTC y se muestran en la hora del club.** Los días y los horarios se calculan en `America/Santiago` con Luxon. El servidor también decide qué día es "hoy" (`GET /api/horario`), así un reloj o una zona horaria mal configurados en el dispositivo del visitante no pueden cambiar las reglas de las reservas.

**Los eventos en tiempo real son solo una señal.** Un evento dice qué cancha y qué horario cambiaron, y nada más: ni nombres ni emails, así que el socket no necesita sesión. La página marca esos datos como desactualizados y TanStack Query los vuelve a pedir a la API REST, que sigue siendo la única fuente de verdad. No hay una segunda copia del estado que mantener sincronizada, y si se pierde un evento, se arregla volviendo a pedir todo al reconectarse.

**No se borra nada.** Cancelar una reserva cambia su estado, y las canchas se desactivan en vez de borrarse. El historial de reservas queda completo.

**Los tests usan un PostgreSQL de verdad.** Las reglas más importantes viven en la base de datos (el índice único y el bloqueo de fila), y una base de datos simulada las escondería. Los tests corren contra Docker en local y contra un servicio de PostgreSQL en el CI. Cada test crea su propia cancha y sus jugadores y los borra al final. `crearApp()` arma la app de Express sin abrir un puerto, así Supertest la puede usar directo. El "notificador" de tiempo real se le pasa a la app, así un test lo puede cambiar por uno falso.

**Los datos se revisan en la entrada.** Zod valida el cuerpo y los parámetros de cada petición, y también las variables de entorno al partir: si falta una, la API no parte y dice cuál falta.

**Cada visitante recibe su propio jugador demo.** Si todos compartieran una cuenta, cada visitante vería las reservas de los demás, y como un jugador puede tener solo 2 reservas activas, la cuenta se llenaría. El botón "Jugador demo" llama a `POST /api/auth/invitado`, que crea un jugador nuevo ("Invitado 4F2A") con la sesión iniciada. Para que la demo no se llene de datos viejos, cada vez que se crea un invitado se borran los que tienen más de un día, con sus reservas, sin necesidad de una tarea programada. Un invitado dura lo mismo que una sesión.

**El club tiene socios simulados, pero solo se mueven si alguien está mirando.** Una demo de reservas con todas las horas libres parece abandonada, y el tiempo real solo se notaba abriéndola en dos pantallas. Por eso cada día de la semana se llena con reservas de 12 socios simulados, con más gente en la tarde y la noche y en las mañanas del fin de semana, como en un club de verdad. Además, mientras alguien mira una cancha, cada 12 a 25 segundos un socio reserva o cancela una hora en ella, y la grilla de quien mira se actualiza en vivo. Los socios reservan más cuando la cancha tiene muchas horas libres y cancelan más cuando está casi llena, así no se llena ni se vacía con el tiempo. Nunca cancelan la reserva de un jugador, y el índice único les impide tomar una hora ya reservada. El simulador revisa en memoria qué canchas tienen a alguien mirando (las salas de Socket.io): si no hay nadie, no consulta la base de datos, porque Neon gratis tiene un límite de horas encendida al mes. Las reservas de los socios se guardan directo en la base de datos, sin pasar por las reglas de los jugadores, porque son datos de ejemplo. En un club de verdad se apaga con `SIMULAR_CLUB=false`.

**La API sabe cuántos intermediarios hay delante.** Publicada, cada pedido pasa por Vercel, Cloudflare, la red interna de Render y un proxy local antes de llegar a Express, y cada uno anota una IP en `X-Forwarded-For`. Sin decirle a Express cuántos son (`trust proxy`), todos los visitantes parecerían venir de la misma IP y compartirían el límite de intentos del login. El número (`PROXIES_CONFIABLES=4`) se midió con la demo publicada, no se adivinó. Un test comprueba que, detrás de un proxy, cada visitante tiene su propio contador.

## Tests y CI

- **API:** 67 tests con Vitest y Supertest: sesión, jugadores invitados, límite de intentos detrás de un proxy, reglas de las reservas (incluido dos personas reservando el mismo horario), roles y permisos, eventos en tiempo real con clientes de Socket.io de verdad y los socios simulados (que nunca cancelan la reserva de un jugador y que no hacen nada si nadie mira).
- **Web:** 34 tests con Vitest y Testing Library: el cliente de la API, las funciones de fechas, la grilla de horarios, el formulario de login, el aviso de carga lenta, el hook de tiempo real (también con la pestaña escondida) y los avisos de lo que cambió en vivo.
- **CI:** GitHub Actions corre lint, tipos, tests y build de los dos proyectos en cada push. El trabajo de la API levanta su propio PostgreSQL.

## Limitaciones conocidas

- El límite de intentos del login se puede saltar con conocimientos técnicos. Vercel deja pasar una cabecera `X-Forwarded-For` escrita a mano, y la API publicada también se puede llamar directo en Render, sin pasar por Vercel. En los dos casos, alguien podría inventarse una IP distinta en cada intento. Para cerrarlo, la API tendría que aceptar solo pedidos que vengan de Vercel, por ejemplo con una clave compartida en una cabecera.
- Los jugadores invitados y sus reservas se borran al día siguiente. El "Admin demo" sí es una cuenta compartida, así que cualquier visitante puede cancelar reservas desde el panel de admin.
- La API usa planes gratis: si el despertador fallara, la primera visita tardaría hasta un minuto.
- No hay refresh tokens: la sesión dura 1 día y después hay que volver a iniciar sesión.
- "Mis reservas" no se actualiza en vivo. Se actualiza al volver a la pestaña. Para enviarle cambios haría falta una sala privada por usuario, revisando la sesión en el socket.
- La actividad de los socios es simulada: la demo lo dice en la pantalla de entrada, y sus cuentas usan el dominio `socios.example.com`.
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

Dentro de `web/`: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck` y `npm test` hacen lo mismo para la web.

## Licencia

[MIT](LICENSE)
