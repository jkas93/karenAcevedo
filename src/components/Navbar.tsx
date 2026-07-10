'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Candidata', path: '/karen' },
    { name: 'Nuestro Plan', path: '/plan' },
    { name: 'Movimiento', path: '/movimiento' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-white'
      }`}
    >
      <style>{`
        @keyframes armFlex {
          0% { transform: rotate(0deg) scale(1, 1); }
          10% { transform: rotate(5deg) scale(0.95, 1.05); } /* Toma impulso */
          20% { transform: rotate(-25deg) scale(1.15, 1.25); } /* Golpe de flexión y ensanchamiento */
          25% { transform: rotate(-25deg) scale(1.18, 1.28); } /* Palpitación de fuerza */
          32% { transform: rotate(-25deg) scale(1.15, 1.25); } /* Mantiene */
          50% { transform: rotate(0deg) scale(1, 1); } /* Regresa a la normalidad */
          100% { transform: rotate(0deg) scale(1, 1); }
        }
        @keyframes textReveal {
          0% { clip-path: inset(0 100% 0 0); transform: translateX(-20px); opacity: 0; }
          20% { clip-path: inset(0 100% 0 0); transform: translateX(-20px); opacity: 0; }
          50% { clip-path: inset(0 0 0 0); transform: translateX(0); opacity: 1; }
          100% { clip-path: inset(0 0 0 0); transform: translateX(0); opacity: 1; }
        }
        .animate-arm {
          animation: armFlex 2.5s ease-out forwards;
          transform-origin: bottom right;
        }
        .animate-text-reveal {
          animation: textReveal 2.5s ease-out forwards;
        }
      `}</style>
      <div className="container mx-auto px-4 md:px-12 lg:px-16 xl:px-24 flex justify-between items-center">
        <Link href="/" className="flex items-center group relative w-auto hover:opacity-90 transition-opacity">
          <Logo className="scale-[0.75] sm:scale-[0.85] md:scale-100 origin-left" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className={`font-heading font-semibold transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-[3px] after:bg-primary after:transition-all ${
                    pathname === link.path
                      ? 'text-primary-dark after:w-full'
                      : 'text-dark hover:text-primary after:w-0 hover:after:w-full'
                  }`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="#unete"
            className="bg-secondary text-dark font-heading font-bold py-2 px-6 rounded-full shadow hover:bg-yellow-400 hover:-translate-y-1 transition-all"
          >
            Súmate
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-dark p-2 focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <div
        className={`md:hidden absolute top-full left-0 w-full bg-white shadow-md transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-[400px] border-t border-gray-100' : 'max-h-0'
        }`}
      >
        <ul className="flex flex-col items-center py-4 gap-4">
          {navLinks.map((link) => (
            <li key={link.path} className="w-full text-center">
              <Link
                href={link.path}
                onClick={() => setIsOpen(false)}
                className={`block py-2 font-heading font-semibold ${
                  pathname === link.path ? 'text-primary-dark' : 'text-dark'
                }`}
              >
                {link.name}
              </Link>
            </li>
          ))}
          <li className="w-full px-6 mt-2">
            <Link
              href="#unete"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center bg-secondary text-dark font-heading font-bold py-3 rounded-full"
            >
              Súmate al equipo
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
