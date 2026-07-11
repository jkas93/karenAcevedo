'use client';

import Image from "next/image";
import Link from "next/link";
import UneteForm from "@/components/UneteForm";
import EjesCarousel from "@/components/EjesCarousel";
import { ShieldAlert, Timer, Camera, TrendingDown, Droplets, ArrowRight, Briefcase, Triangle, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Hook para counter animado
function useCountUp(target: number, prefix: string, suffix: string, duration = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [hasStarted, target, duration]);

  return { ref, display: `${prefix}${count.toLocaleString()}${suffix}` };
}

const cifras = [
  { emoji: "⚠️", value: 14500, prefix: "", suffix: "", label: "VECINOS EXPUESTOS\nA HUAICOS", bgColor: "bg-red-500/10" },
  { emoji: "📷", value: 40, prefix: "", suffix: "%", label: "DE CÁMARAS\nINOPERATIVAS", bgColor: "bg-orange-500/10" },
  { emoji: "⏱️", value: 25, prefix: "", suffix: " MIN", label: "ESPERA DE\nSERENAZGO", bgColor: "bg-yellow-400/10" },
  { emoji: "💼", value: 62, prefix: "", suffix: "%", label: "INFORMALIDAD\nCOMERCIAL", bgColor: "bg-purple-500/10" },
  { emoji: "🩸", value: 22, prefix: "", suffix: "%", label: "DE ANEMIA\nINFANTIL", bgColor: "bg-red-500/10" },
  { emoji: "📉", value: 250, prefix: "S/", suffix: "K", label: "PÉRDIDA/DÍA SI\nCIERRAN VÍAS", bgColor: "bg-emerald-500/10" },
];

function CifraCard({ emoji, value, prefix, suffix, label, bgColor }: typeof cifras[0]) {
  const { ref, display } = useCountUp(value, prefix, suffix);
  return (
    <div ref={ref} className="flex flex-col items-center text-center p-2">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${bgColor} mb-6`}>
        <span className="text-4xl leading-none">{emoji}</span>
      </div>
      <span className="text-3xl md:text-[28px] lg:text-[32px] font-heading font-bold text-[#003366] mb-2">{display}</span>
      <span className="text-xs md:text-sm font-heading font-semibold text-[#003366] whitespace-pre-line leading-tight">{label}</span>
    </div>
  );
}

// Carrusel Automático
function TestimonialCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonials = [
    { text: "Su experiencia en gestión de riesgos nos da mucha tranquilidad.", name: "María Gonzales", role: "Dirigente Vecinal", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop" },
    { text: "La mejor candidata para recuperar el orden y la seguridad.", name: "Luis Rodríguez", role: "Comerciante", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&auto=format&fit=crop" },
    { text: "Al fin tenemos un plan técnico real para Chaclacayo.", name: "Ana Torres", role: "Madre de familia", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <>
      {/* Vista Desktop (Grid) */}
      <div className="hidden md:grid md:grid-cols-3 gap-8">
        {testimonials.map((t, i) => (
          <div key={i} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-dark italic mb-6">&quot;{t.text}&quot;</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden relative flex-shrink-0">
                <Image src={t.img} alt={t.name} fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <h4 className="font-bold text-dark m-0">{t.name}</h4>
                <p className="text-xs text-text">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vista Móvil (Carrusel) */}
      <div className="md:hidden relative overflow-hidden rounded-2xl">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {testimonials.map((t, i) => (
            <div key={i} className="w-full flex-shrink-0 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-dark italic mb-6 text-lg">&quot;{t.text}&quot;</p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden relative flex-shrink-0">
                  <Image src={t.img} alt={t.name} fill sizes="56px" className="object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-dark text-lg m-0">{t.name}</h4>
                  <p className="text-sm text-text">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Indicadores (Dots) */}
        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, i) => (
            <button 
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === activeIndex ? 'bg-primary w-6' : 'bg-gray-300'}`}
              aria-label={`Ir al testimonio ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative text-white pt-[100px] lg:pt-[140px] mt-[-72px] overflow-hidden min-h-[100vh] lg:min-h-[700px] flex flex-col lg:flex-row lg:items-center font-heading">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-bg.jpg"
            alt="Fondo de Chaclacayo"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-[#003366]/80" />
        </div>
        
        <div className="container mx-auto px-4 md:px-12 lg:px-16 xl:px-24 relative z-10 grid grid-cols-12 gap-x-6 lg:items-center mt-10 lg:mt-0 flex-grow">
          
          {/* Text Content (7 columns) */}
          <div className="col-span-12 lg:col-span-7 pt-4 pb-0 lg:pt-32 lg:pb-24 z-20 relative flex flex-col items-center lg:items-start text-center lg:text-left">
            <p className="text-secondary text-lg md:text-2xl mb-2 font-heading font-medium">
              Alcaldesa 2027-2030
            </p>
            <h1 className="text-[52px] sm:text-[72px] md:text-7xl lg:text-[110px] mb-4 lg:mb-6 leading-[0.9] uppercase font-heading font-black tracking-tighter w-full">
              <span className="text-white block">Karen</span>
              <span className="text-secondary block">Acevedo</span>
            </h1>
            <h2 className="text-[24px] sm:text-[26px] md:text-4xl lg:text-5xl mb-4 font-heading font-bold leading-tight px-2 lg:px-0 w-full">
              Es hora de que <span className="text-secondary">Chaclacayo<br className="hidden lg:block"/>vuelva a ser nuestro.</span>
            </h2>
            <p className="text-sm sm:text-base md:text-xl lg:text-2xl mb-8 font-heading font-medium leading-snug px-4 lg:px-0 max-w-md mx-auto lg:mx-0">
              Seguridad, orden y obras que protegen a tu <br className="hidden lg:block"/>familia de verdad.
            </p>
            
            <div className="flex flex-col lg:flex-row w-full sm:w-auto px-4 sm:px-0 justify-center lg:justify-start gap-4">
              <a href="/plan" className="bg-secondary text-[#003366] px-4 sm:px-8 py-3.5 rounded-full font-heading font-bold text-[15px] sm:text-lg hover:bg-yellow-400 transition-colors w-full lg:w-auto text-center inline-block">
                Descargar Plan de Gobierno
              </a>
              <a href="#unete" className="border-[2px] border-white text-white px-4 sm:px-8 py-3.5 rounded-full font-heading font-bold text-[15px] sm:text-lg hover:bg-white hover:text-[#003366] transition-colors bg-transparent w-full lg:w-auto text-center inline-block">
                Súmate Ahora
              </a>
            </div>
          </div>

          {/* Desktop Image (5 columns) */}
          <div className="hidden lg:flex col-span-12 lg:col-span-5 absolute bottom-0 right-0 h-full w-[45%] justify-end items-end pointer-events-none z-10">
             <Image 
                src="/karen-acevedo-candidata-chaclacayo.png" 
                alt="Karen Acevedo - Candidata a la Alcaldía de Chaclacayo 2027" 
                width={800}
                height={1000}
                priority
                className="object-contain object-bottom h-[90%] w-auto max-w-none mr-[5%]"
             />
          </div>
          
        </div>
        
        {/* Mobile Image */}
        <div className="w-full relative h-[380px] sm:h-[450px] flex justify-center items-end pointer-events-none z-10 lg:hidden mt-auto">
           <Image 
              src="/karen-acevedo-candidata-chaclacayo.png" 
              alt="Karen Acevedo - Candidata a la Alcaldía de Chaclacayo 2027" 
              fill
              priority
              className="object-contain object-bottom"
           />
        </div>
      </section>

      {/* Cifras que Duelen */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-[#003366] font-heading font-bold mb-4">Las cifras que nadie quiere ver</h2>
            <p className="text-[#003366] font-heading font-medium text-lg max-w-2xl mx-auto leading-relaxed">Datos reales del diagnóstico territorial. Estos son los problemas que enfrentaremos con soluciones técnicas, no con promesas.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {cifras.map((c, i) => (
              <CifraCard key={i} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* 5 Ejes Section */}
      <section className="py-24 bg-gradient-to-b from-[#00325f] to-[#0b2046]">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-[1000px] mx-auto mb-16 px-2">
            <span className="text-secondary font-heading font-medium text-lg md:text-xl block mb-2">
              Periodo 2027-2030
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-[40px] leading-[1.2] text-white font-heading font-bold mb-4 tracking-tight">
              5 ejes para <span className="text-secondary">resultados visibles y medibles</span>
            </h2>
            <p className="text-white font-heading font-medium text-lg md:text-xl leading-snug max-w-4xl mx-auto">
              No es una lista de promesas. Es una herramienta de gestión diseñada para<br className="hidden md:block"/> producir resultados concretos.
            </p>
          </div>
          
          <EjesCarousel />
          
          <div className="mt-16 text-center">
            <Link href="/plan" className="inline-block bg-secondary text-[#003366] font-heading font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-colors shadow-lg hover:shadow-xl text-lg">
              Descargar Plan de Gobierno
            </Link>
          </div>
        </div>
      </section>

      {/* Participación Ciudadana */}
      <section className="py-24 bg-[#1a56db]">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left Content */}
            <div className="text-white">
              <span className="font-heading font-medium text-2xl text-[#ffcc00] block mb-4">
                PARTICIPACIÓN CIUDADANA
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-[48px] font-heading font-bold mb-6 leading-tight">
                Chaclacayo necesita <br className="hidden lg:block"/><span className="text-[#ffcc00]">decisiones firmes.</span>
              </h2>
              <p className="font-heading font-medium text-xl lg:text-2xl mb-10 leading-snug">
                No podemos transformar el distrito solos. Súmate a la campaña, aporta tus ideas y sé parte de la gran fuerza ciudadana que recuperará la seguridad y el orden para nuestras familias.
              </p>
              
              <ul className="space-y-6">
                <li className="flex items-center gap-4">
                  <div className="bg-[#ffcc00] rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    <Check className="text-[#1a56db]" size={20} strokeWidth={3} />
                  </div>
                  <span className="font-heading font-medium text-xl lg:text-2xl">Recibe el Plan de Gobierno (PDF).</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="bg-[#ffcc00] rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    <Check className="text-[#1a56db]" size={20} strokeWidth={3} />
                  </div>
                  <span className="font-heading font-medium text-xl lg:text-2xl">Participa en las mesas barriales.</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="bg-[#ffcc00] rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    <Check className="text-[#1a56db]" size={20} strokeWidth={3} />
                  </div>
                  <span className="font-heading font-medium text-xl lg:text-2xl">Conviértete en voluntario activo.</span>
                </li>
              </ul>
            </div>

            {/* Right Content - Form */}
            <div>
              <UneteForm />
            </div>

          </div>
        </div>
      </section>

      {/* Prueba Social - Oculto provisionalmente
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl">Los vecinos <span className="text-primary">ya decidieron</span></h2>
          </div>
          
          <TestimonialCarousel />
          
        </div>
      </section>
      */}
    </>
  );
}
