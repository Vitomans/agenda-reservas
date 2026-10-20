import type { Metadata } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import { Proveedores } from "./proveedores";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// La letra de los títulos: angosta, gruesa y en cursiva, como la de un marcador deportivo
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Volea · Reserva tu cancha de pádel",
    template: "%s · Volea",
  },
  description: "Reserva canchas de pádel en el club Volea y ve los horarios libres en tiempo real.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
