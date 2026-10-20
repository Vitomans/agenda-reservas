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

const DESCRIPCION = "Reserva canchas de pádel en el club Volea y ve los horarios libres en tiempo real.";

export const metadata: Metadata = {
  // La dirección de la página publicada, para que las imágenes para compartir tengan una dirección completa.
  // Vercel la entrega en VERCEL_PROJECT_PRODUCTION_URL (sin https://); en local es localhost.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  title: {
    default: "Volea · Reserva tu cancha de pádel",
    template: "%s · Volea",
  },
  description: DESCRIPCION,
  // Lo que se ve al compartir el link. La imagen es app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: "Volea",
    locale: "es_CL",
    title: "Volea · Reserva tu cancha de pádel",
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image" },
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
