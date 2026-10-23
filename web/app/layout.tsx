import type { Metadata, Viewport } from "next";
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

// En el celular, el teclado achica la página en vez de taparla: así el chat del asistente (que ocupa la pantalla)
// deja el campo para escribir justo arriba del teclado. Lo respeta Chrome en Android (Safari en el iPhone no lo usa).
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

// Mientras el chat del asistente está abierto (data-panel-del-asistente), en el computador la página se corre
// para dejarle lugar a la derecha, y en el celular la página de atrás no se mueve
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased max-sm:has-[[data-panel-del-asistente]]:overflow-hidden lg:has-[[data-panel-del-asistente]]:pr-96">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
