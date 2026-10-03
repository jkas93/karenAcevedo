import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard/',
    name: 'Equipo Karen Acevedo',
    short_name: 'Equipo Karen',
    start_url: '/dashboard/control-electoral',
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
        name: 'Control Electoral',
        short_name: 'Electoral',
        url: '/dashboard/control-electoral',
        icons: [{ src: '/pwa-icon-192.png?v=brazo-2', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}

