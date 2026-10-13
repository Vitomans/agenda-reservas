// Se corre antes de cada archivo de tests.
// Agrega comparaciones para la página, como expect(boton).toBeDisabled().
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Borra lo que dibujó cada test, para que el siguiente empiece con la página vacía
afterEach(() => {
  cleanup();
});
