'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Users, UserPlus, Search, ShieldCheck, MapPin, Loader2, X } from 'lucide-react';
import { electoralService, LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';

export default function GestionPersonerosPage() {
  const [personeros, setPersoneros] = useState<any[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [locales, setLocales] = useState<LocalVotacion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modales
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [selectedPersonero, setSelectedPersonero] = useState<any>(null);

  // Formularios
  const [nuevoForm, setNuevoForm] = useState({ nombre: '', dni: '', telefono: '', contrasena: '' });
  const [asignarForm, setAsignarForm] = useState({ local_id: '', mesa_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Conectar con Firebase en tiempo real
  useEffect(() => {
    const unsubLocales = electoralService.subscribeToLocales(setLocales);
    const unsubMesas = electoralService.subscribeToMesas(setMesas);
    const unsubPersoneros = electoralService.getPersoneros((data) => {
      setPersoneros(data);
      setLoading(false);
    });

    return () => {
      unsubLocales();
      unsubMesas();
      unsubPersoneros();
    };
  }, []);

  const getMesaAsignada = (uid: string) => {
    return mesas.find(m => m.personero_uid === uid);
  };

  const getLocalInfo = (localId: string) => {
    return locales.find(l => l.id === localId);
  };

  const filteredPersoneros = personeros.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.dni?.includes(searchTerm)
  );

  const asignadosCount = personeros.filter(p => getMesaAsignada(p.uid)).length;

  const handleCrearPersonero = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await electoralService.crearPersonero(nuevoForm);
      setShowNuevoModal(false);
      setNuevoForm({ nombre: '', dni: '', telefono: '', contrasena: '' });
      alert("Personero creado exitosamente.");
    } catch (error: any) {
      alert("Error al crear personero: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAsignarMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignarForm.mesa_id || !selectedPersonero) return;
    
    setIsSubmitting(true);
    try {
      await electoralService.asignarMesa(asignarForm.mesa_id, selectedPersonero.uid);
      setShowAsignarModal(false);
      alert("Mesa asignada correctamente.");
    } catch (error: any) {
      alert("Error al asignar mesa: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAsignarModal = (personero: any) => {
    setSelectedPersonero(personero);
    const mesaActual = getMesaAsignada(personero.uid);
    if (mesaActual) {
      setAsignarForm({ local_id: mesaActual.local_id, mesa_id: mesaActual.id });
    } else {
      setAsignarForm({ local_id: '', mesa_id: '' });
    }
    setShowAsignarModal(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Gestión de Personeros</h1>
          <p className="text-slate-500">Asigna y administra a los responsables de cada mesa de sufragio.</p>
        </div>
        <Button onClick={() => setShowNuevoModal(true)} className="bg-blue-600 hover:bg-blue-700 flex gap-2 shadow-sm">
          <UserPlus size={18} />
          Nuevo Personero
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Registrados</p>
                  <h3 className="text-2xl font-bold">{personeros.length}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Asignados a Mesa</p>
                  <h3 className="text-2xl font-bold">{asignadosCount}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Falta Asignar</p>
                  <h3 className="text-2xl font-bold">{personeros.length - asignadosCount}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <CardTitle className="text-lg">Directorio de Personeros</CardTitle>
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre o DNI..." 
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Nombre y DNI</th>
                      <th className="px-6 py-4 font-semibold">Contacto</th>
                      <th className="px-6 py-4 font-semibold">Local y Mesa</th>
                      <th className="px-6 py-4 font-semibold">Estado</th>
                      <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersoneros.map((personero) => {
                      const mesaAsignada = getMesaAsignada(personero.uid);
                      const localInfo = mesaAsignada ? getLocalInfo(mesaAsignada.local_id) : null;
                      const isAsignado = !!mesaAsignada;

                      return (
                        <tr key={personero.uid} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{personero.nombre}</div>
                            <div className="text-xs text-slate-500">DNI: {personero.dni}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600">{personero.telefono || '-'}</div>
                          </td>
                          <td className="px-6 py-4">
                            {isAsignado ? (
                              <>
                                <div className="font-medium text-slate-800">{localInfo?.nombre}</div>
                                <div className="text-xs text-slate-500">Mesa: <span className="font-bold text-slate-700">{mesaAsignada.numero}</span></div>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">No asignado</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isAsignado ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                Asignado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button onClick={() => openAsignarModal(personero)} variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                              {isAsignado ? 'Cambiar Mesa' : 'Asignar Mesa'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {filteredPersoneros.length === 0 && (
                  <div className="text-center py-10 text-slate-500">
                    No hay personeros registrados que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Nuevo Personero */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-lg">Registrar Personero</h3>
              <button onClick={() => setShowNuevoModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCrearPersonero} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre Completo</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 text-sm" value={nuevoForm.nombre} onChange={(e) => setNuevoForm({...nuevoForm, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">DNI</label>
                <input required type="text" maxLength={8} className="w-full border rounded-lg p-2.5 text-sm" value={nuevoForm.dni} onChange={(e) => setNuevoForm({...nuevoForm, dni: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Celular</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 text-sm" value={nuevoForm.telefono} onChange={(e) => setNuevoForm({...nuevoForm, telefono: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Contraseña por defecto</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 text-sm" value={nuevoForm.contrasena} onChange={(e) => setNuevoForm({...nuevoForm, contrasena: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowNuevoModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Cuenta'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Mesa */}
      {showAsignarModal && selectedPersonero && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-lg">Asignar Mesa</h3>
              <button onClick={() => setShowAsignarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 p-4 border-b">
              <p className="text-sm font-medium">{selectedPersonero.nombre}</p>
              <p className="text-xs text-slate-500">DNI: {selectedPersonero.dni}</p>
            </div>
            <form onSubmit={handleAsignarMesa} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Local de Votación</label>
                <select 
                  required 
                  className="w-full border rounded-lg p-2.5 text-sm" 
                  value={asignarForm.local_id} 
                  onChange={(e) => setAsignarForm({ local_id: e.target.value, mesa_id: '' })}
                >
                  <option value="">Seleccione un colegio...</option>
                  {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Mesa de Sufragio</label>
                <select 
                  required 
                  disabled={!asignarForm.local_id}
                  className="w-full border rounded-lg p-2.5 text-sm disabled:bg-slate-100" 
                  value={asignarForm.mesa_id} 
                  onChange={(e) => setAsignarForm({ ...asignarForm, mesa_id: e.target.value })}
                >
                  <option value="">Seleccione una mesa...</option>
                  {mesas.filter(m => m.local_id === asignarForm.local_id).map(m => (
                    <option key={m.id} value={m.id}>Mesa {m.numero} {m.personero_uid && m.personero_uid !== selectedPersonero.uid ? '(Ocupada)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowAsignarModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || !asignarForm.mesa_id} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Asignación'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
