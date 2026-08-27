'use client';

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Calendar, MapPin, Share2, MessageCircle, Camera, Music, Loader2, Download, Repeat2, ExternalLink } from "lucide-react";
import { agendaService } from "@/lib/firebase/agenda-service";
import type { ActividadAgenda } from "@/lib/firebase/types";

const STICKER_PACK_URL = 'https://sticker.ly/s/5ZP3MN';
const STICKERS = [1, 2, 3, 4].map((number) => ({
  src: `/stickers/karen-acevedo/sticker-${String(number).padStart(2, '0')}.webp`,
  alt: `Sticker oficial de Karin Acevedo ${number}`,
}));

export default function MovimientoPage() {
  const [actividades, setActividades] = useState<ActividadAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Intentar forzar la reproducción automática al montar el componente
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("El navegador bloqueó el autoplay:", e));
    }
  }, []);

  useEffect(() => {
    // Suscripción en tiempo real a la agenda para la web pública
    const unsubscribe = agendaService.subscribe(
      (data) => {
        setActividades(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <section className="bg-gradient-to-r from-slate-100 to-slate-200 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl mb-4 text-dark">La campaña <span className="text-primary-dark">está en la calle</span></h1>
          <p className="text-xl max-w-2xl mx-auto text-text">
            Acompáñanos en nuestras actividades semanales y descárgate el material para apoyarnos en el mundo digital.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* Agenda */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <Calendar className="text-primary-dark" size={32} />
                <h2 className="text-3xl text-dark m-0">Agenda de Actividades</h2>
              </div>
              
              <div className="space-y-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white border border-slate-200 rounded-2xl">
                    <Loader2 size={32} className="animate-spin mb-4 text-primary" />
                    <p>Cargando agenda de actividades...</p>
                  </div>
                ) : actividades.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                    <p className="text-dark font-bold text-lg mb-2">No hay actividades programadas</p>
                    <p className="text-text">Mantente atento a nuestras redes para próximos eventos.</p>
                  </div>
                ) : (
                  actividades.map((act) => (
                    <div key={act.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow">
                      <div className="bg-dark text-white rounded-xl w-20 h-20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-semibold uppercase text-secondary">{act.etiqueta}</span>
                        <span className="text-lg font-bold">{act.fechaDestacada}</span>
                      </div>
                      <div>
                        <h3 className="text-xl text-dark mb-2 font-bold">{act.titulo}</h3>
                        <p className="text-text text-sm mb-3">{act.descripcion}</p>
                        <div className="flex items-center gap-2 text-primary-dark font-semibold text-sm">
                          <MapPin size={16} className="shrink-0" />
                          <span>{act.ubicacion}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Kit Digital */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <Share2 className="text-primary-dark" size={32} />
                <h2 className="text-3xl text-dark m-0">Kit Digital</h2>
              </div>
              <p className="text-text mb-8">
                Haz campaña desde tu celular. Las elecciones se ganan sumando a más vecinos cada día. ¡Descarga y comparte en tus redes!
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <article className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <div className="grid grid-cols-4 gap-1.5" aria-label="Vista previa del paquete de stickers">
                    {STICKERS.map((sticker) => (
                      <div key={sticker.src} className="aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-emerald-100">
                        <Image
                          src={sticker.src}
                          alt={sticker.alt}
                          width={96}
                          height={96}
                          className="h-full w-full object-contain p-1"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-dark">
                    <MessageCircle size={22} className="shrink-0 text-emerald-600" />
                    <h3 className="font-bold">Stickers de WhatsApp</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text">
                    Abre el paquete oficial en Sticker.ly y agrégalo a WhatsApp.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <a
                      href={STICKER_PACK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Agregar a WhatsApp <ExternalLink size={16} />
                    </a>
                    <a
                      href="/stickers/karen-acevedo/stickers-karen-acevedo.zip"
                      download="stickers-karen-acevedo.zip"
                      className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      Descargar paquete ZIP <Download size={14} />
                    </a>
                  </div>
                </article>

                <button type="button" disabled title="Próximamente" className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8 opacity-70 cursor-not-allowed group">
                  <Camera size={40} className="text-secondary mb-4 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-dark">Stories para IG</span>
                  <span className="text-xs text-text mt-2">Próximamente</span>
                </button>

                <div className="sm:col-span-2 flex flex-col gap-4">
                  <a 
                    href="/jingle-karen-acevedo-2027.mp3" 
                    download="jingle-karen-acevedo-2027.mp3"
                    className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-primary hover:bg-primary/5 transition-colors group relative"
                  >
                    <Music size={40} className="text-primary-dark mb-4 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-dark flex items-center gap-2">
                      Jingle Oficial (MP3) <Download size={16} className="text-primary"/>
                    </span>
                    <span className="text-xs text-text mt-2">&quot;Fuerza Chaclacayo&quot; - Clic para descargar</span>
                  </a>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-sm font-bold text-dark">Escuchar ahora:</span>
                    <audio 
                      ref={audioRef}
                      controls 
                      autoPlay
                      loop={loopEnabled}
                      src="/jingle-karen-acevedo-2027.mp3" 
                      className="w-full max-w-sm"
                    >
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                    <button
                      type="button"
                      aria-pressed={loopEnabled}
                      onClick={() => setLoopEnabled((enabled) => !enabled)}
                      className={`flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                        loopEnabled
                          ? 'border-primary/30 bg-primary/10 text-primary-dark'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-primary/30'
                      }`}
                    >
                      <Repeat2 size={16} />
                      Repetición automática: {loopEnabled ? 'activada' : 'desactivada'}
                    </button>
                    <span className="text-[11px] text-text">
                      Al terminar, el jingle volverá a comenzar automáticamente.
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
