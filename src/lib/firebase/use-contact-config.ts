'use client';

import { useEffect, useState } from 'react';

const DEFAULT_CONTACT = {
  whatsapp: '51961858568',
  correo: 'karen.alcaldesa2026@gmail.com',
};

export function useContactConfig() {
  const [contact, setContact] = useState(DEFAULT_CONTACT);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/contact', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar la configuración de contacto.');
        return response.json() as Promise<{ whatsapp?: unknown; correo?: unknown }>;
      })
      .then((data) => {
        setContact({
          whatsapp:
            typeof data.whatsapp === 'string' && data.whatsapp
              ? data.whatsapp
              : DEFAULT_CONTACT.whatsapp,
          correo:
            typeof data.correo === 'string' && data.correo
              ? data.correo
              : DEFAULT_CONTACT.correo,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error cargando datos de contacto:', error);
      });

    return () => controller.abort();
  }, []);

  return contact;
}
