'use client';

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Download, Search, Users, Loader2, PhoneCall } from "lucide-react";

type Voluntario = {
  id: string;
  nombre: string;
  telefono: string;
  dni: string;
  zona: string;
  ayuda: string;
  estado?: string;
  fecha: any;
};

export default function DashboardPage() {
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "voluntarios"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Voluntario[];
      setVoluntarios(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredVoluntarios = voluntarios.filter(v => 
    v.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.telefono?.includes(searchTerm) ||
    v.dni?.includes(searchTerm) ||
    v.zona?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const volRef = doc(db, "voluntarios", id);
      await updateDoc(volRef, { estado: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar el estado");
    }
  };

  const getTipoAyudaLabel = (ayuda: string) => {
    switch (ayuda) {
      case 'difusion': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">📱 Difusión</span>;
      case 'voluntariado': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">🚶‍♂️ Calle</span>;
      case 'personero': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">🗳️ Personero</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">Otro</span>;
    }
  };

  const formatZona = (zona: string) => {
    if (!zona) return "No especificada";
    return zona;
  };

  const getStatusColor = (estado?: string) => {
    switch(estado) {
      case 'contactado': return 'bg-green-100 text-green-700 border-green-200';
      case 'rechazado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // pendiente
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-dark mb-2">Base de Voluntarios</h1>
          <p className="text-text">Gestiona los ciudadanos que se han inscrito para ayudar en la campaña.</p>
        </div>
        <button className="flex items-center gap-2 bg-secondary text-dark font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-400 transition-all shadow-sm">
          <Download size={18} /> Exportar CSV
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-primary/10 p-4 rounded-xl text-primary">
            <Users size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Inscritos</p>
            <p className="text-3xl font-black text-dark">{voluntarios.length}</p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-dark">Últimos Registros</h2>
          
          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o celular..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Voluntario</th>
                <th className="p-4 font-bold">Contacto</th>
                <th className="p-4 font-bold">Zona</th>
                <th className="p-4 font-bold">Tipo de Ayuda</th>
                <th className="p-4 font-bold">Estado</th>
                <th className="p-4 font-bold text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Cargando datos...
                  </td>
                </tr>
              ) : filteredVoluntarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No se encontraron voluntarios.
                  </td>
                </tr>
              ) : (
                filteredVoluntarios.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-dark">{v.nombre}</div>
                      <div className="text-xs text-gray-500 font-mono">DNI: {v.dni || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <a href={`https://wa.me/51${v.telefono}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                        {v.telefono}
                      </a>
                    </td>
                    <td className="p-4 text-sm text-dark">
                      {formatZona(v.zona)}
                    </td>
                    <td className="p-4">
                      {getTipoAyudaLabel(v.ayuda)}
                    </td>
                    <td className="p-4">
                      <select 
                        value={v.estado || 'pendiente'}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer appearance-none ${getStatusColor(v.estado)}`}
                      >
                        <option value="pendiente">⏳ Pendiente</option>
                        <option value="contactado">✅ Contactado</option>
                        <option value="rechazado">❌ Descartado</option>
                      </select>
                    </td>
                    <td className="p-4 text-xs text-gray-500 text-right">
                      {v.fecha ? new Date(v.fecha.seconds * 1000).toLocaleDateString('es-PE') : 'Reciente'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
