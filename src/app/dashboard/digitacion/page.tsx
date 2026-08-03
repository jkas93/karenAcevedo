'use client';

import { useState, useMemo } from 'react';
import { useElectoral } from '@/lib/firebase/ElectoralContext';
import { electoralService } from '@/lib/firebase/electoral-service';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function DigitacionCentralPage() {
  const { locales, mesas, loading: globalLoading } = useElectoral();
  
  const [localSeleccionado, setLocalSeleccionado] = useState<string>('');
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('');
  
  const [votos, setVotos] = useState<Record<string, number>>({
    partido_a: 0,
    partido_b: 0,
    partido_c: 0,
    partido_d: 0,
    blancos: 0,
    nulos: 0,
  });
  
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // ─── Lógica de Filtros ──────────────────────────────────────────────────────

  // Las mesas disponibles para el local seleccionado que AÚN están pendientes
  const mesasDisponibles = useMemo(() => {
    if (!localSeleccionado) return [];
    return mesas
      .filter((m) => m.local_id === localSeleccionado && m.estado === 'pendiente')
      .sort((a, b) => a.numero.localeCompare(b.numero));
  }, [mesas, localSeleccionado]);

  // Total votos calculados en vivo para validación
  const totalVotosIngresados = Object.values(votos).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

  // ─── Manejadores de Eventos ─────────────────────────────────────────────────

  const handleVotoChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    setVotos((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const compressToWebp = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Conservar resolución original exacta
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error("No se pudo obtener el contexto del canvas"));
            return;
          }
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Comprimir a WebP con calidad 0.8
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Error al comprimir la imagen"));
              return;
            }
            const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(webpFile);
          }, 'image/webp', 0.8);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('La imagen es demasiado pesada. Máximo 10MB.');
        return;
      }
      
      try {
        setFotoPreview(null);
        setError('');
        // Comprimir a WEBP conservando resolución original
        const webpFile = await compressToWebp(file);
        setFotoArchivo(webpFile);
        setFotoPreview(URL.createObjectURL(webpFile));
      } catch (err) {
        console.error("Error al comprimir la imagen", err);
        setError('Error al procesar la imagen. Intenta con otra foto.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localSeleccionado || !mesaSeleccionada) {
      setError('Debes seleccionar un Local y una Mesa.');
      return;
    }
    if (!fotoArchivo) {
      setError('Es obligatorio adjuntar la foto del acta.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      // 1. Subir Foto (Si es muy pesada, el Firebase Storage lo maneja, pero en prod deberías comprimir)
      const fotoUrl = await electoralService.subirFotoActa(fotoArchivo, mesaSeleccionada);

      // 2. Guardar Acta
      await electoralService.guardarActa({
        mesa_id: mesaSeleccionada,
        votos_partido_a: votos.partido_a,
        votos_partido_b: votos.partido_b,
        votos_partido_c: votos.partido_c,
        votos_partido_d: votos.partido_d,
        votos_blancos: votos.blancos,
        votos_nulos: votos.nulos,
        foto_url: fotoUrl,
      });

      // 3. Resetear formulario tras éxito
      setSuccess(true);
      setMesaSeleccionada('');
      setVotos({ partido_a: 0, partido_b: 0, partido_c: 0, partido_d: 0, blancos: 0, nulos: 0 });
      setFotoArchivo(null);
      setFotoPreview(null);
      
      // Limpiar mensaje de éxito después de 4 segundos
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar el acta. Revisa tu conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (globalLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1 text-slate-800">Ingreso de Actas</h1>
        <p className="text-slate-500">Módulo de Centro de Cómputo. Selecciona el local, la mesa e ingresa los resultados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: Formulario de Selección y Resultados */}
        <div className="md:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">1. Selección de Mesa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Local de Votación</label>
                <select 
                  className="w-full border-slate-200 rounded-lg shadow-sm focus:border-primary focus:ring-primary"
                  value={localSeleccionado}
                  onChange={(e) => {
                    setLocalSeleccionado(e.target.value);
                    setMesaSeleccionada('');
                  }}
                  disabled={isSubmitting}
                >
                  <option value="">-- Seleccionar Local --</option>
                  {locales.map(local => (
                    <option key={local.id} value={local.id}>{local.nombre}</option>
                  ))}
                </select>
              </div>

              {localSeleccionado && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número de Mesa</label>
                  <select 
                    className="w-full border-slate-200 rounded-lg shadow-sm focus:border-primary focus:ring-primary disabled:bg-slate-50"
                    value={mesaSeleccionada}
                    onChange={(e) => setMesaSeleccionada(e.target.value)}
                    disabled={mesasDisponibles.length === 0 || isSubmitting}
                  >
                    <option value="">
                      {mesasDisponibles.length === 0 ? 'No hay mesas pendientes' : '-- Seleccionar Mesa --'}
                    </option>
                    {mesasDisponibles.map(mesa => (
                      <option key={mesa.id} value={mesa.id}>Mesa N° {mesa.numero}</option>
                    ))}
                  </select>
                  {mesasDisponibles.length === 0 && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Todas las actas de este colegio ya fueron ingresadas.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={!mesaSeleccionada ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">2. Resultados del Acta</CardTitle>
              <CardDescription>Ingresa los votos válidos, blancos y nulos exactamente como figuran en el acta física.</CardDescription>
            </CardHeader>
            <CardContent>
              <form id="acta-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* Votos Partidos */}
                <div className="grid grid-cols-2 gap-4">
                  {PARTIDOS_CHACLACAYO.map((partido, index) => {
                    const key = ['partido_a', 'partido_b', 'partido_c', 'partido_d'][index];
                    return (
                      <div key={partido.id} className="relative">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                          {partido.alias}
                        </label>
                        <div className="relative">
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-2 rounded-l-md" 
                            style={{ backgroundColor: partido.color }} 
                          />
                          <input 
                            type="number"
                            min="0"
                            required
                            className="w-full pl-6 border-slate-200 rounded-md font-bold text-lg focus:ring-primary focus:border-primary"
                            value={votos[key] === 0 ? '' : votos[key]}
                            onChange={(e) => handleVotoChange(key, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <hr className="my-4 border-slate-100" />

                {/* Votos Blancos y Nulos */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Votos Blancos</label>
                    <input 
                      type="number" min="0" required
                      className="w-full border-slate-200 rounded-md font-bold text-lg bg-slate-50 focus:bg-white"
                      value={votos.blancos === 0 ? '' : votos.blancos}
                      onChange={(e) => handleVotoChange('blancos', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Votos Nulos</label>
                    <input 
                      type="number" min="0" required
                      className="w-full border-slate-200 rounded-md font-bold text-lg bg-slate-50 focus:bg-white"
                      value={votos.nulos === 0 ? '' : votos.nulos}
                      onChange={(e) => handleVotoChange('nulos', e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 text-blue-900 p-3 rounded-lg flex justify-between items-center mt-2 border border-blue-100">
                  <span className="font-semibold text-sm">Total Votos Emitidos (Suma):</span>
                  <span className="font-black text-xl">{totalVotosIngresados}</span>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: Evidencia (Foto) y Botón de Enviar */}
        <div className="md:col-span-5 space-y-6">
          <Card className={!mesaSeleccionada ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">3. Evidencia (Foto)</CardTitle>
              <CardDescription>Sube la foto enviada por el responsable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                {fotoPreview ? (
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-slate-200">
                    <Image src={fotoPreview} alt="Acta" fill className="object-cover" />
                    <button 
                      type="button"
                      onClick={() => { setFotoArchivo(null); setFotoPreview(null); }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg"
                    >
                      <AlertCircle size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 font-medium">Arrastra o selecciona la imagen del acta</p>
                    <p className="text-xs text-slate-400 mt-1">Formatos: JPG, PNG, WEBP (Max 5MB)</p>
                  </>
                )}
                
                {!fotoPreview && (
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    required
                  />
                )}
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex gap-2 items-start border border-red-100">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm flex gap-2 items-center border border-emerald-100 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p className="font-medium">¡Acta ingresada correctamente!</p>
                </div>
              )}

              <button
                type="submit"
                form="acta-form"
                disabled={isSubmitting || !fotoArchivo}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-md hover:shadow-lg disabled:shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Procesando Acta...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" /> Guardar Acta Definitiva
                  </>
                )}
              </button>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
