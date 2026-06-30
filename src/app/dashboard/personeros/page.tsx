'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Users, UserPlus, Search, ShieldCheck, Mail, MapPin, Loader2 } from 'lucide-react';
import { electoralService, LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';

export default function GestionPersonerosPage() {
  const [personeros, setPersoneros] = useState<any[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [locales, setLocales] = useState<LocalVotacion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Gestión de Personeros</h1>
          <p className="text-slate-500">Asigna y administra a los responsables de cada mesa de sufragio.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 flex gap-2 shadow-sm">
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
                            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
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
    </div>
  );
}
