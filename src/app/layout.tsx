import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://karenacevedo.com"),
  title: "Karen Acevedo 2027 | Fuerza Ciudadana Chaclacayo",
  description: "Plan de Gobierno Municipal para Chaclacayo 2027 - 2030 de la candidata Karen Acevedo. Seguridad, orden y desarrollo continuo para todos los vecinos.",
  keywords: ["Karen Acevedo", "Chaclacayo", "Elecciones 2027", "Alcaldesa Chaclacayo", "Fuerza Ciudadana", "Candidata Chaclacayo", "Seguridad Chaclacayo", "Municipalidad de Chaclacayo"],
  authors: [{ name: "Karen Acevedo" }],
  openGraph: {
    title: "Karen Acevedo 2027 | Tu Próxima Alcaldesa",
    description: "Conoce el plan de gobierno que transformará Chaclacayo con seguridad, orden y oportunidades.",
    url: "https://karenacevedo.com",
    siteName: "Campaña Karen Acevedo 2027",
    images: [
      {
        url: "/karen-oficial.webp",
        width: 800,
        height: 600,
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
    images: ["/karen-oficial.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${montserrat.variable} ${openSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <main className="flex-grow">{children}</main>
      </body>
    </html>
  );
}
