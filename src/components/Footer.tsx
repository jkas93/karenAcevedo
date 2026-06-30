'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Footer() {
  const [whatsapp, setWhatsapp] = useState("51961858568");
  const [correo, setCorreo] = useState("voluntarios@fuerzaciudadana.pe");

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
    <footer className="bg-darker text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-1 mb-2">
              <span className="font-heading font-black text-3xl tracking-tighter text-white">
                KAREN <span className="text-secondary">ACEVEDO</span>
              </span>
            </Link>
            <p className="text-gray-400">
              Trabajando por un Chaclacayo seguro, ordenado y próspero para todas las familias de nuestro distrito.
            </p>
            <div className="flex gap-3 mt-2">
              <a href="https://www.facebook.com/KarenAcevedoChaclacayo/" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-primary p-2 rounded-full transition-colors" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/karenacevedo_chaclacayo/" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-pink-600 p-2 rounded-full transition-colors" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="https://www.tiktok.com/@mrs.karenacevedo" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-black p-2 rounded-full transition-colors" aria-label="TikTok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z"/></svg>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-heading font-bold text-xl mb-4 text-white">Navegación</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/" className="text-gray-400 hover:text-primary transition-colors">Inicio</Link></li>
              <li><Link href="/karen" className="text-gray-400 hover:text-primary transition-colors">Conoce a Karen</Link></li>
              <li><Link href="/plan" className="text-gray-400 hover:text-primary transition-colors">Plan de Gobierno</Link></li>
              <li><Link href="/movimiento" className="text-gray-400 hover:text-primary transition-colors">El Movimiento</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-xl mb-4 text-white">Participa</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/unete" className="text-gray-400 hover:text-secondary transition-colors">Únete al equipo</Link></li>
              <li><a href={`https://wa.me/${whatsapp}?text=Hola,%20quiero%20ser%20voluntario%20de%20la%20campa%C3%B1a%20de%20Karen%20Acevedo`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-secondary transition-colors">WhatsApp Oficial</a></li>
              <li><a href={`mailto:${correo}`} className="text-gray-400 hover:text-secondary transition-colors">Correo de contacto</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-heading font-bold text-xl mb-4 text-white">Descargas</h4>
            <p className="text-gray-400 mb-4">Accede a nuestra propuesta técnica completa detallada por ejes.</p>
            <a href="/plan-de-gobierno.pdf" target="_blank" rel="noopener noreferrer" className="inline-block border border-white text-white rounded-md px-6 py-2 text-sm hover:bg-white hover:text-darker transition-colors font-semibold">
              Descargar Plan (PDF)
            </a>
          </div>
          
        </div>
        
        <div className="text-center pt-8 border-t border-white/10 text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Fuerza Ciudadana Chaclacayo. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
