'use client';

import { useState, useEffect } from "react";
import { Calendar, MapPin, Share2, MessageCircle, Camera, Music, Loader2 } from "lucide-react";
import { agendaService } from "@/lib/firebase/agenda-service";
import type { ActividadAgenda } from "@/lib/firebase/types";

export default function MovimientoPage() {
  const [actividades, setActividades] = useState<ActividadAgenda[]>([]);
  const [loading, setLoading] = useState(true);

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
                
                <button className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-primary hover:bg-primary/5 transition-colors group">
                  <MessageCircle size={40} className="text-primary mb-4 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-dark">Stickers de WhatsApp</span>
                  <span className="text-xs text-text mt-2">Pack de 10 stickers</span>
                </button>

                <button className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-primary hover:bg-primary/5 transition-colors group">
                  <Camera size={40} className="text-secondary mb-4 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-dark">Stories para IG</span>
                  <span className="text-xs text-text mt-2">Plantillas listas</span>
                </button>

                <button className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-primary hover:bg-primary/5 transition-colors group sm:col-span-2">
                  <Music size={40} className="text-primary-dark mb-4 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-dark">Jingle Oficial (MP3)</span>
                  <span className="text-xs text-text mt-2">&quot;Fuerza Chaclacayo&quot;</span>
                </button>

              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
