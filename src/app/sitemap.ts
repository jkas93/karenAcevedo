import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://karenacevedo.com'; // Sustituir por el dominio final

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/karen`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/plan`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/movimiento`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/unete`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9, // Muy importante captar voluntarios
    },
  ];
}
