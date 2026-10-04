'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Maximize,
  Minimize,
  MapPin,
  School,
  Search,
  TrendingUp,
  Users,
  Wifi,
  X,
} from 'lucide-react';
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
import { defaultElectoralTab } from '@/lib/access-control';
import { useAccess } from '@/components/access/AccessContext';
import { PersonerosPanel } from '@/components/electoral/PersonerosPanel';
import { ColegiosDetallePanel } from '@/components/electoral/ColegiosDetallePanel';
import { ACTAS_ESPERADAS } from '@/lib/electoral/acta-schema';
import type { Acta } from '@/lib/firebase/types';

// Importar el mapa dinámicamente para evitar errores de SSR con Leaflet
const MapChaclacayo = dynamic(
  () => import('@/components/electoral/MapChaclacayo'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400 lg:h-[500px]">
        Cargando mapa electoral...
      </div>
    ),
  }
);

type TabType = 'resumen' | 'colegios' | 'personeros' | 'actas';

const RESULT_COLORS = ['#0070C0', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];

function normalizedOrganization(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function districtVotesForParty(acta: Acta, partyIndex: number) {
  const party = PARTIDOS_CHACLACAYO[partyIndex];
  const targetNames = party ? [party.nombre, party.alias].map(normalizedOrganization) : [];
  const recognized = acta.resultados?.find((result) => {
    const name = normalizedOrganization(result.organizacion);
    return targetNames.some((target) => name === target || name.includes(target) || target.includes(name));
  });
  if (recognized) return recognized.distrital ?? 0;
  return [acta.votos_partido_a, acta.votos_partido_b, acta.votos_partido_c, acta.votos_partido_d][partyIndex] || 0;
}

export default function ControlElectoralDashboard() {
  const { role, hasPermission } = useAccess();
  const [activeTab, setActiveTab] = useState<TabType>(() => defaultElectoralTab(role));
  const [modoTV, setModoTV] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [actasSearch, setActasSearch] = useState('');
  const [actasFotoFilter, setActasFotoFilter] = useState<'todas' | 'con_foto' | 'sin_foto'>('todas');
  // Datos centralizados desde el ElectoralProvider
  const { locales, mesas, actas, personeros, loading } = useElectoral();

  // ─── Cálculos estadísticos ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalMesas = ACTAS_ESPERADAS;
    const mesasEscrutadas = new Set(actas.map((acta) => acta.mesa_numero || acta.mesa_id)).size;
    const porcentajeEscrutado =
      totalMesas > 0
        ? ((mesasEscrutadas / totalMesas) * 100).toFixed(1)
        : '0.0';

    const groupedOrganizations = new Map<string, { name: string; votes: number }>();
    actas.forEach((acta) => {
      if (acta.resultados?.length) {
        acta.resultados.forEach((result) => {
          const key = normalizedOrganization(result.organizacion);
          if (!key) return;
          const current = groupedOrganizations.get(key);
          groupedOrganizations.set(key, {
            name: current?.name || result.organizacion,
            votes: (current?.votes || 0) + (result.distrital || 0),
          });
        });
        return;
      }
      PARTIDOS_CHACLACAYO.forEach((party, index) => {
        const key = normalizedOrganization(party.nombre);
        const current = groupedOrganizations.get(key);
        groupedOrganizations.set(key, {
          name: party.alias,
          votes: (current?.votes || 0) + districtVotesForParty(acta, index),
        });
      });
    });
    const organizationTotals = [...groupedOrganizations.entries()].map(([key, result], index) => {
      const known = PARTIDOS_CHACLACAYO.find((party) => {
        const partyName = normalizedOrganization(party.nombre);
        const partyAlias = normalizedOrganization(party.alias);
        return key === partyName || key === partyAlias || key.includes(partyName) || partyName.includes(key);
      });
      return { name: result.name, Votos: result.votes, color: known?.color || RESULT_COLORS[index % RESULT_COLORS.length] };
    });
    const propioIndex = PARTIDOS_CHACLACAYO.findIndex((p) => p.esPropio);
    const votosA = actas.reduce(
      (acc, curr) => acc + districtVotesForParty(curr, propioIndex >= 0 ? propioIndex : 8),
      0,
    );
    const rivalTotals = organizationTotals
      .filter((org) => {
        const propio = PARTIDOS_CHACLACAYO.find((p) => p.esPropio);
        return org.name !== propio?.alias && org.name !== propio?.nombre;
      })
      .sort((a, b) => b.Votos - a.Votos);
    const rivalLider = rivalTotals[0] || { name: 'Segundo lugar', Votos: 0, color: '#dc2626' };
    const votosB = rivalLider.Votos;
    const rivalBName = rivalLider.name;
    const votosBlancosNulos = actas.reduce(
      (acc, curr) => acc + (curr.votos_blancos || 0) + (curr.votos_nulos || 0) + (curr.votos_impugnados || 0),
      0
    );
    const totalVotos = organizationTotals.reduce((sum, result) => sum + result.Votos, 0) + votosBlancosNulos;

    const pct = (v: number) =>
      totalVotos > 0 ? ((v / totalVotos) * 100).toFixed(1) : '0.0';

    const colegiosCompletados = locales.filter((l) => {
      const recibidas = actas.filter((acta) => {
        if (acta.local_id) return acta.local_id === l.id;
        const mesa = mesas.find((item) => item.id === acta.mesa_id || item.numero === acta.mesa_id);
        return mesa?.local_id === l.id;
      }).length;
      return l.total_mesas > 0 && recibidas === l.total_mesas;
    }).length;

    // Última acta recibida (más reciente)
    const ultimaActa =
      actas.length > 0
        ? [...actas].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        : null;

    const actasConFotoCount = actas.filter((a) => Boolean(a.foto_url)).length;

    return {
      totalMesas,
      mesasEscrutadas,
      porcentajeEscrutado,
      votosA,
      votosB,
      rivalBName,
      votosBlancosNulos,
      organizationTotals,
      totalVotos,
      pct,
      colegiosCompletados,
      ultimaActa,
      actasConFotoCount,
    };
  }, [mesas, actas, locales]);

  // ─── Datos del gráfico ─────────────────────────────────────────────────────

  const chartData = stats.organizationTotals
    .slice()
    .sort((a, b) => b.Votos - a.Votos)
    .map((result) => ({
      ...result,
      pct: stats.pct(result.Votos),
    })).concat([
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
      const enviadas = actas.filter((acta) => {
        if (acta.local_id) return acta.local_id === local.id;
        const mesa = mesas.find((item) => item.id === acta.mesa_id || item.numero === acta.mesa_id);
        return mesa?.local_id === local.id;
      }).length;
      const total = local.total_mesas;
      if (total <= 0) return;
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

    return result.slice(0, 6);
  }, [locales, mesas, actas]);

  // ─── Filtrado de actas en Tab 4 ──────────────────────────────────────────

  const filteredActas = useMemo(() => {
    return [...actas]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .filter((acta) => {
        const mesa = mesas.find((m) => m.id === acta.mesa_id || m.numero === acta.mesa_id);
        const local = locales.find((l) => l.id === (acta.local_id || mesa?.local_id));

        if (actasFotoFilter === 'con_foto' && !acta.foto_url) return false;
        if (actasFotoFilter === 'sin_foto' && acta.foto_url) return false;

        if (!actasSearch.trim()) return true;
        const q = actasSearch.toLowerCase().trim();
        const mesaNum = (mesa?.numero || acta.mesa_id || '').toLowerCase();
        const localName = (local?.nombre || '').toLowerCase();
        return mesaNum.includes(q) || localName.includes(q);
      });
  }, [actas, mesas, locales, actasFotoFilter, actasSearch]);

  const partidoPropio = PARTIDOS_CHACLACAYO.find((p) => p.esPropio);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Conectando datos en tiempo real del Día D...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={modoTV ? "fixed inset-0 z-50 bg-slate-50 overflow-auto p-3 sm:p-4 md:p-8 space-y-5" : "mx-auto max-w-[1600px] space-y-5"}>
      {/* Header General */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-slate-900">
            Control Electoral — Día D
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs sm:text-sm text-slate-500">
              Monitoreo operativo de Chaclacayo · 8 Centros · {stats.totalMesas} Mesas oficiales.
            </p>
            {stats.ultimaActa && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="h-3 w-3" />
                Última acta: {stats.ultimaActa.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModoTV(!modoTV)}
            className="flex min-h-10 w-fit items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-slate-700"
          >
            {modoTV ? (
              <>
                <Minimize className="w-4 h-4" />
                <span>Salir de Modo TV</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4" />
                <span>Modo TV (Centro Cómputo)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pestañas Operativas (Segmented Navigation) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'resumen'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Activity className={`w-4 h-4 ${activeTab === 'resumen' ? 'text-primary' : 'text-slate-500'}`} />
          <span>Sala de Guerra</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('colegios')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'colegios'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <School className={`w-4 h-4 ${activeTab === 'colegios' ? 'text-primary' : 'text-slate-500'}`} />
          <span>Centros Votación</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'colegios'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {locales.length > 0 ? locales.length : 8}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personeros')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'personeros'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className={`w-4 h-4 ${activeTab === 'personeros' ? 'text-primary' : 'text-slate-500'}`} />
          <span>Padrón Personeros</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'personeros'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {personeros.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('actas')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'actas'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileText className={`w-4 h-4 ${activeTab === 'actas' ? 'text-primary' : 'text-slate-500'}`} />
          <span>Auditoría Actas</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'actas'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {actas.length}
          </span>
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* TAB 1: SALA DE GUERRA */}
      {activeTab === 'resumen' && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Mesas escrutadas */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Mesas Escrutadas</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
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
            <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">
                  {partidoPropio?.alias ?? 'Karen Acevedo'}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {stats.votosA.toLocaleString()} votos
                </div>
                <p className="text-xs text-blue-600/80 mt-1">
                  {stats.pct(stats.votosA)}% de votos válidos escrutados
                </p>
              </CardContent>
            </Card>

            {/* Rival directo / Segundo lugar general */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                  {stats.rivalBName} (2.° Lugar)
                </CardTitle>
                <Users className="h-4 w-4 text-slate-500" />
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
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Centros de Votación</CardTitle>
                <MapPin className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{locales.length > 0 ? locales.length : 8}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.colegiosCompletados} de {locales.length > 0 ? locales.length : 8} al 100% escrutados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Mapa + Gráfico + Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mapa de Despliegue */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Mapa de Despliegue Electoral — Chaclacayo
                  </CardTitle>
                  <span className="text-xs text-slate-500 font-medium">8 Colegios oficiales</span>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <MapChaclacayo locales={locales} mesas={mesas} />
              </CardContent>
            </Card>

            {/* Gráfico y Alertas */}
            <div className="space-y-6">
              {/* Gráfico de resultados */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Proyección de Resultados</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.totalVotos === 0 ? (
                    <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm flex-col gap-2">
                      <TrendingUp className="h-8 w-8 text-slate-300" />
                      Aún no hay actas registradas
                    </div>
                  ) : (
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 15, right: 10, left: 0, bottom: 5 }}
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
                          <Bar dataKey="Votos" radius={[4, 4, 0, 0]} maxBarSize={45}>
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Alertas en Tiempo Real</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {alertas.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">
                        {mesas.length === 0
                          ? 'Sin mesas registradas aún.'
                          : 'Sin alertas operativas activas.'}
                      </p>
                    ) : (
                      alertas.map((alerta) =>
                        alerta.tipo === 'exito' ? (
                          <div
                            key={alerta.key}
                            className="flex items-start gap-2.5 p-2.5 bg-green-50 text-green-800 rounded-lg text-xs border border-green-100"
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                            <div>
                              <p className="font-semibold">{alerta.titulo}</p>
                              <p className="text-green-700/80">{alerta.descripcion}</p>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={alerta.key}
                            className="flex items-start gap-2.5 p-2.5 bg-orange-50 text-orange-800 rounded-lg text-xs border border-orange-100"
                          >
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
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
        </div>
      )}

      {/* TAB 2: CENTROS DE VOTACIÓN (8 COLEGIOS) */}
      {activeTab === 'colegios' && (
        <div className="animate-in fade-in-50 duration-200">
          <ColegiosDetallePanel
            locales={locales}
            mesas={mesas}
            personeros={personeros}
            actas={actas}
            onSelectPersonero={() => setActiveTab('personeros')}
            canManage={hasPermission('electoral.manage')}
          />
        </div>
      )}

      {/* TAB 3: PADRÓN DE PERSONEROS */}
      {activeTab === 'personeros' && (
        <div className="animate-in fade-in-50 duration-200">
          <PersonerosPanel
            personeros={personeros}
            locales={locales}
            mesas={mesas}
            canManage={hasPermission('electoral.manage')}
          />
        </div>
      )}

      {/* TAB 4: AUDITORÍA DE ACTAS */}
      {activeTab === 'actas' && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          {/* Tarjetas resumen de auditoría */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Actas Recibidas</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {actas.length} / {stats.totalMesas}
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                  {stats.porcentajeEscrutado}% cobertura
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Con Foto / Evidencia</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.actasConFotoCount} / {actas.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {actas.length > 0 ? Math.round((stats.actasConFotoCount / actas.length) * 100) : 0}% con foto
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Votos Escrutados</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.totalVotos.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Total de sufragios</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-blue-700">{partidoPropio?.alias ?? 'Karen Acevedo'}</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">
                  {stats.votosA.toLocaleString()}
                </p>
                <p className="text-[11px] text-blue-600 mt-0.5 font-semibold">
                  {stats.pct(stats.votosA)}% del escrutinio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros y Buscador */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Camera className="w-4 h-4 text-slate-600" />
                  Registro y Evidencia de Actas
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Buscador */}
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={actasSearch}
                      onChange={(e) => setActasSearch(e.target.value)}
                      placeholder="Buscar por mesa o colegio..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {/* Selector de filtro de foto */}
                  <select
                    value={actasFotoFilter}
                    onChange={(e) => setActasFotoFilter(e.target.value as 'todas' | 'con_foto' | 'sin_foto')}
                    aria-label="Filtrar actas por evidencia fotográfica"
                    className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="todas">Todas las actas</option>
                    <option value="con_foto">Solo con foto</option>
                    <option value="sin_foto">Sin foto</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-y border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Hora</th>
                      <th className="px-3.5 py-2.5">Mesa</th>
                      <th className="px-3.5 py-2.5">Centro de Votación</th>
                      <th className="px-3.5 py-2.5 text-center">Fuerza Ciudadana</th>
                      <th className="px-3.5 py-2.5 text-center">Segundo Lugar</th>
                      <th className="px-3.5 py-2.5 text-center">Blancos / Nulos</th>
                      <th className="px-3.5 py-2.5 text-center">Total Mesa</th>
                      <th className="px-3.5 py-2.5 text-center">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-xs">
                          {actas.length === 0
                            ? 'Aún no se han transmitido actas electorales.'
                            : 'No se encontraron actas con los criterios de búsqueda.'}
                        </td>
                      </tr>
                    ) : (
                      filteredActas.map((acta) => {
                        const mesa = mesas.find((m) => m.id === acta.mesa_id || m.numero === acta.mesa_id);
                        const local = locales.find((l) => l.id === (acta.local_id || mesa?.local_id));
                        const propioPartyIndex = PARTIDOS_CHACLACAYO.findIndex((p) => p.esPropio);
                        const votosPropio = districtVotesForParty(acta, propioPartyIndex >= 0 ? propioPartyIndex : 8);
                        const rivalesMesa = PARTIDOS_CHACLACAYO
                          .map((p, idx) => ({ party: p, index: idx }))
                          .filter(({ party }) => !party.esPropio)
                          .map(({ party, index }) => ({
                            name: party.alias,
                            votos: districtVotesForParty(acta, index),
                          }))
                          .sort((a, b) => b.votos - a.votos);
                        const segundoMesa = rivalesMesa[0] || { name: 'Segundo', votos: 0 };
                        const totalMesa = acta.totales_emitidos?.distrital ??
                          (acta.votos_partido_a || 0) +
                          (acta.votos_partido_b || 0) +
                          (acta.votos_partido_c || 0) +
                          (acta.votos_partido_d || 0) +
                          (acta.votos_blancos || 0) +
                          (acta.votos_nulos || 0) +
                          (acta.votos_impugnados || 0);

                        return (
                          <tr key={acta.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3.5 py-2.5 font-medium text-slate-600 whitespace-nowrap">
                              {acta.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {mesa?.numero || acta.mesa_id}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5">
                              <p className="font-medium text-slate-800 truncate max-w-[200px]">
                                {local?.nombre || 'Colegio de Chaclacayo'}
                              </p>
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <span className="inline-block bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">
                                {votosPropio}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-medium text-slate-700">
                              <span>{segundoMesa.votos} <span className="text-[10px] text-slate-400">({segundoMesa.name})</span></span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center text-slate-500">
                              {(acta.votos_blancos || 0) + (acta.votos_nulos || 0)}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-semibold text-slate-800">
                              {totalMesa}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              {acta.foto_url ? (
                                <button
                                  type="button"
                                  onClick={() => setFotoPreview(acta.foto_url!)}
                                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Ver Foto</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Sin foto</span>
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
        </div>
      )}

      {/* Modal Visor de Fotos */}
      {fotoPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoPreview(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3.5 border-b">
              <h3 className="font-bold text-base text-slate-800">Evidencia Fotográfica del Acta</h3>
              <button
                type="button"
                onClick={() => setFotoPreview(null)}
                aria-label="Cerrar visor de acta"
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-grow overflow-auto p-4 flex justify-center items-center bg-slate-100">
              <Image
                src={fotoPreview}
                alt="Acta Electoral"
                width={1200}
                height={900}
                unoptimized
                className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
