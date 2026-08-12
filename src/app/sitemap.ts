import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://karenacevedo.com';

  return [
    {
      url: `${baseUrl}/`,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/karen`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/plan`,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/movimiento`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/unete`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];
}
