'use client';

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { Download, Save, Loader2, Phone, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const router = useRouter();

  // Validate Role and Cargar configuración actual
  useEffect(() => {
    const init = async () => {
      try {
        if (!auth.currentUser) return;
        const email = auth.currentUser.email || "";
        const userDoc = await getDoc(doc(db, "usuarios", email));
        
        // Block simple 'usuario' from accessing configuration
        if (userDoc.exists() && userDoc.data().rol === "usuario") {
          router.push("/dashboard");
          return;
        }

        const docRef = doc(db, "config", "contacto");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setWhatsapp(docSnap.data().whatsapp || "");
          setCorreo(docSnap.data().correo || "");
        } else {
          // Valores por defecto si no existe
          setWhatsapp("51961858568");
          setCorreo("voluntarios@fuerzaciudadana.pe");
        }
      } catch (error) {
        console.error("Error loading config:", error);
      } finally {
        setLoadingConfig(false);
      }
    };
    
    init();
  }, [router]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });
    
    try {
      await setDoc(doc(db, "config", "contacto"), {
        whatsapp,
        correo
      });
      setMessage({ text: "✅ Configuración guardada correctamente. La web pública se ha actualizado.", type: "success" });
    } catch (error) {
      console.error("Error saving config:", error);
      setMessage({ text: "❌ Hubo un error al guardar.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const querySnapshot = await getDocs(collection(db, "voluntarios"));
      const voluntarios = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          Nombre: data.nombre || "",
          DNI: data.dni || "",
          Telefono: data.telefono || "",
          Zona: data.zona || "",
          Ayuda: data.ayuda || "",
          Fecha: data.fecha ? new Date(data.fecha.seconds * 1000).toLocaleString('es-PE') : ""
        };
      });

      if (voluntarios.length === 0) {
        alert("No hay voluntarios para exportar.");
        setExporting(false);
        return;
      }

      // Convertir a CSV
      const headers = Object.keys(voluntarios[0]);
      const csvRows = [];
      csvRows.push(headers.join(","));

      for (const row of voluntarios) {
        const values = headers.map(header => {
          const val = row[header as keyof typeof row];
          const escaped = ('' + val).replace(/"/g, '\\"');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(","));
      }

      const csvString = csvRows.join("\n");
      const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" }); // uFEFF is BOM for Excel UTF-8
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `Voluntarios_KarenAcevedo_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Hubo un error al generar el archivo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-dark mb-2">Configuración del Sistema</h1>
        <p className="text-text">Administra las variables globales y exporta los datos de la campaña.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Módulo: Exportación Masiva */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-xl font-bold text-dark mb-2">Exportación de Datos (Excel)</h2>
          <p className="text-text mb-6 text-sm">Descarga la base de datos completa de voluntarios inscritos en formato CSV, ideal para importar en Excel, sistemas de Call Center o plataformas de SMS/WhatsApp masivo.</p>
          
          <button 
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#107c41] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0c5f32] transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            {exporting ? "Generando archivo..." : "Descargar Padrón Completo (.csv)"}
          </button>
        </div>

        {/* Módulo: Variables Dinámicas */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-xl font-bold text-dark mb-2">Datos de Contacto Público</h2>
          <p className="text-text mb-6 text-sm">Estos son los números y correos hacia los que apuntan los botones de la página web (Footer, sección Únete). Al guardarlos aquí, la web pública cambiará automáticamente.</p>

          {loadingConfig ? (
            <div className="py-8 flex justify-center"><Loader2 size={30} className="animate-spin text-primary" /></div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6 max-w-lg">
              
              {message.text && (
                <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-dark mb-1">WhatsApp de Recepción</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Phone size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ej. 51999888777 (Incluir código de país sin +)"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Incluye el código de país (Ej: 51 para Perú) sin el símbolo +.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Correo Electrónico Oficial</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="voluntarios@fuerzaciudadana.pe"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-secondary text-dark font-bold px-8 py-3 rounded-xl hover:bg-yellow-400 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
