'use client';

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useContactConfig } from "@/lib/firebase/use-contact-config";

export default function UneteForm() {
  const { whatsapp, correo } = useContactConfig();
  const [showExtended, setShowExtended] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    dni: "",
    zona: "",
    ayuda: "difusion"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addDoc(collection(db, "voluntarios"), {
        ...formData,
        estado: "pendiente",
        fecha: serverTimestamp(),
      });
      
      setSubmitted(true);
      setFormData({ nombre: "", telefono: "", dni: "", zona: "", ayuda: "difusion" });
    } catch (error) {
      console.error("Error guardando datos: ", error);
      alert("Hubo un problema de conexión. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  return (
    <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-xl border border-gray-100">
      <h3 className="text-[32px] font-heading font-bold text-[#003366] mb-6 text-center leading-tight">Regístrate en la<br/>campaña</h3>
      
      {submitted ? (
        <div className="bg-[#f8fafc] border border-gray-100 rounded-3xl p-8 text-left animate-in fade-in duration-500">
          <h2 className="text-[40px] leading-tight font-heading font-black mb-6 text-dark tracking-tighter">
            ¡Sé parte del<br/>
            <span className="text-[#0070c0]">cambio!</span>
          </h2>
          
          <p className="text-[#4b5563] text-lg font-heading leading-relaxed mb-6">
            La municipalidad no debe limitarse a administrar trámites o responder emergencias; debe construir condiciones para una vida mejor para todos los vecinos.
          </p>
          
          <p className="text-dark text-lg font-heading font-bold mb-8">
            Si quieres un Chaclacayo diferente, necesitamos tus manos.
          </p>
          
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-[#1cd464] text-white font-heading font-bold text-lg py-4 px-8 rounded-full hover:bg-[#18b856] transition-colors w-full sm:w-auto mb-8"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
            Únete al WhatsApp Oficial
          </a>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <h4 className="font-heading font-black text-dark text-lg mb-1">¿Dudas?</h4>
            <p className="text-[#4b5563] text-sm">
              Escríbenos directamente a <a href={`mailto:${correo}`} className="text-[#0070c0] hover:underline">{correo}</a>
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="nombre" className="block text-sm font-bold text-[#003366] mb-1">Nombre y Apellidos</label>
            <input 
              type="text" 
              id="nombre" 
              required 
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-[#f8fafc] text-dark"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          
          <div>
            <label htmlFor="telefono" className="block text-sm font-bold text-[#003366] mb-1">Celular / WhatsApp</label>
            <input 
              type="tel" 
              id="telefono" 
              required 
              value={formData.telefono}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-[#f8fafc] text-dark"
              placeholder="999 888 777"
            />
          </div>
          
          {!showExtended && (
            <div className="text-center pt-2 pb-2">
              <button 
                type="button" 
                onClick={() => setShowExtended(true)}
                className="text-primary-dark font-semibold text-sm hover:underline"
              >
                Ver más opciones (Voluntariado) ↓
              </button>
            </div>
          )}

          {showExtended && (
            <div className="space-y-5 animate-in slide-in-from-top-4 fade-in duration-300">
              <div>
                <label htmlFor="dni" className="block text-sm font-bold text-dark mb-1">DNI (Opcional)</label>
                <input 
                  type="number" 
                  id="dni" 
                  value={formData.dni}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-[#f8fafc]"
                  placeholder="Ingresa tu DNI"
                />
              </div>
              
              <div>
                <label htmlFor="zona" className="block text-sm font-bold text-dark mb-1">¿De qué zona de Chaclacayo eres?</label>
                <select 
                  id="zona" 
                  value={formData.zona}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-[#f8fafc]"
                >
                  <option value="">Selecciona tu zona...</option>
                  <option value="Chaclacayo Centro">Chaclacayo Centro</option>
                  <option value="Morón / Virgen de Fátima">Morón / Virgen de Fátima</option>
                  <option value="Huascata / Cerro Vecino">Huascata / Cerro Vecino</option>
                  <option value="Miguel Grau">Miguel Grau</option>
                  <option value="Ñaña / Cultura y Progreso">Ñaña / Cultura y Progreso</option>
                  <option value="El Cuadro / Los Halcones">El Cuadro / Los Halcones</option>
                  <option value="San Bartolomé / Fundo El Monte">San Bartolomé / Fundo El Monte</option>
                  <option value="Los Cedros / Villa El Rosario">Los Cedros / Villa El Rosario</option>
                  <option value="Santa Inés">Santa Inés (Alta/Baja)</option>
                  <option value="Huascarán / Valle Hermoso">Huascarán / Valle Hermoso</option>
                  <option value="Los Cipreses / Zarumilla">Los Cipreses / Zarumilla</option>
                  <option value="Otra Zona">Otra asociación o zona</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="ayuda" className="block text-sm font-bold text-dark mb-1">¿Cómo te gustaría ayudar?</label>
                <select 
                  id="ayuda" 
                  value={formData.ayuda}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-[#f8fafc]"
                >
                  <option value="difusion">📱 Difusión Digital (Redes Sociales)</option>
                  <option value="voluntariado">🚶‍♂️ Voluntariado en Calle / Caminatas</option>
                  <option value="personero">🗳️ Personero de Mesa (Día de elección)</option>
                </select>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#ffcc00] text-[#003366] font-heading font-bold py-4 rounded-xl hover:bg-yellow-400 transition-colors mt-2 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
          >
            {loading ? <><Loader2 size={20} className="animate-spin" /> Enviando...</> : "Sumarme Ahora"}
          </button>
          
          <p className="text-center text-[#9ca3af] text-[12px] leading-tight px-4 pt-2 font-medium">
            Tus datos están seguros y serán usados únicamente para fines de comunicación de la campaña según la ley de protección de datos.
          </p>
        </form>
      )}
    </div>
  );
}
