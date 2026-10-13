import type { Metadata } from "next";
import { MisReservas } from "@/components/MisReservas";

export const metadata: Metadata = { title: "Mis reservas" };

export default function PaginaMisReservas() {
  return <MisReservas />;
}
