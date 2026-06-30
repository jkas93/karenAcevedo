'use client';

import { useState, useEffect } from "react";
import { Download, Building2, Laptop, Users, Briefcase, X, ChevronRight, ChevronDown, Smartphone, Monitor, Car, CheckCircle2, Shield, AlertTriangle, Heart, TrendingUp, Leaf } from "lucide-react";
import { planData, CardData } from "./planData";

type ISOCard = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  shortDesc: string;
  detail: {
    queEs: string;
    beneficios: string[];
    impacto: string;
    porQueImporta: string;
  };
};

const isoCards: ISOCard[] = [
  {
    id: "iso9001",
    emoji: "🏅",
    title: "ISO 9001",
    subtitle: "Calidad de Servicio al Ciudadano",
    shortDesc: "Que cada trámite, cada atención y cada servicio municipal cumpla estándares internacionales de calidad.",
    detail: {
      queEs: "La ISO 9001 es la norma internacional de gestión de calidad más reconocida del mundo. Aplicada a la municipalidad, garantiza que los procesos de atención al ciudadano, licencias, mesa de partes y recaudación operen bajo estándares medibles, trazables y mejorables.",
      beneficios: [
        "Reducción de errores en trámites y expedientes",
        "Tiempos de atención estandarizados y públicos",
        "Procesos documentados que no dependen de una sola persona",
        "Mejora continua basada en indicadores reales",
        "Confianza ciudadana en un servicio profesional"
      ],
      impacto: "Una municipalidad certificada ISO 9001 demuestra que sus servicios no son improvisados. El vecino sabrá exactamente cuánto demora un trámite, tendrá un canal de reclamo trazable y la gestión operará con disciplina institucional, no con favores discrecionales.",
      porQueImporta: "La Municipalidad Metropolitana de Lima ya implementó su Sistema Integrado de Gestión basado en ISO 9001. Chaclacayo puede seguir esa ruta y convertirse en referente de calidad entre los distritos de Lima Este."
    }
  },
  {
    id: "iso37001",
    emoji: "⚖️",
    title: "ISO 37001",
    subtitle: "Anticorrupción Certificada",
    shortDesc: "Blindar la municipalidad contra la corrupción con un sistema de gestión antisoborno certificable.",
    detail: {
      queEs: "La ISO 37001 es la norma internacional de sistemas de gestión antisoborno. Aplicada a la municipalidad, protege las áreas de mayor riesgo: logística, contrataciones, fiscalización, obras públicas, autorizaciones y proyectos de inversión.",
      beneficios: [
        "Matrices de riesgo de corrupción por cada proceso crítico",
        "Debida diligencia en contrataciones y autorizaciones",
        "Canales de denuncia protegidos y confidenciales",
        "Control de conflictos de interés documentado",
        "Auditorías internas anticorrupción periódicas"
      ],
      impacto: "Un gobierno local con ISO 37001 envía un mensaje claro: aquí no se roba. Cada sol del presupuesto tiene trazabilidad, cada contratación tiene control y cada funcionario responde ante un sistema, no ante un favor político.",
      porQueImporta: "La corrupción municipal destruye la confianza ciudadana y desvía recursos que deberían proteger vidas y mejorar barrios. Este no es un adorno: es un blindaje institucional real."
    }
  },
  {
    id: "ceropapel",
    emoji: "📄",
    title: "Cero Papel",
    subtitle: "Gestión 100% Digital",
    shortDesc: "Transformar la municipalidad con expediente electrónico, firma digital y notificación electrónica.",
    detail: {
      queEs: "El Plan Cero Papel implementa la Plataforma Digital de Gestión Documental alineada al Decreto Legislativo N.° 1412 (Ley de Gobierno Digital) y al Sistema de Gestión Documental (SGD) de la PCM. Incluye expediente electrónico, firma digital, notificación electrónica y archivo trazable.",
      beneficios: [
        "Expedientes electrónicos con trazabilidad completa",
        "Firma digital legalmente válida en documentos municipales",
        "Notificación electrónica que reduce tiempos de días a minutos",
        "Integración con pagos digitales y transparencia pública",
        "Archivo digital seguro con resguardo documental"
      ],
      impacto: "El vecino dejará de hacer colas interminables para presentar documentos. Podrá iniciar trámites desde su celular, firmar digitalmente, recibir notificaciones en su correo y dar seguimiento a su expediente en tiempo real.",
      porQueImporta: "La PCM ya impulsa esta transformación a nivel nacional. Chaclacayo no puede quedarse atrás. La digitalización no es un lujo: es un derecho del ciudadano a un servicio rápido, transparente y moderno."
    }
  },
  {
    id: "protdatos",
    emoji: "🔒",
    title: "Protección de Datos",
    subtitle: "Videovigilancia Ética y Legal",
    shortDesc: "Seguridad tecnológica que respeta tus derechos. Analítica NO biométrica con protocolos de auditoría.",
    detail: {
      queEs: "La videovigilancia inteligente del Web-C3 operará con analítica de video NO biométrica y lectura de placas (LPR), respetando estrictamente el marco nacional de protección de datos personales y la Opinión Consultiva N.° 049-2025-JUS/DGTAIPD de la Autoridad Nacional de Protección de Datos.",
      beneficios: [
        "Analítica de video sin reconocimiento facial en etapa inicial",
        "Lectura de placas (LPR) para control vehicular legal",
        "Protocolos de acceso restringido a grabaciones",
        "Perfiles autorizados con registro de consulta",
        "Auditoría periódica del uso de la información"
      ],
      impacto: "Otras municipalidades han implementado cámaras sin respetar la ley de datos. Nosotros no solo cumpliremos la normativa vigente, sino que seremos ejemplo de cómo la tecnología puede proteger al ciudadano sin violar sus derechos fundamentales.",
      porQueImporta: "La seguridad no puede construirse sobre la vulneración de derechos. Esta propuesta demuestra que se puede tener un sistema de vigilancia potente, inteligente y legal al mismo tiempo."
    }
  }
];

export default function PlanPage() {
  const [activeTab, setActiveTab] = useState("seguridad");
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [selectedISO, setSelectedISO] = useState<ISOCard | null>(null);

  const activeData = planData[activeTab];

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById("tab-content-area");
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Building2": return <Building2 className="text-primary-dark" size={24} />;
      case "Laptop": return <Laptop className="text-primary-dark" size={24} />;
      case "Users": return <Users className="text-primary-dark" size={24} />;
      case "Briefcase": return <Briefcase className="text-primary-dark" size={24} />;
      default: return null;
    }
  };

  const getSidebarIcon = (id: string) => {
    switch (id) {
      case "seguridad": return <Shield size={24} />;
      case "prevencion": return <AlertTriangle size={24} />;
      case "barrios": return <Heart size={24} />;
      case "economia": return <TrendingUp size={24} />;
      case "ambiente": return <Leaf size={24} />;
      default: return null;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 relative">
      {/* Header Plan */}
      <section className="bg-dark text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl mb-4">Un plan real para <span className="text-primary">problemas reales</span></h1>
          <p className="text-xl max-w-2xl mx-auto text-gray-300 mb-8">
            Nuestro gobierno aplicará una Matriz de Desarrollo Distrital 4×4 para actuar de forma simultánea e integrada sobre los verdaderos problemas de Chaclacayo.
          </p>
          <a href="/plan-de-gobierno.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 shadow-lg shadow-primary/30">
            <Download size={20} />
            Descargar Plan de Gobierno (PDF)
          </a>
        </div>
      </section>

      {/* Navegación de Pestañas: Tabs Horizontales (Todas las pantallas) */}
      <section className="pt-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="relative sticky top-[56px] md:top-[64px] z-40 bg-white/95 backdrop-blur-md shadow-sm rounded-2xl border border-gray-200 overflow-hidden mb-8">

            {/* Sombra derecha para indicar scroll en celulares */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none sm:hidden flex items-center justify-end pr-2 z-10">
              <ChevronRight size={16} className="text-gray-400 animate-pulse" />
            </div>

            {/* Pestañas Clásicas */}
            <div className="flex overflow-x-auto scrollbar-hide px-2 sm:px-0">
              {Object.values(planData).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`whitespace-nowrap flex-shrink-0 sm:flex-1 py-4 px-5 text-sm md:text-base font-bold transition-colors ${activeTab === tab.id
                      ? "bg-primary text-white border-b-4 border-primary-dark rounded-t-md sm:rounded-none"
                      : "text-gray-600 hover:bg-gray-100 hover:text-primary"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Floating Sidebar Navigation (Estética Premium) */}
      <div className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 p-2 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-white/50 rounded-full">
        {Object.values(planData).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              title={tab.title}
              className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all duration-300 relative group ${isActive
                  ? "bg-primary/10 ring-1 ring-primary/30 shadow-inner scale-110"
                  : "bg-transparent hover:bg-white hover:shadow-sm"
                }`}
            >
              <span className="text-lg md:text-2xl leading-none drop-shadow-sm">{tab.label.split(" ")[0]}</span>
              {/* Tooltip on hover (desktop only) */}
              <span className="absolute right-full mr-4 bg-dark text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap hidden md:block">
                {tab.title}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tabs Content */}
      <section id="tab-content-area" className="py-16">
        <div className="container mx-auto px-4 max-w-6xl min-h-[500px]">
          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <span className="bg-primary/10 text-primary-dark px-4 py-1.5 rounded-full text-sm font-bold tracking-wide inline-block mb-4">
                {activeData.label}
              </span>
              <h3 className="text-3xl md:text-4xl text-dark mb-4 font-bold">{activeData.title}</h3>
              <p className="text-text text-base md:text-lg">
                {activeData.description}
              </p>
            </div>

            {/* Grid de 4 Habilitadores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeData.cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      {getIcon(card.icon)}
                    </div>
                    <h4 className="font-bold text-dark text-lg md:text-xl">{card.title}</h4>
                  </div>
                  <p className="text-text relative z-10 mb-4">{card.shortDesc}</p>

                  <div className="flex items-center text-primary-dark font-bold text-sm relative z-10 group-hover:text-secondary-dark transition-colors">
                    Ver detalle técnico <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Metas Cuantificadas del Periodo */}
      <section className="py-16 bg-dark text-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <span className="bg-secondary/20 text-secondary px-4 py-1.5 rounded-full text-sm font-bold tracking-wide inline-block mb-4">
              METAS 2027-2030
            </span>
            <h2 className="text-3xl md:text-4xl mb-3">Resultados medibles, <span className="text-secondary">no promesas</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { emoji: "⏱️", meta: "Respuesta en menos de 5 minutos", desc: "Reducir el tiempo de serenazgo de 18-25 min a < 5 min en zonas priorizadas." },
              { emoji: "🏔️", meta: "Quebradas protegidas", desc: "Mitigar la exposición en puntos críticos de las 6 quebradas priorizadas." },
              { emoji: "💧", meta: "Cerrar brechas de agua", desc: "Avanzar en coberturas de agua, alcantarillado y equipamiento social en zonas vulnerables." },
              { emoji: "🩸", meta: "Anemia a la mitad", desc: "Reducir anemia infantil del 22.6% actual. Fortalecer atención preventiva articulada." },
              { emoji: "📋", meta: "Formalización real", desc: "Reducir burocracia, aumentar formalización y mejorar clima de inversión local." },
              { emoji: "💰", meta: "Financiamiento sostenible", desc: "Obras por Impuestos, programación multianual, cooperación y fondos concursables." },
            ].map((m, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <span className="text-3xl">{m.emoji}</span>
                <h4 className="font-bold text-white mt-3 mb-2">{m.meta}</h4>
                <p className="text-gray-400 text-sm">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Propuestas Estructurales — 4 tarjetas con modal */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <span className="bg-dark text-secondary px-4 py-1.5 rounded-full text-sm font-bold tracking-wide inline-block mb-4">
              PROPUESTAS ESTRUCTURALES
            </span>
            <h2 className="text-3xl md:text-4xl text-dark mb-3">Garantías de <span className="text-primary">seriedad institucional</span></h2>
            <p className="text-text max-w-2xl mx-auto">Más allá del plan operativo, estas propuestas transforman la municipalidad desde adentro. Haz clic en cada una para conocer su impacto.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isoCards.map((card) => (
              <div
                key={card.id}
                onClick={() => setSelectedISO(card)}
                className="group bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
                <div className="text-4xl mb-3">{card.emoji}</div>
                <h3 className="text-xl font-bold text-dark mb-1">{card.title}</h3>
                <p className="text-primary-dark font-semibold text-sm mb-3">{card.subtitle}</p>
                <p className="text-text text-sm mb-4">{card.shortDesc}</p>
                <div className="flex items-center text-primary-dark font-bold text-sm group-hover:text-secondary-dark transition-colors">
                  Conocer impacto <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Descarga */}
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-primary/10 border-2 border-primary rounded-3xl p-8 md:p-10 max-w-4xl mx-auto flex flex-col items-center">
            <h3 className="text-xl md:text-2xl font-bold text-dark mb-4">¿Quieres conocer el detalle técnico completo?</h3>
            <p className="text-text mb-8">Revisa las matrices completas de nuestro documento oficial validado por profesionales.</p>
            <a href="/plan-de-gobierno.pdf" target="_blank" rel="noopener noreferrer" className="bg-secondary text-dark font-heading font-bold py-3 px-8 rounded-full flex items-center gap-2 hover:bg-yellow-400 transition-colors hover:scale-105 transform shadow-md">
              <Download size={20} />
              Descargar Plan de Gobierno PDF
            </a>
          </div>
        </div>
      </section>

      {/* MODAL: Propuestas del Plan (Deep-Dive) */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
          <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300">

            <div className="sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg">{getIcon(selectedCard.icon)}</div>
                <h3 className="text-xl font-bold text-dark">{selectedCard.title}</h3>
              </div>
              <button onClick={() => setSelectedCard(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="text-gray-500" size={24} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-primary-dark mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>El Programa Concreto
                </h4>
                <p className="text-lg text-dark leading-relaxed">{selectedCard.detail.programa}</p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 border-l-4 border-l-primary">
                <h4 className="font-bold text-dark mb-2">🎯 Meta Principal</h4>
                <p className="text-text">{selectedCard.detail.metas}</p>
              </div>

              <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-primary-dark mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>Actores e Intervención
                </h4>
                <p className="text-text">{selectedCard.detail.actores}</p>
              </div>

              <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-primary-dark mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>Viabilidad Financiera
                </h4>
                <div className="bg-primary/10 px-4 py-3 rounded-lg inline-block">
                  <p className="text-dark font-medium">💰 {selectedCard.detail.financiamiento}</p>
                </div>
              </div>

              {selectedCard.detail.ecosystem && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-dark">{selectedCard.detail.ecosystem.title}</h3>
                    <p className="text-primary-dark font-medium">{selectedCard.detail.ecosystem.subtitle}</p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 justify-center">
                    {selectedCard.detail.ecosystem.apps.map((app, idx) => (
                      <div key={idx} className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="bg-primary/10 p-3 rounded-xl text-primary-dark">
                            {app.icon === 'Smartphone' && <Smartphone size={28} />}
                            {app.icon === 'Monitor' && <Monitor size={28} />}
                            {app.icon === 'Car' && <Car size={28} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-dark text-lg leading-tight">{app.name}</h4>
                            <span className="text-xs text-text uppercase tracking-wider font-semibold">{app.role}</span>
                          </div>
                        </div>
                        <ul className="space-y-3 mt-4">
                          {app.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-dark">
                              <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 text-center text-sm text-text bg-slate-50 p-4 rounded-xl">
                    <span className="font-bold text-dark">Nota Técnica:</span> Arquitectura de software diseñada y documentada (ARQUITECTURA_DATOS.md).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Propuestas Estructurales (ISO / Cero Papel / Protección de Datos) */}
      {selectedISO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm" onClick={() => setSelectedISO(null)}></div>
          <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300">

            {/* Sticky Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedISO.emoji}</span>
                <div>
                  <h3 className="text-xl font-bold text-dark leading-tight">{selectedISO.title}</h3>
                  <p className="text-primary-dark font-semibold text-sm">{selectedISO.subtitle}</p>
                </div>
              </div>
              <button onClick={() => setSelectedISO(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="text-gray-500" size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-8">

              {/* ¿Qué es? */}
              <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-primary-dark mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  ¿Qué es y cómo se aplica?
                </h4>
                <p className="text-dark leading-relaxed">{selectedISO.detail.queEs}</p>
              </div>

              {/* Beneficios */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-dark mb-4 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-secondary" /> Beneficios Concretos
                </h4>
                <ul className="space-y-3">
                  {selectedISO.detail.beneficios.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-text">
                      <span className="bg-primary/20 text-primary-dark font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Impacto */}
              <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-primary-dark mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  Impacto en la Gestión
                </h4>
                <p className="text-dark leading-relaxed">{selectedISO.detail.impacto}</p>
              </div>

              {/* Por qué importa */}
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6">
                <h4 className="font-bold text-dark mb-2">💡 ¿Por qué esto importa?</h4>
                <p className="text-dark/80">{selectedISO.detail.porQueImporta}</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
