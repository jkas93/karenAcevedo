import Image from "next/image";
import { Shield, Scale, Users, Heart, Lightbulb } from "lucide-react";

export default function KarenPage() {
  return (
    <div className="bg-white">
      {/* Hero Perfil */}
      <section className="bg-dark text-white py-20 mt-[-72px] pt-[140px]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image 
                  src="/karen-oficial.webp" 
                  alt="Fotografía de la candidata Karen Acevedo" 
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-top"
                />
              </div>
            </div>
            
            <div>
              <h1 className="text-4xl md:text-5xl mb-6">De vecina a <span className="text-secondary">Líder</span></h1>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Liderazgo con capacidad técnica y cercanía ciudadana para un distrito de 41,429 habitantes que merece una gestión seria, medible y orientada a resultados.
              </p>
              
              {/* Visión COMPLETA del plan (línea 197) */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                <h3 className="text-secondary font-bold text-sm uppercase tracking-wider mb-3">Visión de Ciudad al 2030</h3>
                <p className="text-lg text-gray-200 leading-relaxed italic">
                  &quot;Al 2030, Chaclacayo será un distrito ordenado, seguro, ecológico, saludable y atractivo para vivir, emprender y visitar; con mejor protección frente a huaycos e inundaciones, barrios integrados, espacio público recuperado, servicios municipales modernos y una gestión transparente que trabaje de la mano con la comunidad.&quot;
                </p>
              </div>
              
              <blockquote className="border-l-4 border-primary pl-6 py-2 bg-white/5 rounded-r-lg">
                <p className="text-base italic mb-2">&quot;La municipalidad no debe limitarse a administrar trámites; debe construir condiciones para una vida mejor, más segura, más digna y más ordenada para todos los vecinos de Chaclacayo.&quot;</p>
                <footer className="text-secondary font-bold">— Karen Acevedo</footer>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Principios (del plan, líneas 117-120) */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-dark">Principios <span className="text-primary-dark">Orientadores</span></h2>
            <p className="text-text mt-3 max-w-2xl mx-auto">Los valores que orientan cada decisión municipal y dan sentido al ejercicio del gobierno local.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Heart size={32} className="text-primary-dark" />
              </div>
              <h3 className="text-base font-bold mb-2 text-dark">Defensa de la Vida</h3>
              <p className="text-text text-sm">Priorizar prevención del riesgo, seguridad y bienestar.</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Scale size={32} className="text-primary-dark" />
              </div>
              <h3 className="text-base font-bold mb-2 text-dark">Transparencia</h3>
              <p className="text-text text-sm">Lucha frontal contra la corrupción y uso responsable de recursos.</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Users size={32} className="text-primary-dark" />
              </div>
              <h3 className="text-base font-bold mb-2 text-dark">Igualdad</h3>
              <p className="text-text text-sm">Mismas oportunidades y equidad territorial entre barrios.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Shield size={32} className="text-primary-dark" />
              </div>
              <h3 className="text-base font-bold mb-2 text-dark">Prevención</h3>
              <p className="text-text text-sm">Prioridad de la prevención frente a la improvisación.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Lightbulb size={32} className="text-primary-dark" />
              </div>
              <h3 className="text-base font-bold mb-2 text-dark">Modernización</h3>
              <p className="text-text text-sm">Servicio al ciudadano con tecnología, datos y participación.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trayectoria reforzada con datos del plan */}
      <section className="py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-dark">Trayectoria de <span className="text-primary">Servicio</span></h2>
          </div>
          
          <div className="relative border-l-4 border-slate-200 ml-6 md:ml-12">
            
            <div className="mb-12 relative pl-8">
              <div className="absolute left-[-11px] top-1 w-5 h-5 bg-secondary rounded-full border-4 border-dark z-10"></div>
              <span className="text-primary-dark font-bold text-lg">Conocimiento Territorial</span>
              <h4 className="text-dark text-lg mb-2 mt-1">Trabajo de Campo con las 6 Quebradas</h4>
              <p className="text-text">Años de experiencia trabajando directamente con juntas vecinales en las zonas de mayor vulnerabilidad del distrito: Huascarán, Los Cóndores, Cusipata, La Floresta, Alfonso Cobián y Santa Inés.</p>
            </div>

            <div className="mb-12 relative pl-8">
              <div className="absolute left-[-11px] top-1 w-5 h-5 bg-secondary rounded-full border-4 border-dark z-10"></div>
              <span className="text-primary-dark font-bold text-lg">Capacidad Técnica</span>
              <h4 className="text-dark text-lg mb-2 mt-1">Plan Maestro Basado en Evidencia</h4>
              <p className="text-text">Desarrollo de la primera Matriz de Desarrollo Distrital 4×4, un plan de gobierno con 16 intersecciones estratégicas, diagnóstico con línea de base, arquitectura VSM (Modelo de Sistema Viable) y viabilidad financiera documentada.</p>
            </div>

            <div className="mb-12 relative pl-8">
              <div className="absolute left-[-11px] top-1 w-5 h-5 bg-secondary rounded-full border-4 border-dark z-10"></div>
              <span className="text-primary-dark font-bold text-lg">Innovación Tecnológica</span>
              <h4 className="text-dark text-lg mb-2 mt-1">Ecosistema de Seguridad Digital</h4>
              <p className="text-text">Su equipo técnico ya diseñó y documentó el ecosistema Web-C3 (Centro de Comando), App VecinoChaclacayoSeguro y App PatrullajeChaclacayo con arquitectura en la nube (Cloud Firestore). No son promesas: es tecnología lista.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute left-[-11px] top-1 w-5 h-5 bg-secondary rounded-full border-4 border-dark z-10"></div>
              <span className="text-primary-dark font-bold text-lg">Candidatura 2027</span>
              <h4 className="text-dark text-lg mb-2 mt-1">Fuerza Ciudadana</h4>
              <p className="text-text">Karen Acevedo lidera la candidatura para transformar Chaclacayo con una gestión organizada, medible y orientada al vecino, donde cada decisión municipal tenga impacto real en la vida cotidiana.</p>
            </div>
            
          </div>
        </div>
      </section>

      {/* Modelo de Gestión - 5 Sistemas VSM */}
      <section className="py-20 bg-dark text-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <span className="bg-secondary/20 text-secondary px-4 py-1.5 rounded-full text-sm font-bold tracking-wide inline-block mb-4">
              MODELO DE GESTIÓN SISTÉMICA
            </span>
            <h2 className="text-3xl md:text-4xl mb-3">Una municipalidad que funciona como <span className="text-secondary">sistema</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Basado en el Modelo de Sistema Viable (VSM), cada propuesta tiene estructura: quién ejecuta, quién coordina, quién controla, quién analiza y quién decide.</p>
          </div>

          <div className="space-y-4">
            {[
              { num: "S1", name: "Operaciones", desc: "Serenazgo, gestión del riesgo, limpieza, programas sociales — las áreas que entregan valor directo al vecino.", color: "bg-primary" },
              { num: "S2", name: "Coordinación", desc: "Catastro, gobierno digital, mesa de partes, logística — los mecanismos que conectan áreas y evitan duplicidades.", color: "bg-primary/80" },
              { num: "S3", name: "Control", desc: "Seguimiento de metas, indicadores, control interno — asegurar que la acción opere con disciplina y eficiencia.", color: "bg-primary/60" },
              { num: "S4", name: "Inteligencia", desc: "Planeamiento territorial, análisis de datos, formulación de proyectos — anticiparse a los problemas.", color: "bg-primary/40" },
              { num: "S5", name: "Política y Valores", desc: "Alcaldía y Concejo: rumbo, integridad pública y fidelidad a la visión de distrito.", color: "bg-secondary text-dark" },
            ].map((s) => (
              <div key={s.num} className="flex items-stretch gap-4 bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:bg-white/10 transition-colors">
                <div className={`${s.color} flex items-center justify-center px-5 py-4 font-black text-lg shrink-0 min-w-[64px]`}>
                  {s.num}
                </div>
                <div className="py-4 pr-4">
                  <h4 className="font-bold text-white text-base">{s.name}</h4>
                  <p className="text-gray-400 text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
