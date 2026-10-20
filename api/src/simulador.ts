import { hoyEnElClub } from "./servicios/horario.ts";
import { moverElClub, rellenarDias } from "./servicios/clubSimulado.ts";
import type { Avisador } from "./tiempoReal.ts";

// El simulador del club: mientras alguien mira una cancha, cada cierto tiempo un socio simulado
// reserva o cancela una hora en ella (ver servicios/clubSimulado.ts). Así quien visita la demo
// ve cómo se actualiza la grilla en vivo sin tener que abrirla en dos pantallas.
//
// Si nadie está mirando, no hace nada, ni siquiera consulta la base de datos: la de la demo es
// gratis porque se apaga cuando no la usan, y tiene un límite de horas encendida al mes.

type Opciones = {
  canchasMiradas: () => string[]; // de crearTiempoReal()
  avisador: Avisador;
  esperaMs?: [minimo: number, maximo: number]; // cada cuánto se mueve el club
};

export function iniciarSimulador({ canchasMiradas, avisador, esperaMs = [12_000, 25_000] }: Opciones) {
  // El día en que ya se rellenó la semana. Al cambiar el día aparece un día nuevo que rellenar.
  let ultimoRelleno: string | null = null;
  let temporizador: NodeJS.Timeout | undefined;
  let detenido = false;

  async function unaVuelta() {
    const miradas = canchasMiradas();
    if (miradas.length === 0) return;

    const hoy = hoyEnElClub();
    if (ultimoRelleno !== hoy) {
      const rellenadas = await rellenarDias();
      ultimoRelleno = hoy;
      // Las grillas que ya estaban abiertas se ponen al día (basta un aviso por cancha)
      for (const reserva of rellenadas) avisador.reservaCreada(reserva);
    }

    const recursoId = miradas[Math.floor(Math.random() * miradas.length)];
    await moverElClub(recursoId, avisador);
  }

  function programarVuelta() {
    if (detenido) return;
    const [minimo, maximo] = esperaMs;

    temporizador = setTimeout(async () => {
      try {
        await unaVuelta();
      } catch (error) {
        // Si falla una vuelta (por ejemplo, la base de datos no responde), se intenta en la siguiente
        console.error("El simulador del club falló en esta vuelta:", error);
      }
      programarVuelta();
    }, minimo + Math.random() * (maximo - minimo));

    // El temporizador no mantiene viva la API: si todo lo demás terminó (por ejemplo, en los tests), se apaga
    temporizador.unref();
  }

  programarVuelta();

  return {
    detener() {
      detenido = true;
      clearTimeout(temporizador);
    },
  };
}
