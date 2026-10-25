import { expect, type Page, test } from "@playwright/test";
import { cancelarMisReservas, grilla } from "./ayudantes";

// El chat con el asistente de IA. En los e2e, la API responde con un asistente "de guion" (api/src/asistente/guion.ts):
// no le pregunta nada a una IA, pero todo lo demás es de verdad (las herramientas, la base de datos, la tarjeta
// para confirmar y el aviso en vivo). Así se prueba el camino completo sin gastar la cuota de la IA.

test.afterEach(async ({ page }) => {
  await cancelarMisReservas(page);
});

async function abrirElChat(pagina: Page) {
  await pagina.getByRole("button", { name: "Pregúntale al asistente" }).click();
  return pagina.getByRole("dialog", { name: "Asistente" });
}

test("el asistente busca horas libres, reserva con la confirmación de la persona y cancela", async ({ page, isMobile }) => {
  await page.goto("/");
  let chat = await abrirElChat(page);

  await chat.getByRole("button", { name: "¿Hay cancha mañana después de las 7?" }).click();

  // Las horas libres llegan como botones. Al tocar una, el asistente propone la reserva...
  const primeraHora = chat.getByRole("group", { name: /^Libres el / }).getByRole("button").first();
  const hora = (await primeraHora.getAttribute("aria-label"))!.split(",")[0];
  await primeraHora.click();

  // ...pero no reserva nada hasta que la persona confirma. La tarjeta la arma la API con los datos de la base.
  const tarjeta = chat.getByRole("group", { name: "¿Confirmas esta reserva?" });
  await expect(tarjeta).toContainText(`${hora} a `);
  // Con el tiempo que hará a esa hora
  await expect(tarjeta.getByText(/Pronóstico: \d+ °C · /)).toBeVisible();
  const cancha = (await tarjeta.textContent())!.match(/Cancha \d+/)![0];
  await tarjeta.getByRole("button", { name: "Reservar como invitado" }).click();

  await expect(chat.getByRole("group", { name: "Reservada" })).toBeVisible();
  await expect(chat.getByText(`Quedó reservada: ${cancha}`)).toBeVisible();

  // La grilla salta a ese día y a esa cancha, y la hora aparece como propia. En el computador se ve al lado del chat;
  // en el celular, el chat ocupa la pantalla y hay que cerrarlo.
  if (isMobile) await chat.getByRole("button", { name: "Cerrar el asistente" }).click();
  await expect(grilla(page)).toHaveAccessibleName(new RegExp(`^${cancha} · `));
  await expect(grilla(page).getByRole("button", { name: `${hora}, Tu reserva` })).toBeVisible();

  // Cancelar también pide confirmación
  if (isMobile) chat = await abrirElChat(page);
  await chat.getByRole("textbox", { name: "Escribe tu pregunta" }).fill("Cancela mi reserva");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await chat.getByRole("group", { name: "¿Cancelas esta reserva?" }).getByRole("button", { name: "Sí, cancelar" }).click();

  await expect(chat.getByRole("group", { name: "Cancelada: la hora quedó libre" })).toBeVisible();
  if (isMobile) await chat.getByRole("button", { name: "Cerrar el asistente" }).click();
  await expect(grilla(page).getByRole("button", { name: new RegExp(`^${hora}, Libre`) })).toBeVisible();
});

test("el asistente dice el pronóstico del tiempo por tramos", async ({ page }) => {
  await page.goto("/");
  const chat = await abrirElChat(page);

  await chat.getByRole("textbox", { name: "Escribe tu pregunta" }).fill("¿Va a llover mañana?");
  await chat.getByRole("button", { name: "Enviar" }).click();

  // El pronóstico de ejemplo: despejado en la mañana, parcialmente nublado en la tarde y lluvia ligera desde las 20:00
  const pronostico = chat.getByRole("group", { name: /^Pronóstico del / });
  await expect(pronostico.getByRole("listitem")).toHaveCount(3);
  await expect(pronostico.getByRole("listitem").last()).toContainText("lluvia ligera");
  await expect(pronostico.getByRole("link", { name: "Datos de MET Norway" })).toBeVisible();
  await expect(chat.getByText("En Santiago, de 08:00 a 12:00: despejado")).toBeVisible();
});

test("el asistente responde con la información del club y muestra de dónde la sacó", async ({ page }) => {
  await page.goto("/");
  const chat = await abrirElChat(page);

  await chat.getByRole("button", { name: "¿Arriendan paletas?" }).click();

  await expect(chat.getByText("Consultó la información del club:")).toBeVisible();
  await expect(chat.getByText("Servicios del club · Arriendo de paletas")).toBeVisible();
  await expect(chat.getByText(/puedes arrendar una en recepción/)).toBeVisible();
});
