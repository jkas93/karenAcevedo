import type { Metadata, Viewport } from "next";

import "./globals.css";

const montserratVariable = "--font-montserrat";
const openSansVariable = "--font-open-sans";

export const viewport: Viewport = {
  themeColor: "#0070C0",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://karenacevedo.com"),
  title: "Karen Acevedo 2027 | Fuerza Ciudadana Chaclacayo",
  description: "Plan de Gobierno Municipal para Chaclacayo 2027 - 2030 de la candidata Karen Acevedo. Seguridad, orden y desarrollo continuo para todos los vecinos.",
  applicationName: "Equipo Karen Acevedo",
  keywords: ["Karen Acevedo", "Chaclacayo", "Elecciones 2027", "Alcaldesa Chaclacayo", "Fuerza Ciudadana", "Candidata Chaclacayo", "Seguridad Chaclacayo", "Municipalidad de Chaclacayo"],
  authors: [{ name: "Karen Acevedo" }],
  appleWebApp: {
    capable: true,
    title: "Equipo Karen",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Karen Acevedo 2027 | Alcaldesa Chaclacayo",
    description: "Gobierno con Seguridad, Orden y Desarrollo continuo para todos los vecinos.",
    url: "https://karenacevedo.com",
    siteName: "Campaña Karen Acevedo 2027",
    images: [
      {
        url: "/redes.png",
        width: 1200,
        height: 630,
        alt: "Karen Acevedo - Fuerza Ciudadana Chaclacayo",
      },
    ],
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Karen Acevedo 2027 | Alcaldesa de Chaclacayo",
    description: "Plan de Gobierno Municipal para Chaclacayo 2027 - 2030. Seguridad, orden y desarrollo continuo.",
    images: ["/redes.png"],
  },
};

import UneteModal from "@/components/UneteModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${montserratVariable} ${openSansVariable} antialiased min-h-screen flex flex-col`}
      >
        <main className="flex-grow">{children}</main>
        <UneteModal />
      </body>
    </html>
  );
}
