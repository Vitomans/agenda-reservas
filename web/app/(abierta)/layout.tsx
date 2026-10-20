import { ZonaAbierta } from "@/components/Guardias";

// Las páginas de esta carpeta se ven sin iniciar sesión, para que cualquiera mire los horarios antes de entrar.
export default function LayoutAbierto({ children }: { children: React.ReactNode }) {
  return <ZonaAbierta>{children}</ZonaAbierta>;
}
