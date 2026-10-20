import { expect, test } from "@playwright/test";
import { cancelarMisReservas, elegirManana, elegirPrimeraHoraLibre, grilla } from "./ayudantes";

test.afterEach(async ({ page }) => {
  await cancelarMisReservas(page);
});

test("un visitante ve los horarios sin entrar y reserva como invitado", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Reserva tu cancha" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  await elegirManana(page);
  const hora = await elegirPrimeraHoraLibre(page);
  await page.getByRole("button", { name: "Reservar como invitado" }).click();

  await expect(page.getByText("¡Listo! Reservaste la Cancha 1")).toBeVisible();
  await expect(grilla(page).getByRole("button", { name: `${hora}, Tu reserva` })).toBeVisible();
  // Ya entró como invitado: el menú muestra sus reservas
  await expect(page.getByRole("link", { name: "Mis reservas", exact: true })).toBeVisible();
});

test("en la vista por hora se elige la hora y después la cancha", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Por hora" }).click();
  await elegirManana(page);

  const hora = await elegirPrimeraHoraLibre(page);
  // Si a esa hora hay más de una cancha libre, la barra deja elegir: se toma la última
  const canchas = page.getByRole("group", { name: "Cancha" }).getByRole("button");
  let cancha = "Cancha 1";
  if ((await canchas.count()) > 1) {
    cancha = (await canchas.last().textContent())!;
    await canchas.last().click();
  }
  await page.getByRole("button", { name: "Reservar como invitado" }).click();

  await expect(page.getByText(`¡Listo! Reservaste la ${cancha}`)).toBeVisible();
  await expect(grilla(page).getByRole("button", { name: `${hora}, Tu reserva` })).toBeVisible();
});

test("cuando alguien reserva, la pantalla de otra persona se actualiza sola", async ({ page, browser, baseURL }) => {
  // Otra persona, en otro navegador, mira la misma cancha y el mismo día
  const otra = await (await browser.newContext({ baseURL, locale: "es-CL" })).newPage();
  for (const pantalla of [page, otra]) {
    await pantalla.goto("/");
    await elegirManana(pantalla);
  }
  await expect(otra.getByText("En vivo", { exact: true })).toBeVisible();

  const hora = await elegirPrimeraHoraLibre(page);
  await page.getByRole("button", { name: "Reservar como invitado" }).click();
  await expect(page.getByText("¡Listo!")).toBeVisible();

  // Sin recargar: la hora aparece ocupada y un aviso dice qué pasó
  await expect(grilla(otra).getByRole("button", { name: `${hora}, Ocupado` })).toBeVisible();
  await expect(otra.getByText(`Alguien acaba de reservar la Cancha 1 a las ${hora}`)).toBeVisible();
  await otra.context().close();
});

test("en Mis reservas se ve el correo y se cancela la reserva", async ({ page }) => {
  await page.goto("/");
  await elegirManana(page);
  await elegirPrimeraHoraLibre(page);
  await page.getByRole("button", { name: "Reservar como invitado" }).click();
  await page.getByRole("link", { name: "Ver mis reservas" }).click();

  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver correo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();

  await expect(page.getByText("Reserva cancelada.")).toBeVisible();
  await expect(page.getByText("No tienes reservas próximas.")).toBeVisible();
});
