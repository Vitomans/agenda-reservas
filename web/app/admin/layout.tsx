import { ZonaPrivada } from "@/components/Guardias";

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <ZonaPrivada rol="ADMIN">{children}</ZonaPrivada>;
}
