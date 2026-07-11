'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Footer() {
  const [whatsapp, setWhatsapp] = useState("51961858568");
  const [correo, setCorreo] = useState("karen.alcaldesa2026@gmail.com");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "contacto"), (doc) => {
      if (doc.exists()) {
        if (doc.data().whatsapp) setWhatsapp(doc.data().whatsapp);
        if (doc.data().correo) setCorreo(doc.data().correo);
      }
    });
    return () => unsub();
  }, []);

  return (
    <footer className="bg-[#041c3a] text-white pt-16 pb-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-16 mb-12">
          
          <div className="flex flex-col gap-0">
            <span className="font-heading font-medium text-[#ffcc00] text-sm mb-1">
              Alcaldesa 2027-2030
            </span>
            <div className="flex flex-col mb-4 leading-none">
              <span className="font-heading font-black text-4xl text-white tracking-wide">KAREN</span>
              <span className="font-heading font-black text-4xl text-[#ffcc00] tracking-wide">ACEVEDO</span>
            </div>
            <p className="text-white text-sm font-medium leading-relaxed max-w-[280px]">
              Trabajando por un Chaclacayo seguro, ordenado y próspero para todas las familias de nuestro distrito.
            </p>
          </div>
          
          <div>
            <h4 className="font-heading font-bold text-2xl mb-6 text-[#ffcc00]">Navegación</h4>
            <ul className="flex flex-col gap-4">
              <li><Link href="/" className="text-white font-medium hover:text-[#ffcc00] transition-colors">Inicio</Link></li>
              <li><Link href="/karen" className="text-white font-medium hover:text-[#ffcc00] transition-colors">Conoce a Karen</Link></li>
              <li><Link href="/plan" className="text-white font-medium hover:text-[#ffcc00] transition-colors">Plan de Gobierno</Link></li>
              <li><Link href="/movimiento" className="text-white font-medium hover:text-[#ffcc00] transition-colors">El Movimiento</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-2xl mb-6 text-[#ffcc00]">Participa</h4>
            <ul className="flex flex-col gap-4">
              <li><Link href="/unete" className="text-white font-medium hover:text-[#ffcc00] transition-colors">Únete al equipo</Link></li>
              <li><a href="#" target="_blank" rel="noopener noreferrer" className="text-white font-medium hover:text-[#ffcc00] transition-colors">WhatsApp Oficial</a></li>
              <li><a href={`mailto:${correo}`} className="text-white font-medium hover:text-[#ffcc00] transition-colors">Correo de contacto</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-heading font-bold text-2xl mb-6 text-[#ffcc00]">Descargas</h4>
            <p className="text-white font-medium mb-6 text-sm max-w-[280px] leading-relaxed">Accede a nuestra propuesta técnica completa detallada por ejes.</p>
            <a href="/plan-de-gobierno.pdf" target="_blank" rel="noopener noreferrer" className="inline-block bg-[#ffcc00] text-[#003366] font-heading font-bold rounded-full px-8 py-3 text-sm hover:bg-yellow-400 hover:scale-105 transition-all shadow-md">
              Descargar Plan de Gobierno
            </a>
          </div>
          
        </div>
        
        <div className="text-center pt-8 border-t border-white/10 text-white/50 text-sm font-medium">
          <p>&copy; 2026 Fuerza Ciudadana Chaclacayo. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
