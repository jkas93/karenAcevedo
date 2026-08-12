import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/login', '/dashboard', '/ficha-equipo', '/api'],
    },
    sitemap: 'https://karenacevedo.com/sitemap.xml',
  };
}
