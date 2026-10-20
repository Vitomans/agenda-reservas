import { randomUUID } from "node:crypto";
import { db } from "../src/db.ts";
import { emailDeSocio, SOCIOS } from "../src/servicios/clubSimulado.ts";
import { hashearPassword } from "../src/servicios/passwords.ts";

// Datos de ejemplo para desarrollo y para la demo pública.
// Se puede correr varias veces: "upsert" crea cada dato si no existe y, si existe, lo deja igual al de acá.

// Contraseña de los usuarios demo. No es un secreto: la demo pública la usa
// en los botones "Entrar como cliente demo" y "Entrar como admin demo".
const CONTRASENA_DEMO = "demo1234";

const CANCHAS = ["Cancha 1", "Cancha 2", "Cancha 3", "Cancha 4"];

const passwordHash = await hashearPassword(CONTRASENA_DEMO);

const usuariosDemo = [
  { nombre: "Admin Demo", email: "admin@example.com", rol: "ADMIN" as const },
  { nombre: "Cliente Demo", email: "cliente@example.com", rol: "CLIENTE" as const },
];

try {
  for (const usuario of usuariosDemo) {
    await db.usuario.upsert({
      where: { email: usuario.email },
      update: { ...usuario, passwordHash },
      create: { ...usuario, passwordHash },
    });
  }

  // Los socios simulados que reservan en la demo (ver src/servicios/clubSimulado.ts).
  // Nadie conoce su contraseña: no se puede entrar con sus cuentas.
  for (const [i, nombre] of SOCIOS.entries()) {
    await db.usuario.upsert({
      where: { email: emailDeSocio(i + 1) },
      update: { nombre },
      create: { nombre, email: emailDeSocio(i + 1), passwordHash: await hashearPassword(randomUUID()) },
    });
  }

  for (const nombre of CANCHAS) {
    await db.recurso.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre },
    });
  }

  console.log(
    `Datos de ejemplo listos: ${usuariosDemo.length} usuarios demo, ${SOCIOS.length} socios simulados y ${CANCHAS.length} canchas.`,
  );
} finally {
  await db.$disconnect();
}
