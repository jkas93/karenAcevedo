'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_CONTACT = {
  whatsapp: '51961858568',
  correo: 'karen.alcaldesa2026@gmail.com',
};

export function useContactConfig() {
  const [contact, setContact] = useState(DEFAULT_CONTACT);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'contacto'),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
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
      },
      (error) => console.error('Error cargando datos de contacto:', error),
    );
  }, []);

  return contact;
}
