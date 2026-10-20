import { expect, test } from "@playwright/test";

test("el admin demo entra a su panel y ve el club de un vistazo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Admin demo" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
  await expect(page.getByText("Ocupación del día")).toBeVisible();
  await expect(page.getByRole("table", { name: "Reservas confirmadas de cada cancha, hora por hora" })).toBeVisible();
});

test("la documentación de la API se abre desde el pie de la página", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Documentación de la API" }).click();

  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: /API de Volea/ })).toBeVisible();
  await expect(page.getByText("Todo el club en un día, hora por hora")).toBeVisible();
});

test("la API no atiende pedidos que no pasan por la página", async ({ request }) => {
  // Directo a la API, sin la clave que agrega el puente de la página
  const directo = await request.get("http://localhost:4000/api/recursos");
  // A través de la página, con una clave inventada: el puente la borra y pone la verdadera
  const porLaPagina = await request.get("/api/recursos", { headers: { "x-clave-de-la-web": "inventada" } });

  expect(directo.status()).toBe(403);
  expect(porLaPagina.status()).toBe(200);
});
