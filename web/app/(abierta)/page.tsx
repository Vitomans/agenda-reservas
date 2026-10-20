import type { Metadata } from "next";
import { Reservar } from "@/components/reservar/Reservar";

export const metadata: Metadata = { title: "Reservar" };

export default function PaginaReservar() {
  return <Reservar />;
}
