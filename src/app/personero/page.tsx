'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle2, Camera, LogOut, Send, Loader2 } from 'lucide-react';

export default function PersoneroApp() {
  const [paso, setPaso] = useState(1);
  const [formData, setFormData] = useState({
    votosA: '',
    votosB: '',
    votosBlancos: '',
    votosNulos: ''
  });
  const [fotoActa, setFotoActa] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mock Data
  const mesaInfo = {
    numero: '045012',
    local: 'I.E. 1188 Juan Pablo II',
    zona: 'Huascata'
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Compresión de imagen a WebP
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Redimensionar si es muy grande (max 1200px de ancho)
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Comprimir a WebP (0.7 quality)
        canvas.toBlob((blob) => {
          if (blob) {
            const webpFile = new File([blob], 'acta.webp', { type: 'image/webp' });
            setFotoActa(webpFile);
            setFotoPreview(URL.createObjectURL(webpFile));
            setIsCompressing(false);
          }
        }, 'image/webp', 0.7);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoActa) {
      alert("Por favor, toma una foto del acta antes de enviar.");
      return;
    }
    // Aquí irá la lógica para subir `fotoActa` a Storage y llamar a guardarActa()
    setPaso(3); // Pasar a vista de éxito
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-lg">App Personero</h1>
          <p className="text-xs text-blue-100">Hola, Juan Pérez</p>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700 rounded-full h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full pb-20">
        
        {paso === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
              <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Tu Mesa Asignada</p>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Mesa {mesaInfo.numero}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                {mesaInfo.local} ({mesaInfo.zona})
              </div>
            </div>

            <Button size="lg" className="w-full h-16 text-lg font-bold shadow-lg bg-blue-600 hover:bg-blue-700" onClick={() => setPaso(2)}>
              Ingresar Resultados
            </Button>
            
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg mt-8">
              <h3 className="font-semibold text-orange-800 text-sm mb-1">⚠️ Importante</h3>
              <p className="text-xs text-orange-700">Asegúrate de tener una buena foto del acta antes de enviar los resultados. Los números deben coincidir exactamente.</p>
            </div>
          </div>
        )}

        {paso === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg">Resultados Mesa {mesaInfo.numero}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPaso(1)}>Volver</Button>
            </div>

            <Card className="border-blue-200 shadow-md">
              <CardHeader className="bg-blue-50/50 pb-3">
                <CardTitle className="text-base text-blue-800">1. Votos Válidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="font-semibold text-slate-700 flex-1">Tu Partido (A)</label>
                  <input type="number" required min="0" name="votosA" value={formData.votosA} onChange={handleInputChange} className="w-24 text-center text-xl font-bold p-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-0 outline-none" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="font-semibold text-slate-700 flex-1">Partido Rival (B)</label>
                  <input type="number" required min="0" name="votosB" value={formData.votosB} onChange={handleInputChange} className="w-24 text-center text-xl font-bold p-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-0 outline-none" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Otros Votos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-slate-600 flex-1">Votos Blancos</label>
                  <input type="number" required min="0" name="votosBlancos" value={formData.votosBlancos} onChange={handleInputChange} className="w-24 text-center text-lg p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-slate-600 flex-1">Votos Nulos</label>
                  <input type="number" required min="0" name="votosNulos" value={formData.votosNulos} onChange={handleInputChange} className="w-24 text-center text-lg p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">3. Evidencia Fotográfica</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={fileInputRef} 
                  onChange={handleCapture} 
                  className="hidden" 
                />
                {!fotoPreview ? (
                  <Button type="button" variant="outline" className="w-full h-16 border-dashed border-2 flex gap-2" onClick={() => fileInputRef.current?.click()} disabled={isCompressing}>
                    {isCompressing ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : <Camera className="h-5 w-5 text-slate-500" />}
                    <span className="text-slate-600">{isCompressing ? 'Optimizando imagen...' : 'Tomar foto al Acta'}</span>
                  </Button>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoPreview} alt="Acta" className="w-full h-auto" />
                    <Button type="button" size="sm" variant="secondary" className="absolute bottom-2 right-2 shadow-md" onClick={() => fileInputRef.current?.click()}>
                      Tomar otra
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 flex gap-2" disabled={!fotoActa}>
              <Send className="h-5 w-5" /> Enviar Resultados
            </Button>
          </form>
        )}

        {paso === 3 && (
          <div className="text-center py-12 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Misión Cumplida!</h2>
            <p className="text-slate-500 mb-8 px-4">Los resultados de la mesa {mesaInfo.numero} han sido enviados exitosamente a la central.</p>
            <Button variant="outline" onClick={() => setPaso(1)}>Volver al inicio</Button>
          </div>
        )}
      </main>
    </div>
  );
}
