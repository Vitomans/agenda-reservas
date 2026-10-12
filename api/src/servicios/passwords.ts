import bcrypt from "bcryptjs";

// Las contraseñas nunca se guardan tal cual: se guarda un "hash", que no se puede volver atrás.
// Para revisar una contraseña se calcula su hash de nuevo y se compara con el guardado.

// Cuántas vueltas da bcrypt. Más vueltas = más lento para quien intente adivinar contraseñas.
// 10 es el valor habitual: tarda una fracción de segundo.
const COSTO = 10;

export function hashearPassword(password: string) {
  return bcrypt.hash(password, COSTO);
}

export function compararPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
