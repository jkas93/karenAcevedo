import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard/',
    name: 'Equipo Karen Acevedo',
    short_name: 'Equipo Karen',
    description: 'Calendario operativo y coordinacion diaria del equipo de campana.',
    start_url: '/dashboard/calendario',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#005a9c',
    orientation: 'any',
    categories: ['productivity', 'business'],
    icons: [
      {
        src: '/pwa-icon-192.png?v=brazo-2',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-icon-512.png?v=brazo-2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-icon-512.png?v=brazo-2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Calendario operativo',
        short_name: 'Calendario',
        url: '/dashboard/calendario',
        icons: [{ src: '/pwa-icon-192.png?v=brazo-2', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}

