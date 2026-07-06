'use client';

import { useState, useEffect } from "react";
import { agendaService } from "@/lib/firebase/agenda-service";
import type { ActividadAgenda } from "@/lib/firebase/types";
import { Plus, Edit2, Trash2, Calendar, MapPin, Loader2, X } from "lucide-react";

export default function AgendaPage() {
  const [actividades, setActividades] = useState<ActividadAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    ubicacion: "",
    etiqueta: "Próx.",
    fechaDestacada: "",
  });

  useEffect(() => {
    const unsubscribe = agendaService.subscribe(
      (data) => {
        setActividades(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (actividad?: ActividadAgenda) => {
    if (actividad) {
      setEditingId(actividad.id);
      setFormData({
        titulo: actividad.titulo,
        descripcion: actividad.descripcion,
        ubicacion: actividad.ubicacion,
        etiqueta: actividad.etiqueta,
        fechaDestacada: actividad.fechaDestacada,
      });
    } else {
      setEditingId(null);
      setFormData({
        titulo: "",
        descripcion: "",
        ubicacion: "",
        etiqueta: "Próx.",
        fechaDestacada: new Date().getFullYear().toString(),
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await agendaService.actualizarActividad(editingId, formData);
      } else {
        await agendaService.crearActividad(formData);
      }
      handleCloseModal();
    } catch (error) {
      alert("Error al guardar la actividad");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar esta actividad?")) {
      try {
        await agendaService.eliminarActividad(id);
      } catch (error) {
        alert("Error al eliminar");
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-dark mb-2">Agenda de Actividades</h1>
          <p className="text-text">
            Administra los eventos públicos que aparecerán en la sección "Movimiento".
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:bg-primary-dark transition-all shadow-sm"
        >
          <Plus size={18} />
          Nueva Actividad
        </button>
      </header>

      {/* Lista de Actividades */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center text-gray-400">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : actividades.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-bold text-lg text-dark">No hay actividades programadas</p>
            <p className="text-sm">Agrega una nueva actividad para que los vecinos se enteren.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {actividades.map((act) => (
              <div key={act.id} className="p-6 flex flex-col sm:flex-row gap-6 hover:bg-slate-50 transition-colors group">
                <div className="bg-dark text-white rounded-xl w-20 h-20 flex flex-col items-center justify-center shrink-0">
                  <span className="text-sm font-semibold uppercase text-secondary">{act.etiqueta}</span>
                  <span className="text-lg font-bold">{act.fechaDestacada}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-dark mb-2">{act.titulo}</h3>
                  <p className="text-text text-sm mb-3">{act.descripcion}</p>
                  <div className="flex items-center gap-2 text-primary-dark font-semibold text-sm">
                    <MapPin size={16} />
                    <span>{act.ubicacion}</span>
                  </div>
                </div>
                <div className="flex gap-2 items-start opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenModal(act)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(act.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="font-black text-xl text-dark">
                {editingId ? "Editar Actividad" : "Nueva Actividad"}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-bold text-dark mb-1">Título de la actividad</label>
                <input
                  required
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej. Caminata por la Seguridad"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Descripción</label>
                <textarea
                  required
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej. Recorreremos las calles para..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Ubicación y Detalle</label>
                <input
                  required
                  type="text"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  placeholder="Ej. Parque Central — Fecha por confirmar"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-dark mb-1">Etiqueta Superior</label>
                  <input
                    required
                    type="text"
                    value={formData.etiqueta}
                    onChange={(e) => setFormData({ ...formData, etiqueta: e.target.value })}
                    placeholder="Ej. Próx."
                    maxLength={10}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark mb-1">Dato Central (Día/Año)</label>
                  <input
                    required
                    type="text"
                    value={formData.fechaDestacada}
                    onChange={(e) => setFormData({ ...formData, fechaDestacada: e.target.value })}
                    placeholder="Ej. 2027 o 15/10"
                    maxLength={10}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all text-center font-bold"
                  />
                </div>
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-center justify-center gap-3">
                <div className="bg-dark text-white rounded-xl w-16 h-16 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold uppercase text-secondary">{formData.etiqueta || '...'}</span>
                  <span className="text-sm font-bold">{formData.fechaDestacada || '...'}</span>
                </div>
                <div className="text-xs">
                  Así se verá el calendario de esta actividad en la web pública.
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50">
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? 'Guardar Cambios' : 'Crear Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
