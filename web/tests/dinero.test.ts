import { describe, expect, it } from "vitest";
import { formatearPesos } from "@/lib/dinero";

describe("formatearPesos", () => {
  it("escribe los pesos como en Chile, con punto para los miles", () => {
    expect(formatearPesos(12_000)).toBe("$12.000");
    expect(formatearPesos(1_250_000)).toBe("$1.250.000");
  });
});
