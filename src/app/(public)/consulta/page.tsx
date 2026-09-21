import type { Metadata } from 'next';
import ConsultaElectoralClient from './ConsultaElectoralClient';

export const metadata: Metadata = {
  title: 'Consulta DNI: Local de Votación y Miembros de Mesa | Karen Acevedo',
  description:
    'Herramienta rápida para consultar tu local de votación, mesa de sufragio y si eres miembro de mesa oficial ONPE. Conoce tus deberes cívicos y nuestro compromiso con Chaclacayo.',
  keywords: [
    'ONPE consulta electoral',
    'miembro de mesa',
    'local de votacion',
    'donde votar',
    'consultar DNI elecciones',
    'Chaclacayo elecciones',
    'Karen Acevedo',
    'multas electorales ONPE',
  ],
  openGraph: {
    title: 'Consulta DNI: ¿Dónde Votar y Miembro de Mesa? | ONPE Perú',
    description:
      'Ingresa tu DNI para copiarlo y acceder directamente a la plataforma oficial de la ONPE. Revisa tu local de votación y conoce el plan para Chaclacayo.',
    url: 'https://karenacevedo.com/consulta',
    siteName: 'Campaña Karen Acevedo 2027',
    images: [
      {
        url: '/redes.png',
        width: 1200,
        height: 630,
        alt: 'Consulta Electoral ONPE - Karen Acevedo',
      },
    ],
    locale: 'es_PE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Consulta DNI: ¿Dónde Votar y Miembro de Mesa?',
    description:
      'Consulta tu local de votación y si eres miembro de mesa de forma rápida y segura.',
    images: ['/redes.png'],
  },
};

export default function ConsultaPage() {
  return <ConsultaElectoralClient />;
}
