'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Clock,
  MapPin,
  Users,
  Coins,
  FileCheck,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Info,
} from 'lucide-react';

const ONPE_OFFICIAL_URL = 'https://consultaelectoral.onpe.gob.pe/inicio';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: '¿Cuáles son las multas electorales por no votar o no instalar mesa?',
    answer:
      'La multa por no ejercer el cargo de miembro de mesa (titular o suplente) es de S/ 260. Adicionalmente, si eres miembro de mesa y tampoco votas, se acumulará la multa por omisión al sufragio, la cual oscila entre S/ 25.75 y S/ 103.00 según el nivel de pobreza de tu distrito clasificado por el INEI.',
  },
  {
    question: '¿A qué hora deben presentarse los miembros de mesa?',
    answer:
      'Tanto los miembros titulares como los suplentes deben asistir a su local de votación a las 6:00 a. m. para la instalación puntual de la mesa y la recepción de las actas y material electoral.',
  },
  {
    question: '¿Cómo y cuándo se paga la compensación de S/ 120?',
    answer:
      'Los ciudadanos que cumplan efectivamente su labor en la jornada electoral recibirán una compensación económica de S/ 120 otorgada por la ONPE. El cobro se gestiona registrando tu cuenta bancaria, billetera digital (Yape/Plin) o cobro presencial en el Banco de la Nación a través de la plataforma oficial habilitada por ONPE.',
  },
  {
    question: '¿Cómo puedo tramitar una justificación o excusa al cargo de miembro de mesa?',
    answer:
      'Las justificaciones o excusas se tramitan de manera presencial o virtual ante la Oficina Descentralizada de Procesos Electorales (ODPE) presentando el certificado médico, documentación laboral, viaje inaplazable u otra causal justificada amparada en la Ley Orgánica de Elecciones dentro de los plazos fijados en el cronograma electoral.',
  },
  {
    question: '¿Dónde obtengo mi credencial oficial de miembro de mesa?',
    answer:
      'Una vez que confirmes en la plataforma de la ONPE que saliste sorteado, el mismo portal te permite descargar e imprimir tu credencial oficial digital en PDF con código QR de verificación.',
  },
];

export default function ConsultaElectoralClient() {
  const [dni, setDni] = useState('');
  const [copiedDni, setCopiedDni] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleDniChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 8);
    setDni(numericOnly);
  };

  const openOnpeAssisted = (dniToCopy?: string) => {
    const value = dniToCopy ?? dni.trim();
    const hasValidDni = value.length === 8;

    if (hasValidDni && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => {
        setCopiedDni(true);
        setTimeout(() => setCopiedDni(false), 3000);
      }).catch(() => {});
      showToast('¡DNI copiado! Pégalo (Ctrl + V / Pegar) en la casilla de la ONPE.');
    } else if (value.length > 0 && value.length < 8) {
      showToast('El DNI tiene menos de 8 dígitos. Puedes pegarlo manualmente en la web oficial.');
    } else {
      showToast('Abriendo consulta oficial de la ONPE...');
    }

    // Centrado de ventana inteligente (1050x760 en desktop, o popup/nueva pestaña)
    const width = 1050;
    const height = 760;
    const left = typeof window !== 'undefined' ? Math.max(0, (window.screen.width - width) / 2) : 100;
    const top = typeof window !== 'undefined' ? Math.max(0, (window.screen.height - height) / 2) : 100;
    const features = `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes,status=yes,toolbar=no,menubar=no`;

    try {
      // Intentar abrir como ventana emergente (popup)
      const popup = window.open(ONPE_OFFICIAL_URL, 'ConsultaElectoralONPE', features);
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.open(ONPE_OFFICIAL_URL, '_blank');
      } else {
        popup.focus();
      }
    } catch {
      window.open(ONPE_OFFICIAL_URL, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://karenacevedo.com/consulta';
    const text = `🇵🇪 *Consulta tu Local de Votación y si eres Miembro de Mesa (ONPE)*:\n\nIngresa tu DNI de forma fácil aquí 👉 ${url}\n\nConoce además las propuestas de Karen Acevedo para el desarrollo y seguridad de Chaclacayo.`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyPageLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://karenacevedo.com/consulta';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleNativeShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://karenacevedo.com/consulta';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Consulta tu Local de Votación y Miembro de Mesa',
          text: 'Ingresa tu DNI para consultar tu local de sufragio y miembro de mesa en la ONPE.',
          url,
        });
      } catch {
        // Cancelado por el usuario
      }
    } else {
      handleCopyPageLink();
    }
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="bg-[#f8fafc] text-slate-900 min-h-screen overflow-x-hidden">
      {/* Toast Notification Flotante Inteligente para Móvil y Desktop */}
      {toastMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed top-20 sm:top-auto sm:bottom-24 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-md bg-slate-950/95 text-white p-4 rounded-2xl shadow-2xl border border-white/20 flex items-start gap-3 backdrop-blur-xl transition-all animate-in fade-in slide-in-from-top-4 sm:slide-in-from-bottom-5"
        >
          <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-full shrink-0 mt-0.5">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xs sm:text-sm font-medium leading-relaxed flex-grow">
            {toastMessage}
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── HERO SECTION & FORMULARIO ASISTIDO ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#061426] via-[#0b1f38] to-[#0f2744] text-white pt-6 pb-14 sm:py-16 md:py-24">
        {/* Glow de fondo decorativo */}
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[320px] sm:w-[600px] h-[300px] bg-[#0070C0] blur-[100px] sm:blur-[140px] rounded-full" />
          <div className="absolute top-10 right-0 w-[200px] sm:w-[300px] h-[200px] bg-rose-600 blur-[80px] sm:blur-[120px] rounded-full" />
        </div>

        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          {/* Badge institucional */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] sm:text-xs md:text-sm font-semibold text-rose-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Elecciones Generales y Municipales · ONPE Perú
            </div>
          </div>

          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-3 sm:mb-4 leading-[1.15]">
              Consulta tu <span className="text-[#ffcc00]">Local de Votación</span> y Miembro de Mesa
            </h1>
            <p className="text-xs sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed px-2">
              Ingresa tu DNI para copiarlo automáticamente y abrir la plataforma oficial de la ONPE en un solo toque.
            </p>
          </div>

          {/* Caja de consulta principal optimizada para celular */}
          <div className="max-w-xl mx-auto bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={dni}
                  onChange={handleDniChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openOnpeAssisted();
                  }}
                  placeholder="Número de DNI (8 dígitos)"
                  className="w-full pl-10 sm:pl-11 pr-14 sm:pr-16 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#0070C0] focus:ring-4 focus:ring-[#0070C0]/15 outline-none font-sans font-bold text-base sm:text-lg tracking-wider placeholder:tracking-normal placeholder:text-slate-400 placeholder:font-normal transition-all"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-md">
                  {dni.length}/8
                </span>
              </div>

              <button
                type="button"
                onClick={() => openOnpeAssisted()}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-heading font-bold text-sm sm:text-base px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Consultar Ahora</span>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Microinstrucción y estado para mobile */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] sm:text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-1.5 leading-snug">
                <ShieldCheck className="w-4 h-4 text-[#0070C0] shrink-0" />
                <span>Al presionar, tu DNI se copia solo para pegarlo en la ONPE.</span>
              </div>
              {dni.length === 8 && (
                <span className="font-bold text-emerald-600 flex items-center gap-1 shrink-0 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3.5 h-3.5" /> DNI listo
                </span>
              )}
            </div>
          </div>

          {/* Módulo de Compartir en Redes (Táctil amigable) */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="w-full sm:w-auto text-center text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 sm:mb-0 flex items-center justify-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Compartir con vecinos:
            </span>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPageLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── BANNER PUBLICITARIO CAMPAÑA KAREN ACEVEDO (100% Mobile Responsive) ── */}
      <section className="bg-gradient-to-r from-[#004f8a] via-[#0070C0] to-[#041c3a] text-white py-6 sm:py-8 border-y-4 border-[#ffcc00] shadow-md">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start lg:items-center justify-between gap-5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              {/* Foto de Karen */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-3 border-[#ffcc00] shadow-xl shrink-0 bg-white/10">
                <Image
                  src="/karen-oficial.webp"
                  alt="Karen Acevedo - Candidata Alcaldía Chaclacayo"
                  fill
                  sizes="96px"
                  className="object-cover object-top"
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[#ffcc00] bg-black/30 px-2.5 py-0.5 rounded-full mb-1">
                  <Sparkles className="w-3 h-3 text-[#ffcc00]" /> Fuerza Ciudadana Chaclacayo 2027
                </div>
                <h3 className="text-lg sm:text-2xl md:text-3xl font-heading font-black text-white leading-tight">
                  Este día cívico, elige un <span className="text-[#ffcc00]">Chaclacayo Seguro y Ordenado</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-100 max-w-xl mt-1 leading-relaxed">
                  Conoce a Karen Acevedo y las propuestas técnicas para proteger nuestras quebradas, modernizar serenazgo y ordenar el distrito.
                </p>
              </div>
            </div>

            {/* Botones de acción del banner */}
            <div className="flex flex-row w-full sm:w-auto items-center justify-center gap-2.5 shrink-0">
              <Link
                href="/plan"
                className="flex-1 sm:flex-none justify-center bg-[#ffcc00] text-[#041c3a] hover:bg-yellow-300 active:scale-95 font-heading font-bold px-5 py-2.5 sm:px-6 sm:py-3 rounded-full text-xs sm:text-sm shadow-md transition-all flex items-center gap-1"
              >
                <span>Plan de Gobierno</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/karen"
                className="flex-1 sm:flex-none justify-center bg-white/10 hover:bg-white/20 border border-white/30 text-white font-heading font-semibold px-4 py-2.5 sm:px-5 sm:py-3 rounded-full text-xs sm:text-sm transition-all"
              >
                Conoce a Karen
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PASOS RÁPIDOS PARA CONSULTAR EN CELULARES ── */}
      <section className="py-8 bg-slate-100/70 border-b border-slate-200">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0070C0] font-black text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <p className="text-xs text-slate-700 font-medium">
                Escribe tu DNI y presiona <strong>Consultar Ahora</strong>.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-black text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <p className="text-xs text-slate-700 font-medium">
                Tu DNI se copia solo; dale <strong>Pegar</strong> en la web de ONPE.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <p className="text-xs text-slate-700 font-medium">
                Revisa tu aula, mesa y si saliste como <strong>Miembro de Mesa</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TARJETAS INFORMATIVAS DE ALTO VALOR ── */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-2 sm:mb-3">
              Guía Ciudadana para la Jornada Electoral
            </h2>
            <p className="text-slate-600 text-xs sm:text-base leading-relaxed">
              Todo lo que necesitas saber sobre tu rol como elector o miembro de mesa oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1: Miembros de Mesa */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs hover:shadow-md border border-slate-200 transition-all flex flex-col">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-[#0070C0] flex items-center justify-center mb-4 font-bold">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Miembros de Mesa</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 flex-grow">
                Se eligen 3 titulares (Presidente, Secretario y Tercer Miembro) y 3 suplentes. Son la máxima autoridad de la mesa durante el sufragio y escrutinio.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-[#0070C0]">
                <Clock className="w-4 h-4 shrink-0" /> Presentación: 6:00 a. m.
              </div>
            </div>

            {/* Card 2: Local de Votación */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs hover:shadow-md border border-slate-200 transition-all flex flex-col">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 font-bold">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Local y Aula de Votación</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 flex-grow">
                En la plataforma de la ONPE podrás ver la dirección exacta de tu colegio o local, tu número de mesa de sufragio, pabellón y piso correspondiente.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <FileCheck className="w-4 h-4 shrink-0" /> Anota tu número de mesa
              </div>
            </div>

            {/* Card 3: Compensación Económica */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs hover:shadow-md border border-slate-200 transition-all flex flex-col sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 font-bold">
                <Coins className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Pago Oficial S/ 120</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 flex-grow">
                Los miembros de mesa que instalen y conduzcan la votación hasta el escrutinio final reciben la compensación económica de S/ 120 otorgada por la ONPE.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-amber-700">
                <ShieldCheck className="w-4 h-4 shrink-0" /> Cobro por Yape, cuenta o BN
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREGUNTAS FRECUENTES (FAQ) ── */}
      <section className="py-12 sm:py-16 bg-white border-t border-slate-200 pb-28 sm:pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-[#0070C0]" /> Preguntas Frecuentes
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900">
              Dudas Comunes sobre las Elecciones
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {FAQ_DATA.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={faq.question}
                  className="rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 font-heading font-bold text-sm sm:text-base text-slate-900 hover:text-[#0070C0] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#0070C0]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA Inferior de Consulta */}
          <div className="mt-8 sm:mt-12 text-center p-6 sm:p-8 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-200">
            <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-1.5">
              ¿Listo para consultar tus datos oficiales?
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm mb-4 max-w-md mx-auto">
              Accede a la plataforma oficial de la ONPE ahora mismo con tu número de DNI.
            </p>
            <button
              type="button"
              onClick={() => openOnpeAssisted()}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-heading font-bold text-xs sm:text-sm px-7 py-3 rounded-full shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <span>Abrir Consulta Oficial ONPE</span>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
