import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Proveedores } from "./proveedores";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="es" className={geistSans.variable}>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
