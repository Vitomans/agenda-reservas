import { expect, type Page } from "@playwright/test";

// Pasos que comparten los tests e2e

// La sección con los horarios (su título es, por ejemplo, "Cancha 1 · miércoles 21 de octubre")
export function grilla(pagina: Page) {
  return pagina.getByRole("region", { name: / · / });
}

// Se reserva siempre mañana: hoy, en la noche, podrían no quedar horas
export async function elegirManana(pagina: Page) {
  await pagina.getByRole("group", { name: "Día" }).getByRole("button").nth(1).click();
  await expect(grilla(pagina).getByRole("button").first()).toBeVisible();
}

// Toca la primera hora libre de la grilla y devuelve cuál era, por ejemplo "10:00".
// En la vista por cancha el botón dice "10:00, Libre, $12.000"; en la vista por hora, "10:00, 4 canchas libres, $12.000".
export async function elegirPrimeraHoraLibre(pagina: Page) {
  const boton = grilla(pagina).getByRole("button", { name: /libre/i }).first();
  const hora = (await boton.getAttribute("aria-label"))!.split(",")[0];
  await boton.click();
  return hora;
}

// Cancela las reservas que hizo el jugador de esta página, para que la siguiente vez queden horas libres
export async function cancelarMisReservas(pagina: Page) {
  const respuesta = await pagina.request.get("/api/reservas/mias");
  if (!respuesta.ok()) return; // nadie entró en esta página

  const { reservas } = (await respuesta.json()) as { reservas: { id: string }[] };
  for (const reserva of reservas) {
    await pagina.request.delete(`/api/reservas/${reserva.id}`);
  }
}
