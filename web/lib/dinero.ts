// Montos en pesos chilenos, con el formato de Chile: 12000 → "$12.000"
const FORMATO_PESOS = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

export function formatearPesos(monto: number) {
  return FORMATO_PESOS.format(monto);
}
