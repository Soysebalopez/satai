import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MonitorBB — Monitoreo ambiental ciudadano de Bahia Blanca",
  description:
    "Datos satelitales de calidad del aire, viento e incendios para Bahia Blanca. Informacion ambiental verificable, traducida a lenguaje simple.",
  keywords: [
    "calidad del aire",
    "Bahia Blanca",
    "monitoreo ambiental",
    "satelite",
    "contaminacion",
    "incendios",
  ],
  openGraph: {
    title: "MonitorBB — Monitoreo ambiental ciudadano",
    description:
      "Datos satelitales de calidad del aire, viento e incendios para Bahia Blanca.",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col grain">{children}</body>
    </html>
  );
}
