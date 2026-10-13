'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  FileSpreadsheet,
  Layers,
  MapPin,
  PieChart,
  School,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
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
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTAS_ESPERADAS } from '@/lib/electoral/acta-schema';
import { CHACLACAYO_ELECTORAL_LOCATIONS } from '@/lib/electoral/locations';
import { PARTIDOS_CHACLACAYO, type Acta, type LocalVotacion, type Mesa, type Personero } from '@/lib/firebase/types';

interface AnalisisElectoralPanelProps {
  locales: LocalVotacion[];
  mesas: Mesa[];
  actas: Acta[];
  personeros: Personero[];
}

const PADRON_REFERENCIAL_POR_MESA = 300; // Estándar oficial ONPE promedio por mesa electoral

function normalizedOrg(val: string): string {
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function AnalisisElectoralPanel({
  locales,
  mesas,
  actas,
  personeros,
}: AnalisisElectoralPanelProps) {
  const [subTab, setSubTab] = useState<'geopolitica' | 'comportamiento' | 'remanente' | 'anomalias'>('geopolitica');
  const [copiedReport, setCopiedReport] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // CÁLCULOS ESTADÍSTICOS Y GEOPOLÍTICOS (Reactivos al 100% con Firestore)
  // ─────────────────────────────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    const totalMesasEsperadas = ACTAS_ESPERADAS;
    const actasProcesadasCount = actas.length;
    const pctEscrutinioGlobal = totalMesasEsperadas > 0
      ? ((actasProcesadasCount / totalMesasEsperadas) * 100).toFixed(1)
      : '0.0';
    const mesasRestantes = Math.max(0, totalMesasEsperadas - actasProcesadasCount);

    // Mapeo unificado de los 8 colegios oficiales de Chaclacayo
    const colegiosMap = CHACLACAYO_ELECTORAL_LOCATIONS.map((seed, idx) => {
      const docId = `local_${seed.code.toLowerCase()}`;
      const firestoreLocal = locales.find(
        (l) => l.id === docId || l.id === seed.code || l.nombre.includes(seed.shortName),
      );

      const localActas = actas.filter((a) => {
        if (a.local_id) {
          return a.local_id === firestoreLocal?.id || a.local_id === docId || a.local_id === seed.code;
        }
        const m = mesas.find((item) => item.id === a.mesa_id || item.numero === a.mesa_id);
        return m?.local_id === firestoreLocal?.id || m?.local_id === docId;
      });

      const totalMesasLocal = seed.mesas;
      const actasRecibidas = localActas.length;
      const pctAvanceLocal = totalMesasLocal > 0
        ? Math.round((actasRecibidas / totalMesasLocal) * 100)
        : 0;

      let votosValidosLocal = 0;
      let blancosLocal = 0;
      let nulosLocal = 0;
      let impugnadosLocal = 0;
      let ciudadanosVotaronTotal = 0;
      const partidosVotos: Record<string, number> = {};

      localActas.forEach((acta) => {
        const b = (acta.especiales?.blancos?.distrital ?? acta.votos_blancos) || 0;
        const n = (acta.especiales?.nulos?.distrital ?? acta.votos_nulos) || 0;
        const imp = (acta.especiales?.impugnados?.distrital ?? acta.votos_impugnados) || 0;
        blancosLocal += b;
        nulosLocal += n;
        impugnadosLocal += imp;

        const cv = acta.ciudadanos_votaron || acta.total_distrital || 0;
        ciudadanosVotaronTotal += cv;

        let actaValidos = 0;
        if (acta.resultados && Array.isArray(acta.resultados)) {
          acta.resultados.forEach((r) => {
            const orgKey = normalizedOrg(r.organizacion);
            const v = r.distrital || 0;
            actaValidos += v;
            partidosVotos[orgKey] = (partidosVotos[orgKey] || 0) + v;
          });
        } else {
          // Fallback partidos predeterminados
          PARTIDOS_CHACLACAYO.forEach((p, pIdx) => {
            const v = [acta.votos_partido_a, acta.votos_partido_b, acta.votos_partido_c, acta.votos_partido_d][pIdx] || 0;
            const orgKey = normalizedOrg(p.nombre);
            actaValidos += v;
            partidosVotos[orgKey] = (partidosVotos[orgKey] || 0) + v;
          });
        }
        votosValidosLocal += actaValidos;
      });

      const totalEmitidosLocal = votosValidosLocal + blancosLocal + nulosLocal + impugnadosLocal;

      // Ranking ordenado de partidos en este local
      const rankingPartidosLocal = PARTIDOS_CHACLACAYO.map((p) => {
        const orgKey = normalizedOrg(p.nombre);
        const aliasKey = normalizedOrg(p.alias);
        const matchedVotes = Object.entries(partidosVotos).reduce((sum, [key, count]) => {
          if (key === orgKey || key === aliasKey || key.includes(aliasKey) || aliasKey.includes(key)) {
            return sum + count;
          }
          return sum;
        }, 0);

        return {
          id: p.id,
          nombre: p.nombre,
          alias: p.alias,
          color: p.color,
          esPropio: p.esPropio,
          votos: matchedVotes,
          pctValido: votosValidosLocal > 0 ? (matchedVotes / votosValidosLocal) * 100 : 0,
          pctEmitido: totalEmitidosLocal > 0 ? (matchedVotes / totalEmitidosLocal) * 100 : 0,
        };
      }).sort((a, b) => b.votos - a.votos);

      const ganador = rankingPartidosLocal[0] || null;
      const segundo = rankingPartidosLocal[1] || null;
      const fcPartido = rankingPartidosLocal.find((p) => p.esPropio) || null;
      const posicionFC = rankingPartidosLocal.findIndex((p) => p.esPropio) + 1;

      // Cálculo de NEP local
      let sumP2 = 0;
      rankingPartidosLocal.forEach((p) => {
        if (p.pctValido > 0) {
          const prop = p.pctValido / 100;
          sumP2 += prop * prop;
        }
      });
      const nepLocal = sumP2 > 0 ? Number((1 / sumP2).toFixed(2)) : 0;

      // Clasificación geopolítica del centro de votación
      let clasificacion = 'Sin Actas';
      let clasificacionColor = 'bg-slate-100 text-slate-600 border-slate-200';
      if (actasRecibidas === 0) {
        clasificacion = 'Pendiente de Cierre';
        clasificacionColor = 'bg-slate-100 text-slate-500 border-slate-300';
      } else if (fcPartido && fcPartido.pctValido >= 15) {
        clasificacion = 'Bastión Crecimiento FC';
        clasificacionColor = 'bg-blue-50 text-blue-700 border-blue-200';
      } else if (ganador && segundo && Math.abs(ganador.pctValido - segundo.pctValido) < 5) {
        clasificacion = 'Zona de Disputa Reñida';
        clasificacionColor = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (ganador && ganador.pctValido >= 26) {
        clasificacion = `Ventaja ${ganador.alias}`;
        clasificacionColor = 'bg-slate-100 text-slate-800 border-slate-300';
      } else {
        clasificacion = 'En Disputa Moderada';
        clasificacionColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      }

      return {
        id: firestoreLocal?.id || docId,
        code: seed.code,
        numero: idx + 1,
        nombre: seed.nombre,
        shortName: seed.shortName,
        zona: seed.zona,
        totalMesas: totalMesasLocal,
        actasRecibidas,
        pctAvance: pctAvanceLocal,
        mesasFaltantes: Math.max(0, totalMesasLocal - actasRecibidas),
        votosValidos: votosValidosLocal,
        blancos: blancosLocal,
        nulos: nulosLocal,
        impugnados: impugnadosLocal,
        totalEmitidos: totalEmitidosLocal,
        blancosPct: totalEmitidosLocal > 0 ? ((blancosLocal / totalEmitidosLocal) * 100).toFixed(1) : '0.0',
        nulosPct: totalEmitidosLocal > 0 ? ((nulosLocal / totalEmitidosLocal) * 100).toFixed(1) : '0.0',
        viciadoPct: totalEmitidosLocal > 0 ? (((blancosLocal + nulosLocal) / totalEmitidosLocal) * 100).toFixed(1) : '0.0',
        promedioVotantesMesa: actasRecibidas > 0 ? Math.round(totalEmitidosLocal / actasRecibidas) : 0,
        nep: nepLocal,
        rankingPartidos: rankingPartidosLocal,
        ganador,
        segundo,
        margenGanador: ganador && segundo ? (ganador.pctValido - segundo.pctValido).toFixed(1) : '0.0',
        fcPartido,
        posicionFC,
        clasificacion,
        clasificacionColor,
        actas: localActas,
      };
    });

    // ── Totales consolidados a nivel distrital ──
    const globalPartyVotes: Record<string, { party: (typeof PARTIDOS_CHACLACAYO)[number]; votos: number }> = {};
    PARTIDOS_CHACLACAYO.forEach((p) => {
      globalPartyVotes[p.id] = { party: p, votos: 0 };
    });

    let globalVotosValidos = 0;
    let globalBlancos = 0;
    let globalNulos = 0;
    let globalImpugnados = 0;

    actas.forEach((acta) => {
      const b = (acta.especiales?.blancos?.distrital ?? acta.votos_blancos) || 0;
      const n = (acta.especiales?.nulos?.distrital ?? acta.votos_nulos) || 0;
      const imp = (acta.especiales?.impugnados?.distrital ?? acta.votos_impugnados) || 0;
      globalBlancos += b;
      globalNulos += n;
      globalImpugnados += imp;

      if (acta.resultados && Array.isArray(acta.resultados)) {
        acta.resultados.forEach((r) => {
          const v = r.distrital || 0;
          globalVotosValidos += v;
          const rKey = normalizedOrg(r.organizacion);
          const matched = PARTIDOS_CHACLACAYO.find((p) => {
            const orgK = normalizedOrg(p.nombre);
            const aliasK = normalizedOrg(p.alias);
            return rKey === orgK || rKey === aliasK || rKey.includes(aliasK) || aliasK.includes(rKey);
          });
          if (matched && globalPartyVotes[matched.id]) {
            globalPartyVotes[matched.id].votos += v;
          }
        });
      }
    });

    const globalEmitidos = globalVotosValidos + globalBlancos + globalNulos + globalImpugnados;

    const rankingGlobal = Object.values(globalPartyVotes)
      .map(({ party, votos }) => ({
        id: party.id,
        nombre: party.nombre,
        alias: party.alias,
        color: party.color,
        esPropio: party.esPropio,
        votos,
        pctValido: globalVotosValidos > 0 ? (votos / globalVotosValidos) * 100 : 0,
        pctEmitido: globalEmitidos > 0 ? (votos / globalEmitidos) * 100 : 0,
      }))
      .sort((a, b) => b.votos - a.votos);

    // Número Efectivo de Partidos Global (NEP)
    let sumGlobalP2 = 0;
    rankingGlobal.forEach((p) => {
      if (p.pctValido > 0) {
        const prop = p.pctValido / 100;
        sumGlobalP2 += prop * prop;
      }
    });
    const nepGlobal = sumGlobalP2 > 0 ? Number((1 / sumGlobalP2).toFixed(2)) : 0;

    // Métricas de Participación y Turnout
    const promedioVotantesMesaGlobal = actasProcesadasCount > 0
      ? Math.round(globalEmitidos / actasProcesadasCount)
      : 0;
    const turnoutEstimado = promedioVotantesMesaGlobal > 0
      ? ((promedioVotantesMesaGlobal / PADRON_REFERENCIAL_POR_MESA) * 100).toFixed(1)
      : '0.0';
    const abstencionismoEstimado = (100 - parseFloat(turnoutEstimado)).toFixed(1);

    // Métricas de Brecha y Remanente
    const votosEstimadosRestantes = mesasRestantes * (promedioVotantesMesaGlobal || 231);
    const puntero = rankingGlobal[0] || null;
    const segundoLugar = rankingGlobal[1] || null;
    const karenAcevedo = rankingGlobal.find((p) => p.esPropio) || null;
    const gapPunteroKaren = puntero && karenAcevedo ? puntero.votos - karenAcevedo.votos : 0;

    // Mesas Anómalas / Outliers de auditoría
    const mesasAnomalas = actas.map((acta) => {
      const b = (acta.especiales?.blancos?.distrital ?? acta.votos_blancos) || 0;
      const n = (acta.especiales?.nulos?.distrital ?? acta.votos_nulos) || 0;
      const emit = acta.total_distrital || ((acta.resultados?.reduce((acc, r) => acc + (r.distrital || 0), 0) || 0) + b + n);
      const pctNulo = emit > 0 ? (n / emit) * 100 : 0;
      const pctViciado = emit > 0 ? ((b + n) / emit) * 100 : 0;
      const colegio = colegiosMap.find((c) => c.id === acta.local_id || c.code === acta.local_id);

      // Votos Karen en esta acta
      const karenResult = acta.resultados?.find((r) => normalizedOrg(r.organizacion).includes('fuerzaciudadana'));
      const karenVotos = karenResult?.distrital ?? 0;

      const motivos: string[] = [];
      if (pctNulo >= 10) motivos.push(`Alto voto nulo (${pctNulo.toFixed(1)}%)`);
      if (emit < 160 && emit > 0) motivos.push(`Afluencia inusualmente baja (${emit} electores)`);
      if (emit > 275) motivos.push(`Afluencia inusualmente alta (${emit} electores)`);
      if (karenVotos === 0 && emit > 100) motivos.push('0 votos para Fuerza Ciudadana en mesa con personero');

      return {
        mesaNumero: acta.mesa_numero || acta.mesa_id,
        colegioNombre: colegio?.shortName || 'Colegio desconocido',
        zona: colegio?.zona || 'Sin zona',
        totalEmitidos: emit,
        votosNulos: n,
        pctNulo: pctNulo.toFixed(1),
        pctViciado: pctViciado.toFixed(1),
        karenVotos,
        motivos,
      };
    }).filter((m) => m.motivos.length > 0);

    return {
      totalMesasEsperadas,
      actasProcesadasCount,
      pctEscrutinioGlobal,
      mesasRestantes,
      globalVotosValidos,
      globalBlancos,
      globalNulos,
      globalEmitidos,
      pctBlancos: globalEmitidos > 0 ? ((globalBlancos / globalEmitidos) * 100).toFixed(1) : '0.0',
      pctNulos: globalEmitidos > 0 ? ((globalNulos / globalEmitidos) * 100).toFixed(1) : '0.0',
      pctViciado: globalEmitidos > 0 ? (((globalBlancos + globalNulos) / globalEmitidos) * 100).toFixed(1) : '0.0',
      nepGlobal,
      promedioVotantesMesaGlobal,
      turnoutEstimado,
      abstencionismoEstimado,
      votosEstimadosRestantes,
      puntero,
      segundoLugar,
      karenAcevedo,
      gapPunteroKaren,
      rankingGlobal,
      colegiosMap,
      mesasAnomalas,
    };
  }, [actas, locales, mesas]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA PREPARADA PARA GRÁFICOS RECHARTS (Responsive y optimizados)
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Gráfico de top 4 fuerzas políticas por centro de votación
  const chartTerritorialData = useMemo(() => {
    return analytics.colegiosMap.map((c) => {
      const topAvanza = c.rankingPartidos.find((p) => p.alias.toLowerCase().includes('avanza'))?.votos || 0;
      const topRenovacion = c.rankingPartidos.find((p) => p.alias.toLowerCase().includes('renovación'))?.votos || 0;
      const topPodemos = c.rankingPartidos.find((p) => p.alias.toLowerCase().includes('podemos'))?.votos || 0;
      const fcVotos = c.fcPartido?.votos || 0;

      return {
        name: c.shortName,
        zona: c.zona,
        'Avanza País': topAvanza,
        'Renovación Popular': topRenovacion,
        'Podemos Perú': topPodemos,
        'Fuerza Ciudadana (Karen)': fcVotos,
      };
    });
  }, [analytics.colegiosMap]);

  // 2. Gráfico de Voto Viciado (% Blanco vs % Nulo por Colegio)
  const chartDesafeccionData = useMemo(() => {
    return analytics.colegiosMap.map((c) => ({
      name: c.shortName,
      zona: c.zona,
      Blanco: parseFloat(c.blancosPct),
      Nulo: parseFloat(c.nulosPct),
      TotalViciado: parseFloat(c.viciadoPct),
    }));
  }, [analytics.colegiosMap]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FUNCIÓN PARA COPIAR REPORTE RESUMEN EJECUTIVO A PORTAPAPELES
  // ─────────────────────────────────────────────────────────────────────────────
  const copyExecutiveSummary = () => {
    const text = `📊 INFORME DE INTELIGENCIA ELECTORAL — CHACLACAYO 2026
Avance: ${analytics.actasProcesadasCount}/${analytics.totalMesasEsperadas} actas (${analytics.pctEscrutinioGlobal}%)
Participación estimada: ${analytics.turnoutEstimado}% | Voto viciado: ${analytics.pctViciado}% (Blanco: ${analytics.pctBlancos}%, Nulo: ${analytics.pctNulos}%)
NEP (Índice de Fragmentación): ${analytics.nepGlobal} partidos efectivos

POSICIONES DISTRITALES:
1º ${analytics.puntero?.alias}: ${analytics.puntero?.votos} votos (${analytics.puntero?.pctValido.toFixed(1)}%)
2º ${analytics.segundoLugar?.alias}: ${analytics.segundoLugar?.votos} votos (${analytics.segundoLugar?.pctValido.toFixed(1)}%)
4º Fuerza Ciudadana (Karen Acevedo): ${analytics.karenAcevedo?.votos} votos (${analytics.karenAcevedo?.pctValido.toFixed(1)}%)

BOLSILLO DECISIVO:
Faltan ${analytics.mesasRestantes} mesas por escrutar (~${analytics.votosEstimadosRestantes.toLocaleString()} votos en juego), concentradas en Ñaña (Castilla, Basadre y Grau).
Reporte generado en vivo desde Control Electoral.`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ── ENCABEZADO DE INTELIGENCIA ELECTORAL ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-1">
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>Módulo de Inteligencia Política y Geoelectoral</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Comportamiento del Electorado — Chaclacayo 2026
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Modelado estadístico dinámico basado en las {analytics.actasProcesadasCount} actas confirmadas en línea ({analytics.pctEscrutinioGlobal}% distrital).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={copyExecutiveSummary}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"
          >
            {copiedReport ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">¡Copiado para WhatsApp!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copiar Resumen Ejecutivo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ESTRATÉGICOS SUPERIORES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NEP Fragmentación */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fragmentación (NEP)
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <PieChart className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {analytics.nepGlobal}
              </span>
              <span className="text-xs font-semibold text-slate-500">partidos efectivos</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-600">
              {analytics.nepGlobal > 5 ? 'Hiperfragmentado' : 'Fragmentación moderada'}: El electorado reparte su voto en más de 6 fuerzas vivas.
            </p>
          </CardContent>
        </Card>

        {/* Participación Ciudadana (Turnout) */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Afluencia Ciudadana
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                {analytics.turnoutEstimado}%
              </span>
              <span className="text-xs text-slate-400 font-medium">estimado</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-600">
              ~{analytics.promedioVotantesMesaGlobal} sufragantes por mesa. Abstencionismo proyectado: {analytics.abstencionismoEstimado}%.
            </p>
          </CardContent>
        </Card>

        {/* Desafección (Blancos + Nulos) */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Voto Viciado / Rechazo
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-800 font-mono">
                {analytics.pctViciado}%
              </span>
              <span className="text-xs text-slate-500 font-medium">emitidos</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="text-slate-500">Blanco: {analytics.pctBlancos}%</span>
              <span>•</span>
              <span className="text-slate-500">Nulo: {analytics.pctNulos}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Bolsón Decisivo en Ñaña */}
        <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-800">
              Remanente en Juego
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Target className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-blue-900 font-mono">
                {analytics.mesasRestantes}
              </span>
              <span className="text-xs font-bold text-blue-700">mesas faltantes</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-blue-900">
              ~{analytics.votosEstimadosRestantes.toLocaleString()} votos pendientes, principalmente en los 3 colegios de Ñaña.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── SELECTOR DE VISTAS ANALÍTICAS ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSubTab('geopolitica')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            subTab === 'geopolitica'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Matriz Geopolítica de Colegios</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('comportamiento')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            subTab === 'comportamiento'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Sociología del Voto y Desencanto</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('remanente')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            subTab === 'remanente'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Simulación y Brecha de Remanente</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('anomalias')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            subTab === 'anomalias'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Auditoría de Anomalías ({analytics.mesasAnomalas.length})</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          SUBTAB 1: MATRIZ GEOPOLÍTICA POR COLEGIOS Y ZONAS
         ─────────────────────────────────────────────────────────────────────── */}
      {subTab === 'geopolitica' && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-black text-slate-900">
                    Comportamiento Político por Centro de Votación
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Desglose territorial detallado de los 8 colegios oficiales de Chaclacayo.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Fuerza Ciudadana
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Rivales
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-3.5">Centro de Votación</th>
                      <th className="py-3 px-3 text-center">Zona</th>
                      <th className="py-3 px-3 text-center">Mesas</th>
                      <th className="py-3 px-3">Ganador Local</th>
                      <th className="py-3 px-3">2º Lugar</th>
                      <th className="py-3 px-3 text-blue-900 bg-blue-50/40">Fuerza Ciudadana (Karen)</th>
                      <th className="py-3 px-3 text-center">Viciados</th>
                      <th className="py-3 px-3.5 text-center">Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.colegiosMap.map((col) => {
                      const isComplete = col.pctAvance === 100;
                      return (
                        <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">{col.nombre}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={11} /> {col.zona}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {col.zona}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <div className="font-bold text-slate-900">
                              {col.actasRecibidas} / {col.totalMesas}
                            </div>
                            <div className={`text-[10px] font-bold ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {col.pctAvance}%
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {col.ganador ? (
                              <div>
                                <span className="font-bold text-slate-900 text-xs">{col.ganador.alias}</span>
                                <div className="text-[11px] font-mono font-semibold text-slate-500">
                                  {col.ganador.votos} votos ({col.ganador.pctValido.toFixed(1)}%)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Sin actas</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {col.segundo ? (
                              <div>
                                <span className="font-semibold text-slate-700 text-xs">{col.segundo.alias}</span>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {col.segundo.votos} ({col.segundo.pctValido.toFixed(1)}%)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 bg-blue-50/20 font-bold">
                            {col.fcPartido ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-blue-900 text-xs font-black">
                                    {col.fcPartido.votos} votos
                                  </span>
                                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono">
                                    #{col.posicionFC}
                                  </span>
                                </div>
                                <div className="text-[11px] text-blue-700 font-mono">
                                  {col.fcPartido.pctValido.toFixed(1)}% válidos
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">0 votos</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs">
                            <span className={parseFloat(col.viciadoPct) > 9 ? 'font-bold text-amber-700' : 'text-slate-600'}>
                              {col.viciadoPct}%
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${col.clasificacionColor}`}>
                              {col.clasificacion}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Barras Agrupado Territorial */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black text-slate-900">
                Distribución del Voto por Colegio (Top 4 Fuerzas Políticas)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Comparativa de penetración electoral de Avanza País, Renovación Popular, Podemos Perú y Fuerza Ciudadana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTerritorialData} margin={{ top: 10, right: 10, left: -15, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                    <Bar dataKey="Avanza País" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Renovación Popular" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Podemos Perú" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fuerza Ciudadana (Karen)" fill="#0070C0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          SUBTAB 2: SOCIOLOGÍA DEL VOTO Y DESENCANTO CÍVICO
         ─────────────────────────────────────────────────────────────────────── */}
      {subTab === 'comportamiento' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Voto Blanco vs Nulo */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black text-slate-900">
                  Desglose de Voto Viciado por Centro de Votación (%)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Porcentaje de votos en blanco (desinterés) vs. votos nulos (protesta o error de llenado).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDesafeccionData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Bar dataKey="Blanco" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Nulo" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">💡 Interpretación Política:</p>
                  <p>
                    En la zona residencial (<strong>Estenós - Los Halcones</strong>) el voto viciado es de apenas <strong>5.8%</strong>, demostrando un sufragio altamente meditado y partidario. En contraste, en <strong>Florentino Prat (Santa Inés)</strong> el viciado sube al <strong>11.9%</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ranking Completo de las 12 Organizaciones */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black text-slate-900">
                  Cómputo Distrital Oficial (Votos Válidos)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Total de votos distritales acumulados de las {analytics.actasProcesadasCount} actas en producción.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1">
                {analytics.rankingGlobal.map((p, idx) => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-4 text-center font-bold font-mono ${idx < 3 ? 'text-primary' : 'text-slate-400'}`}>
                          #{idx + 1}
                        </span>
                        <span className={`font-semibold ${p.esPropio ? 'text-blue-900 font-black' : 'text-slate-800'}`}>
                          {p.alias}
                        </span>
                        {p.esPropio && (
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded font-bold">
                            Karen Acevedo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900">{p.votos.toLocaleString()}</span>
                        <span className="text-slate-500 text-[11px]">({p.pctValido.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, p.pctValido * 3)}%`,
                          backgroundColor: p.color || '#94a3b8',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          SUBTAB 3: SIMULACIÓN Y BRECHA DE REMANENTE (Ñaña Decision Point)
         ─────────────────────────────────────────────────────────────────────── */}
      {subTab === 'remanente' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/80 p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 mt-1">
                <Target className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  El Punto de Inflexión Electoral: Las 58 Mesas de Ñaña
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Los colegios del Casco Urbano, Santa Inés, Los Halcones y Huascata ya completaron el 100% de su escrutinio.
                  Todo el resultado final de la elección depende exclusivamente del comportamiento electoral en <strong>Ñaña</strong>, que representa <strong>el 42.0% del electorado total de Chaclacayo</strong> aún no computado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">I.E. 1199 Castilla (Ñaña)</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">24 mesas pendientes</p>
                <p className="text-xs text-slate-500 mt-1">~5,500 votos en disputa. El colegio más grande de todo Chaclacayo.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">I.E. 787 Miguel Grau (Ñaña)</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">20 mesas pendientes</p>
                <p className="text-xs text-slate-500 mt-1">~4,600 votos en disputa. Totalmente inédito sin actas aún.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">I.E. 1217 Basadre (Ñaña)</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">13 mesas pendientes</p>
                <p className="text-xs text-slate-500 mt-1">~3,000 votos en disputa. Aquí Karen Acevedo marca su techo: 16.7% (#3).</p>
              </div>
            </div>
          </div>

          {/* Tabla de Escenarios Matemáticos */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-slate-900">
                Brecha Numérica para Alcanzar el Podio Distrital
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Diferencia matemática de votos requerida en el remanente de las 58 mesas restantes (~{analytics.votosEstimadosRestantes.toLocaleString()} votos en juego).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-3">Posición / Partido</th>
                      <th className="py-2.5 px-3 text-center">Votos Actuales</th>
                      <th className="py-2.5 px-3 text-center">% Válido Actual</th>
                      <th className="py-2.5 px-3 text-center">Distancia con Karen</th>
                      <th className="py-2.5 px-3">Comportamiento en Ñaña</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        1º {analytics.puntero?.alias}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {analytics.puntero?.votos.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {analytics.puntero?.pctValido.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-red-600 font-bold">
                        +{analytics.gapPunteroKaren.toLocaleString()} votos
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs">
                        Baja de 27% a 21-24% en las primeras actas de Ñaña.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        2º {analytics.segundoLugar?.alias}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {analytics.segundoLugar?.votos.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {analytics.segundoLugar?.pctValido.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-amber-700 font-bold">
                        +{((analytics.segundoLugar?.votos || 0) - (analytics.karenAcevedo?.votos || 0)).toLocaleString()} votos
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs">
                        Lidera en Jorge Basadre con 22.2%.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        3º Podemos Perú
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {analytics.rankingGlobal[2]?.votos.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {analytics.rankingGlobal[2]?.pctValido.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-700 font-bold">
                        +{((analytics.rankingGlobal[2]?.votos || 0) - (analytics.karenAcevedo?.votos || 0)).toLocaleString()} votos
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs">
                        Fuerte en Cultura y Progreso (Castilla 18.4%).
                      </td>
                    </tr>

                    <tr className="bg-blue-50/40 font-bold">
                      <td className="py-3 px-3 text-blue-900">
                        4º Fuerza Ciudadana (Karen Acevedo)
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-900 font-black">
                        {analytics.karenAcevedo?.votos.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-900">
                        {analytics.karenAcevedo?.pctValido.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-900">
                        Base Propia
                      </td>
                      <td className="py-3 px-3 text-blue-800 text-xs">
                        Supera a Podemos Perú en Basadre (16.7%).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          SUBTAB 4: AUDITORÍA DE ANOMALÍAS Y OUTLIERS DE MESAS
         ─────────────────────────────────────────────────────────────────────── */}
      {subTab === 'anomalias' && (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <span>Detección Automática de Mesas con Comportamiento Anómalo</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Mesas con desvío estadístico notable en votos nulos, afluencia atípica o incongruencias de personería.
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full w-fit">
                  {analytics.mesasAnomalas.length} mesas señaladas
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {analytics.mesasAnomalas.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">No se detectaron anomalías estadísticas en las actas procesadas.</p>
                  <p className="text-xs text-slate-400 mt-1">Todos los conteos se encuentran dentro de las bandas normales de tolerancia.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[620px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-3.5">Mesa</th>
                        <th className="py-2.5 px-3">Colegio y Zona</th>
                        <th className="py-2.5 px-3 text-center">Votantes</th>
                        <th className="py-2.5 px-3 text-center">Voto Nulo</th>
                        <th className="py-2.5 px-3 text-center">Votos Karen</th>
                        <th className="py-2.5 px-3.5">Patrón Detectado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.mesasAnomalas.map((anom) => (
                        <tr key={anom.mesaNumero} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                            Mesa {anom.mesaNumero}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">{anom.colegioNombre}</div>
                            <div className="text-[11px] text-slate-400">{anom.zona}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800">
                            {anom.totalEmitidos}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={parseFloat(anom.pctNulo) >= 10 ? 'font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-600'}>
                              {anom.pctNulo}% ({anom.votosNulos})
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-blue-900">
                            {anom.karenVotos}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {anom.motivos.map((m, mIdx) => (
                                <span key={mIdx} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                  <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
