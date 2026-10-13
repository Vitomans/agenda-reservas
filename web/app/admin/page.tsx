import type { Metadata } from "next";
import { PanelAdmin } from "@/components/admin/PanelAdmin";

export const metadata: Metadata = { title: "Panel de administración" };

export default function PaginaAdmin() {
  return <PanelAdmin />;
}
