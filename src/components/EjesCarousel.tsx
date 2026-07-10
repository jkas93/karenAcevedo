"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ejes = [
  {
    icon: "🛡️",
    title: "Seguridad con tecnología",
    desc: "Patrullaje integrado, Web-C3 y recuperación del espacio público."
  },
  {
    icon: "🚧",
    title: "Quebradas protegidas",
    desc: "Mitigar riesgos en las 6 quebradas para proteger la vida."
  },
  {
    icon: "🏘️",
    title: "Barrios dignos",
    desc: "Mejorar espacio público y servicios con enfoque barrial."
  },
  {
    icon: "⚡",
    title: "Municipalidad moderna",
    desc: "Digitalización, simplificación y transparencia real."
  },
  {
    icon: "💼",
    title: "Economía que crece",
    desc: "Facilitar emprendimientos y formalización sin burocracia."
  }
];

export default function EjesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === ejes.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? ejes.length - 1 : prev - 1));
  };

  const startAutoPlay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      nextSlide();
    }, 3500);
  };

  const stopAutoPlay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, []);

  return (
    <>
      {/* Desktop View: Grid */}
      <div className="hidden md:flex md:flex-wrap justify-center gap-6 max-w-6xl mx-auto">
        {ejes.map((eje, i) => (
          <div key={i} className="bg-[#081c3a] border border-white/10 p-8 rounded-3xl shadow-sm hover:border-white/20 transition-colors text-white w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
            <div className="text-4xl mb-5 group-hover:scale-110 transition-transform origin-left">{eje.icon}</div>
            <h3 className="font-heading font-bold text-xl mb-4 text-white">{eje.title}</h3>
            <p className="font-heading font-semibold text-white/80 text-sm leading-relaxed">{eje.desc}</p>
          </div>
        ))}
      </div>

      {/* Mobile View: Carousel */}
      <div className="md:hidden relative w-full px-8" onTouchStart={stopAutoPlay} onTouchEnd={startAutoPlay}>
        <div className="overflow-hidden rounded-3xl relative">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {ejes.map((eje, i) => (
              <div key={i} className="w-full shrink-0">
                <div className="bg-[#081c3a] border border-white/10 p-8 rounded-3xl shadow-sm text-white h-full min-h-[260px] flex flex-col justify-center">
                  <div className="text-5xl mb-5">{eje.icon}</div>
                  <h3 className="font-heading font-bold text-2xl mb-4 text-white">{eje.title}</h3>
                  <p className="font-heading font-semibold text-white/80 text-base leading-relaxed">{eje.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        <button 
          onClick={() => { prevSlide(); startAutoPlay(); }}
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 z-10 hover:text-[#ffcc00] transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft size={36} strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => { nextSlide(); startAutoPlay(); }}
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 z-10 hover:text-[#ffcc00] transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight size={36} strokeWidth={2.5} />
        </button>

        {/* Dots */}
        <div className="flex justify-center items-center gap-2 mt-6">
          {ejes.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); startAutoPlay(); }}
              className={`w-3 h-3 rounded-full transition-colors ${i === currentIndex ? 'bg-[#ffcc00]' : 'bg-white/30'}`}
              aria-label={`Ir a tarjeta ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
