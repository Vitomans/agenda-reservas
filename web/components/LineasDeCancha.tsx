// Las líneas de una cancha de pádel vista desde arriba (20 × 10 metros), para usar de fondo.
// Una unidad del dibujo es 10 cm: la red va al medio y las líneas de saque a 6,95 m de la red.
// Toma el color del texto (currentColor), así se pinta con una clase como "text-white/10".
export function LineasDeCancha({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 204 104" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="0" y="0" width="200" height="100" />
      {/* La red */}
      <line x1="100" y1="-2" x2="100" y2="102" strokeWidth="3" />
      {/* Las líneas de saque y la línea central entre ellas */}
      <line x1="30.5" y1="0" x2="30.5" y2="100" />
      <line x1="169.5" y1="0" x2="169.5" y2="100" />
      <line x1="30.5" y1="50" x2="169.5" y2="50" />
    </svg>
  );
}
