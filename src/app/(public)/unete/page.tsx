'use client';

import { useState, useEffect } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function UnetePage() {
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

  const [whatsapp, setWhatsapp] = useState("51961858568");
  const [correo, setCorreo] = useState("voluntarios@fuerzaciudadana.pe");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "contacto"), (doc) => {
      if (doc.exists()) {
        if (doc.data().whatsapp) setWhatsapp(doc.data().whatsapp);
        if (doc.data().correo) setCorreo(doc.data().correo);
      }
    });
    return () => unsub();
  }, []);

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
      setTimeout(() => {
        setSubmitted(false);
        setShowExtended(false);
        setFormData({ nombre: "", telefono: "", dni: "", zona: "", ayuda: "difusion" });
      }, 5000);
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
    <div className="bg-slate-50 min-h-screen pt-12 pb-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Mensaje Inspirador */}
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl md:text-5xl text-dark mb-6">¡Sé parte del <span className="text-primary">cambio!</span></h1>
            <p className="text-lg text-text mb-8">
              La municipalidad no debe limitarse a administrar trámites o responder emergencias; debe construir condiciones para una vida mejor para todos los vecinos.
            </p>
            <p className="text-lg font-semibold text-dark mb-6">
              Si quieres un Chaclacayo diferente, necesitamos tus manos.
            </p>
            
            <a 
              href={`https://wa.me/${whatsapp}?text=Hola,%20quiero%20ser%20voluntario%20de%20la%20campa%C3%B1a%20de%20Karen%20Acevedo`} 
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto bg-[#25D366] text-white font-bold py-4 px-8 rounded-full hover:bg-[#1ebe57] transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <MessageCircle />
              Únete al WhatsApp Oficial
            </a>
            
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h4 className="font-bold text-dark mb-2">¿Dudas?</h4>
              <p className="text-text text-sm">Escríbenos directamente a <a href={`mailto:${correo}`} className="text-primary-dark hover:underline">{correo}</a></p>
            </div>
          </div>

          {/* Formulario (Escalera de Compromiso) */}
          <div className="order-1 lg:order-2">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100">
              <h3 className="text-2xl text-dark mb-6">Regístrate en la campaña</h3>
              
              {submitted ? (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-8 text-center animate-in fade-in duration-500">
                  <div className="text-5xl mb-4">✅</div>
                  <h4 className="text-xl font-bold mb-2">¡Gracias por sumarte!</h4>
                  <p>Hemos registrado tus datos. Un coordinador de Fuerza Ciudadana se comunicará contigo pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-bold text-dark mb-1">Nombres y Apellidos</label>
                    <input 
                      type="text" 
                      id="nombre" 
                      required 
                      value={formData.nombre}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="telefono" className="block text-sm font-bold text-dark mb-1">Celular / WhatsApp</label>
                    <input 
                      type="tel" 
                      id="telefono" 
                      required 
                      value={formData.telefono}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="999 888 777"
                    />
                  </div>
                  
                  {!showExtended && (
                    <div className="text-center pt-2 pb-4">
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          placeholder="Ingresa tu DNI"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="zona" className="block text-sm font-bold text-dark mb-1">¿De qué zona de Chaclacayo eres?</label>
                        <select 
                          id="zona" 
                          value={formData.zona}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
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
                    className="w-full flex items-center justify-center gap-2 bg-secondary text-dark font-heading font-bold py-4 rounded-xl hover:bg-yellow-400 transition-colors shadow-md mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <><Loader2 size={20} className="animate-spin" /> Enviando...</> : "Unirme al Equipo"}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
