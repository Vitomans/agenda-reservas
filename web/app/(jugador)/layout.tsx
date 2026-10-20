import { ZonaPrivada } from "@/components/Guardias";

// Las páginas de esta carpeta son solo para los jugadores con sesión (rol CLIENTE).
// El paréntesis en "(jugador)" hace que el nombre de la carpeta no aparezca en la dirección.
export default function LayoutJugador({ children }: { children: React.ReactNode }) {
  return <ZonaPrivada rol="CLIENTE">{children}</ZonaPrivada>;
}
