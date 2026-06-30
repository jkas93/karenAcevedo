import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/login', '/dashboard'],
    },
    sitemap: 'https://karenacevedo.com/sitemap.xml',
  };
}
