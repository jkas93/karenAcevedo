'use client';

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, Timer, Camera, TrendingDown, Droplets, DollarSign, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Hook para counter animado
function useCountUp(target: number, suffix: string, duration = 2000) {
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

  return { ref, display: `${count.toLocaleString()}${suffix}` };
}

// Icono personalizado para Nuevo Sol (S/)
const SolSign = ({ size, className }: { size: number, className?: string }) => (
  <span style={{ fontSize: size * 0.8, lineHeight: 1 }} className={`font-black tracking-tighter inline-flex items-center justify-center ${className}`}>
    S/
  </span>
);

const cifras = [
  { icon: ShieldAlert, value: 14500, suffix: "", label: "vecinos expuestos a huaicos", color: "text-red-500" },
  { icon: Camera, value: 40, suffix: "%", label: "de cámaras inoperativas", color: "text-orange-500" },
  { icon: Timer, value: 25, suffix: " min", label: "de espera del serenazgo", color: "text-yellow-600" },
  { icon: TrendingDown, value: 62, suffix: "%", label: "de informalidad comercial", color: "text-purple-500" },
  { icon: Droplets, value: 22, suffix: "%", label: "de anemia infantil", color: "text-blue-500" },
  { icon: SolSign, value: 250, suffix: "K", label: "pérdida/día si cierran vías", color: "text-emerald-500" },
];

function CifraCard({ icon: Icon, value, suffix, label, color }: typeof cifras[0]) {
  const { ref, display } = useCountUp(value, suffix);
  return (
    <div ref={ref} className="flex flex-col items-center text-center p-4">
      <Icon size={28} className={`${color} mb-2`} />
      <span className={`text-3xl md:text-4xl font-black ${color}`}>{display}</span>
      <span className="text-sm text-gray-400 mt-1 leading-tight">{label}</span>
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
      <section className="relative min-h-[85vh] flex items-center bg-gradient-to-br from-slate-50 to-slate-200 overflow-hidden py-12 md:py-0">
        <div className="container mx-auto px-4 z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            
            <div className="flex flex-col items-start space-y-6">
              <span className="bg-dark text-secondary px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide">
                Elecciones 2027-2030
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-dark leading-tight">
                Es hora de que Chaclacayo <span className="text-primary">vuelva a ser nuestro.</span>
              </h1>
              <p className="text-lg text-dark/80 max-w-lg">
                Karen Acevedo — Tu próxima Alcaldesa. Seguridad, orden y obras que protegen a tu familia de verdad.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-4">
                <a href="/plan-de-gobierno.pdf" target="_blank" rel="noopener noreferrer" className="bg-secondary text-dark font-heading font-bold py-3 px-8 rounded-full text-center hover:bg-yellow-400 transition-all hover:shadow-lg">
                  Descargar Plan de Gobierno
                </a>
                <Link href="/unete" className="border-2 border-primary text-dark font-heading font-bold py-3 px-8 rounded-full text-center hover:bg-primary hover:text-white transition-all">
                  Quiero Ayudar
                </Link>
              </div>
            </div>

            <div className="relative w-full h-[400px] md:h-[600px] rounded-2xl shadow-2xl overflow-hidden mt-10 md:mt-0">
              <Image 
                src="/karen-oficial.webp"
                alt="Karen Acevedo, candidata a la alcaldía de Chaclacayo, liderando reunión vecinal"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-top"
              />
              
              <div className="absolute bottom-6 left-4 md:left-8 glass p-4 rounded-xl flex items-center gap-4 max-w-[280px] z-10 shadow-xl">
                <div className="bg-secondary p-2 rounded-full text-dark shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-dark text-sm md:text-base leading-tight">Karen Acevedo</span>
                  <span className="text-xs text-dark/80 font-medium">Futura Alcaldesa de Chaclacayo</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Cifras que Duelen */}
      <section className="py-16 bg-dark">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl text-white mb-3">Las cifras que <span className="text-secondary">nadie quiere ver</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">Datos reales del diagnóstico territorial. Estos son los problemas que enfrentaremos con soluciones técnicas, no con promesas.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            {cifras.map((c, i) => (
              <CifraCard key={i} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* Propuestas Resumidas — 5 Prioridades */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="bg-primary/10 text-primary-dark px-4 py-1.5 rounded-full text-sm font-bold tracking-wide inline-block mb-4">
              PRIORIDADES DE GOBIERNO 2027-2030
            </span>
            <h2 className="text-3xl md:text-4xl mb-4">5 ejes para resultados <span className="text-primary">visibles y medibles</span></h2>
            <p className="text-text text-lg">No es una lista de promesas. Es una herramienta de gestión diseñada para producir resultados concretos.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="bg-slate-50 p-7 rounded-2xl hover:shadow-xl transition-shadow border border-slate-100 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">🛡️</div>
              <h3 className="text-lg mb-2">Seguridad con tecnología</h3>
              <p className="text-sm text-text">Patrullaje integrado, Web-C3 y recuperación del espacio público.</p>
            </div>
            <div className="bg-slate-50 p-7 rounded-2xl hover:shadow-xl transition-shadow border border-slate-100 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">🚧</div>
              <h3 className="text-lg mb-2">Quebradas protegidas</h3>
              <p className="text-sm text-text">Mitigar riesgos en las 6 quebradas para proteger la vida.</p>
            </div>
            <div className="bg-slate-50 p-7 rounded-2xl hover:shadow-xl transition-shadow border border-slate-100 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">🏘️</div>
              <h3 className="text-lg mb-2">Barrios dignos</h3>
              <p className="text-sm text-text">Mejorar espacio público y servicios con enfoque barrial.</p>
            </div>
            <div className="bg-slate-50 p-7 rounded-2xl hover:shadow-xl transition-shadow border border-slate-100 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">⚡</div>
              <h3 className="text-lg mb-2">Municipalidad moderna</h3>
              <p className="text-sm text-text">Digitalización, simplificación y transparencia real.</p>
            </div>
            <div className="bg-slate-50 p-7 rounded-2xl hover:shadow-xl transition-shadow border border-slate-100 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">💼</div>
              <h3 className="text-lg mb-2">Economía que crece</h3>
              <p className="text-sm text-text">Facilitar emprendimientos y formalización sin burocracia.</p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/plan" className="inline-flex items-center justify-center gap-3 bg-secondary text-dark font-heading font-bold py-4 px-10 rounded-full hover:bg-yellow-400 transition-all hover:scale-105 shadow-xl hover:shadow-2xl text-lg md:text-xl group">
              Explorar el Plan de Gobierno <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Prueba Social */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl">Los vecinos <span className="text-primary">ya decidieron</span></h2>
          </div>
          
          <TestimonialCarousel />
          
        </div>
      </section>
    </>
  );
}
