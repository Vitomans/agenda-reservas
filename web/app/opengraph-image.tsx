import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// La imagen que se ve al compartir el link (en WhatsApp, LinkedIn, Slack...).
// Next.js la dibuja una vez al compilar, a partir de este JSX, y agrega sola las etiquetas og:image.
// Solo entiende flexbox y estilos escritos en cada elemento: aquí no hay Tailwind.

export const alt = "Volea: reserva tu cancha de pádel y mira los horarios libres en tiempo real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// La misma letra de los títulos de la página (ver app/layout.tsx), con su licencia en assets/OFL.txt
const barlow = await readFile(join(process.cwd(), "assets/BarlowCondensed-BoldItalic.ttf"));

const AZUL = "#1c398e"; // blue-900
const LIMA = "#9ae600"; // lime-400

// Una muestra de la grilla de horarios, con los mismos colores que en la página
const HORAS = [
  { hora: "17:00", texto: "Ocupado", fondo: "#e2e8f0", color: "#90a1b9" },
  { hora: "18:00", texto: "$16.000", fondo: "#ffffff", color: "#0f172b" },
  { hora: "19:00", texto: "Elegido", fondo: "#ecfccb", color: "#0f172b", borde: LIMA },
  { hora: "20:00", texto: "Ocupado", fondo: "#e2e8f0", color: "#90a1b9" },
  { hora: "21:00", texto: "Tu reserva", fondo: "#1447e6", color: "#ffffff" },
  { hora: "22:00", texto: "$16.000", fondo: "#ffffff", color: "#0f172b" },
];

export default function ImagenParaCompartir() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: AZUL,
        color: "white",
        fontFamily: "Barlow",
        padding: "60px 72px",
      }}
    >
      {/* Las líneas de una cancha de pádel, de fondo (ver components/LineasDeCancha.tsx) */}
      <svg
        viewBox="-2 -2 204 104"
        width="900"
        height="450"
        style={{ position: "absolute", right: -120, top: 90, opacity: 0.12 }}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      >
        <rect x="0" y="0" width="200" height="100" />
        <line x1="100" y1="-2" x2="100" y2="102" strokeWidth="3" />
        <line x1="30.5" y1="0" x2="30.5" y2="100" />
        <line x1="169.5" y1="0" x2="169.5" y2="100" />
        <line x1="30.5" y1="50" x2="169.5" y2="50" />
      </svg>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg viewBox="0 0 32 32" width="64" height="64">
            <circle cx="16" cy="16" r="14" fill={LIMA} />
            <path
              d="M7 7.5c5.5 4.5 5.5 12.5 0 17M25 7.5c-5.5 4.5-5.5 12.5 0 17"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 64, letterSpacing: 2 }}>VOLEA</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 112, lineHeight: 0.9 }}>RESERVA TU CANCHA DE PÁDEL</span>
          <span style={{ fontSize: 36, color: "#bedbff", marginTop: 24 }}>Los horarios libres, en tiempo real</span>
        </div>

        <span style={{ fontSize: 26, color: "#bbf451" }}>Demo de portafolio · Next.js · Express · PostgreSQL · Socket.io</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: "auto",
          alignSelf: "center",
          background: "#f8fafc",
          borderRadius: 32,
          padding: 28,
          gap: 18,
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#0f172b" }}>
          <span style={{ fontSize: 30 }}>CANCHA 1 · SÁBADO</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, color: "#45556c" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#7ccf00" }} />
            EN VIVO
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 340, gap: 16 }}>
          {HORAS.map(({ hora, texto, fondo, color, borde }) => (
            <div
              key={hora}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 162,
                height: 92,
                borderRadius: 18,
                background: fondo,
                color,
                border: `3px solid ${borde ?? "#e2e8f0"}`,
              }}
            >
              <span style={{ fontSize: 40 }}>{hora}</span>
              <span style={{ fontSize: 24 }}>{texto}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Barlow", data: barlow, style: "italic", weight: 700 }] },
  );
}
