'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { 
  electoralService, 
  LocalVotacion, 
  Mesa, 
  Acta 
} from '@/lib/firebase/electoral-service';
import { MapPin, Users, CheckCircle2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Importar el mapa dinámicamente para evitar errores de SSR con Leaflet
const MapChaclacayo = dynamic(() => import('@/components/electoral/MapChaclacayo'), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">Cargando mapa...</div>
});

export default function ControlElectoralDashboard() {
  const [locales, setLocales] = useState<LocalVotacion[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Suscripciones en tiempo real a Firebase
    const unsubLocales = electoralService.subscribeToLocales((data) => {
      setLocales(data);
    });
    
    const unsubMesas = electoralService.subscribeToMesas((data) => {
      setMesas(data);
    });
    
    const unsubActas = electoralService.subscribeToActas((data) => {
      setActas(data);
    });

    setLoading(false);

    // Limpieza al desmontar el componente
    return () => {
      unsubLocales();
      unsubMesas();
      unsubActas();
    };
  }, []);

  // Cálculos estadísticos
  const totalMesas = mesas.length;
  const mesasEscrutadas = mesas.filter(m => m.estado === 'enviada').length;
  const porcentajeEscrutado = totalMesas > 0 ? ((mesasEscrutadas / totalMesas) * 100).toFixed(1) : '0.0';
  
  const votosA = actas.reduce((acc, curr) => acc + curr.votos_partido_a, 0);
  const votosB = actas.reduce((acc, curr) => acc + curr.votos_partido_b, 0);
  const votosBlancosNulos = actas.reduce((acc, curr) => acc + curr.votos_blancos + curr.votos_nulos, 0);
  const totalVotos = votosA + votosB + votosBlancosNulos;

  const porcentajeA = totalVotos > 0 ? ((votosA / totalVotos) * 100).toFixed(1) : '0.0';
  const porcentajeB = totalVotos > 0 ? ((votosB / totalVotos) * 100).toFixed(1) : '0.0';

  const chartData = [
    { name: 'Tu Partido', Votos: votosA, fill: '#2563eb' },
    { name: 'Partido Rival', Votos: votosB, fill: '#dc2626' },
    { name: 'Blancos/Nulos', Votos: votosBlancosNulos, fill: '#94a3b8' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Control Electoral - Día D</h1>
        <p className="text-slate-500">Monitoreo en tiempo real de mesas y resultados en Chaclacayo.</p>
      </div>

      {/* Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Escrutadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mesasEscrutadas} / {totalMesas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajeEscrutado}% del total de Chaclacayo
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${porcentajeEscrutado}%` }}></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 shadow-sm bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Tu Partido (1er Lugar)</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{votosA.toLocaleString()} votos</div>
            <p className="text-xs text-blue-600/80 mt-1">
              {porcentajeA}% de los votos válidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Rival Directo</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{votosB.toLocaleString()} votos</div>
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajeB}% de los votos válidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Centros de Votación</CardTitle>
            <MapPin className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locales.filter(l => mesas.filter(m => m.local_id === l.id && m.estado === 'enviada').length === l.total_mesas).length} colegios completados al 100%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa Interactivo */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Mapa de Despliegue - Chaclacayo</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loading ? (
              <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
                Cargando mapa interactivo...
              </div>
            ) : (
              <MapChaclacayo locales={locales} mesas={mesas} />
            )}
          </CardContent>
        </Card>

        {/* Gráfico y Alertas */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Proyección de Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="Votos" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Alertas Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-100">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">I.E. Miguel Grau completado</p>
                    <p className="text-green-700/80">Se recibieron las 8 actas (100%).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-orange-50 text-orange-800 rounded-lg text-sm border border-orange-100">
                  <Users className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Faltan personeros</p>
                    <p className="text-orange-700/80">Colegio Felipe S. Estenós tiene avance bajo (20%).</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
