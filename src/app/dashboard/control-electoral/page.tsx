'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { MapPin, Users, CheckCircle2, TrendingUp, AlertTriangle, Loader2, Wifi, Maximize, Minimize, Eye, X, Camera } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useElectoral } from '@/lib/firebase/ElectoralContext';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';

// Importar el mapa dinámicamente para evitar errores de SSR con Leaflet
const MapChaclacayo = dynamic(
  () => import('@/components/electoral/MapChaclacayo'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
        Cargando mapa...
      </div>
    ),
  }
);

export default function ControlElectoralDashboard() {
  const [modoTV, setModoTV] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Datos centralizados desde el ElectoralProvider (sin listeners duplicados)
  const { locales, mesas, actas, loading } = useElectoral();

  // ─── Cálculos estadísticos ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalMesas = mesas.length;
    const mesasEscrutadas = mesas.filter((m) => m.estado === 'enviada').length;
    const porcentajeEscrutado =
      totalMesas > 0
        ? ((mesasEscrutadas / totalMesas) * 100).toFixed(1)
        : '0.0';

    // Votos por partido (asumiendo 4 partidos configurados)
    const votosA = actas.reduce((acc, curr) => acc + (curr.votos_partido_a || 0), 0);
    const votosB = actas.reduce((acc, curr) => acc + (curr.votos_partido_b || 0), 0);
    const votosC = actas.reduce((acc, curr) => acc + (curr.votos_partido_c || 0), 0);
    const votosD = actas.reduce((acc, curr) => acc + (curr.votos_partido_d || 0), 0);
    const votosBlancosNulos = actas.reduce(
      (acc, curr) => acc + (curr.votos_blancos || 0) + (curr.votos_nulos || 0),
      0
    );
    const totalVotos = votosA + votosB + votosC + votosD + votosBlancosNulos;

    const pct = (v: number) =>
      totalVotos > 0 ? ((v / totalVotos) * 100).toFixed(1) : '0.0';

    const colegiosCompletados = locales.filter((l) => {
      const mesasDelLocal = mesas.filter((m) => m.local_id === l.id);
      const enviadas = mesasDelLocal.filter((m) => m.estado === 'enviada').length;
      return mesasDelLocal.length > 0 && enviadas === mesasDelLocal.length;
    }).length;

    // Última acta recibida (más reciente)
    const ultimaActa =
      actas.length > 0
        ? [...actas].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        : null;

    return {
      totalMesas,
      mesasEscrutadas,
      porcentajeEscrutado,
      votosA,
      votosB,
      votosC,
      votosD,
      votosBlancosNulos,
      totalVotos,
      pct,
      colegiosCompletados,
      ultimaActa,
    };
  }, [mesas, actas, locales]);

  // ─── Datos del gráfico (uno por partido + blancos/nulos) ──────────────────

  const chartData = PARTIDOS_CHACLACAYO.map((p, i) => {
    const votosClave = (['votosA', 'votosB', 'votosC', 'votosD'] as const)[i];
    return {
      name: p.alias,
      Votos: stats[votosClave] || 0,
      color: p.color,
      pct: stats.pct(stats[votosClave] || 0),
    };
  }).concat([
    {
      name: 'Blancos/Nulos',
      Votos: stats.votosBlancosNulos,
      color: '#94a3b8',
      pct: stats.pct(stats.votosBlancosNulos),
    },
  ]);

  // ─── Alertas dinámicas ─────────────────────────────────────────────────────

  const alertas = useMemo(() => {
    const result: Array<{
      tipo: 'exito' | 'alerta';
      titulo: string;
      descripcion: string;
      key: string;
    }> = [];

    locales.forEach((local) => {
      const mesasLocal = mesas.filter((m) => m.local_id === local.id);
      if (mesasLocal.length === 0) return;

      const enviadas = mesasLocal.filter((m) => m.estado === 'enviada').length;
      const total = mesasLocal.length;
      const pct = Math.round((enviadas / total) * 100);

      if (pct === 100) {
        result.push({
          tipo: 'exito',
          titulo: `${local.nombre} completado`,
          descripcion: `Se recibieron las ${total} actas (100%).`,
          key: local.id + '_ok',
        });
      } else if (pct < 30) {
        result.push({
          tipo: 'alerta',
          titulo: `Avance bajo — ${local.nombre}`,
          descripcion: `Solo ${enviadas} de ${total} mesas reportadas (${pct}%).`,
          key: local.id + '_alerta',
        });
      }
    });

    return result.slice(0, 6); // Máximo 6 alertas visibles
  }, [locales, mesas]);

  // ─── Partido ganando ──────────────────────────────────────────────────────

  const partidoPropio = PARTIDOS_CHACLACAYO.find((p) => p.esPropio);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Conectando datos en tiempo real...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={modoTV ? "fixed inset-0 z-50 bg-slate-50 overflow-auto p-4 md:p-8 space-y-6" : "space-y-6 max-w-[1600px] mx-auto"}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Control Electoral — Día D</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-slate-500">Monitoreo en tiempo real de mesas y resultados en Chaclacayo.</p>
            {stats.ultimaActa && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="h-3 w-3" />
                Última acta: {stats.ultimaActa.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setModoTV(!modoTV)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-md"
        >
          {modoTV ? <><Minimize className="w-4 h-4" /> Salir de Modo TV</> : <><Maximize className="w-4 h-4" /> Modo TV (Centro Cómputo)</>}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mesas escrutadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Escrutadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.mesasEscrutadas} / {stats.totalMesas}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.porcentajeEscrutado}% del total de Chaclacayo
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${stats.porcentajeEscrutado}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Partido propio */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              {partidoPropio?.alias ?? 'Tu Partido'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {stats.votosA.toLocaleString()} votos
            </div>
            <p className="text-xs text-blue-600/80 mt-1">
              {stats.pct(stats.votosA)}% de los votos
            </p>
          </CardContent>
        </Card>

        {/* Rival directo (Acción Popular) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              {PARTIDOS_CHACLACAYO[1]?.alias ?? 'Rival 1'}
            </CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">
              {stats.votosB.toLocaleString()} votos
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pct(stats.votosB)}% de los votos
            </p>
          </CardContent>
        </Card>

        {/* Centros de votación */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Centros de Votación</CardTitle>
            <MapPin className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.colegiosCompletados} colegios completados al 100%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mapa + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Mapa de Despliegue — Chaclacayo</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <MapChaclacayo locales={locales} mesas={mesas} />
          </CardContent>
        </Card>

        {/* Gráfico y Alertas */}
        <div className="space-y-6">
          {/* Gráfico de resultados */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Proyección de Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalVotos === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm flex-col gap-2">
                  <TrendingUp className="h-8 w-8 text-slate-300" />
                  Aún no hay actas registradas
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        formatter={(value, _name, props) => [
                          `${Number(value ?? 0).toLocaleString()} (${props.payload?.pct ?? '0.0'}%)`,
                          'Votos',
                        ]}
                      />
                      <Bar dataKey="Votos" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alertas dinámicas */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Alertas en Tiempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {alertas.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    {mesas.length === 0
                      ? 'Sin mesas registradas aún.'
                      : 'Sin alertas en este momento.'}
                  </p>
                ) : (
                  alertas.map((alerta) =>
                    alerta.tipo === 'exito' ? (
                      <div
                        key={alerta.key}
                        className="flex items-start gap-3 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-100"
                      >
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{alerta.titulo}</p>
                          <p className="text-green-700/80">{alerta.descripcion}</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={alerta.key}
                        className="flex items-start gap-3 p-3 bg-orange-50 text-orange-800 rounded-lg text-sm border border-orange-100"
                      >
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{alerta.titulo}</p>
                          <p className="text-orange-700/80">{alerta.descripcion}</p>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Auditoría Fotográfica de Actas */}
      <Card className="shadow-sm mt-8 border-t-4 border-t-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Camera className="w-5 h-5 text-slate-500" />
            Auditoría de Actas Ingresadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b">Hora</th>
                  <th className="px-4 py-3 border-b">Local y Mesa</th>
                  <th className="px-4 py-3 border-b text-center">Votos ({partidoPropio?.alias ?? 'Partido'})</th>
                  <th className="px-4 py-3 border-b text-center">Evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Aún no hay actas ingresadas en el sistema.
                    </td>
                  </tr>
                ) : (
                  [...actas].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map((acta) => {
                    const mesa = mesas.find(m => m.id === acta.mesa_id);
                    const local = locales.find(l => l.id === mesa?.local_id);
                    return (
                      <tr key={acta.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-600">
                          {acta.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">Mesa N° {mesa?.numero}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{local?.nombre}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full border border-blue-100">
                            {acta.votos_partido_a} votos
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {acta.foto_url ? (
                            <button
                              onClick={() => setFotoPreview(acta.foto_url!)}
                              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Ver Foto
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin foto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Visor de Fotos */}
      {fotoPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setFotoPreview(null)}>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">Evidencia del Acta</h3>
              <button onClick={() => setFotoPreview(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow overflow-auto p-4 flex justify-center items-center bg-slate-100">
              <img src={fotoPreview} alt="Acta Electoral" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
