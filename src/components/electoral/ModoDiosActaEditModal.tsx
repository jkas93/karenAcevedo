'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';
import type { Acta, LocalVotacion, Mesa } from '@/lib/firebase/types';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';

interface ModoDiosActaEditModalProps {
  acta: Acta;
  mesa?: Mesa;
  local?: LocalVotacion;
  onClose: () => void;
  onSuccess: () => void;
}

type PartyRowState = {
  orden: number;
  nombre: string;
  alias: string;
  color: string;
  esPropio: boolean;
  distrital: number;
  provincial: number;
};

function normalizeName(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function ModoDiosActaEditModal({
  acta,
  mesa,
  local,
  onClose,
  onSuccess,
}: ModoDiosActaEditModalProps) {
  const [showPhoto, setShowPhoto] = useState<boolean>(Boolean(acta.foto_url));
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState(acta.observaciones || '');
  const [electoresHabiles, setElectoresHabiles] = useState<number | ''>(
    acta.electores_habiles ?? 300,
  );
  const [ciudadanosVotaron, setCiudadanosVotaron] = useState<number | ''>(
    acta.ciudadanos_votaron ?? acta.totales_emitidos?.distrital ?? '',
  );

  // Inicializar filas de los 12 partidos
  const [partidosRows, setPartidosRows] = useState<PartyRowState[]>(() => {
    return PARTIDOS_CHACLACAYO.map((p, idx) => {
      const pNormNombre = normalizeName(p.nombre);
      const pNormAlias = normalizeName(p.alias);

      const found = acta.resultados?.find((r) => {
        const rNorm = normalizeName(r.organizacion);
        return rNorm === pNormNombre || rNorm === pNormAlias || rNorm.includes(pNormAlias) || pNormAlias.includes(rNorm);
      });

      let distritalVal = 0;
      let provincialVal = 0;

      if (found) {
        distritalVal = found.distrital ?? 0;
        provincialVal = found.provincial ?? 0;
      } else {
        if (p.esPropio) {
          distritalVal = acta.votos_partido_a || 0;
        } else if (idx === 0) {
          distritalVal = acta.votos_partido_b || 0;
        } else if (idx === 1) {
          distritalVal = acta.votos_partido_c || 0;
        } else if (idx === 2) {
          distritalVal = acta.votos_partido_d || 0;
        }
      }

      return {
        orden: idx + 1,
        nombre: p.nombre,
        alias: p.alias,
        color: p.color,
        esPropio: p.esPropio,
        distrital: distritalVal,
        provincial: provincialVal,
      };
    });
  });

  // Votos especiales
  const [blancosDistrital, setBlancosDistrital] = useState<number>(
    acta.especiales?.blancos?.distrital ?? acta.votos_blancos ?? 0,
  );
  const [blancosProvincial, setBlancosProvincial] = useState<number>(
    acta.especiales?.blancos?.provincial ?? 0,
  );

  const [nulosDistrital, setNulosDistrital] = useState<number>(
    acta.especiales?.nulos?.distrital ?? acta.votos_nulos ?? 0,
  );
  const [nulosProvincial, setNulosProvincial] = useState<number>(
    acta.especiales?.nulos?.provincial ?? 0,
  );

  const [impugnadosDistrital, setImpugnadosDistrital] = useState<number>(
    acta.especiales?.impugnados?.distrital ?? acta.votos_impugnados ?? 0,
  );
  const [impugnadosProvincial, setImpugnadosProvincial] = useState<number>(
    acta.especiales?.impugnados?.provincial ?? 0,
  );

  // Totales de acta manuscrita
  const [totalDistritalActa, setTotalDistritalActa] = useState<number>(
    acta.totales_emitidos?.distrital ?? acta.total_distrital ?? 0,
  );
  const [totalProvincialActa, setTotalProvincialActa] = useState<number>(
    acta.totales_emitidos?.provincial ?? acta.total_provincial ?? 0,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sumas automáticas calculadas
  const sumPartidosDistrital = useMemo(
    () => partidosRows.reduce((acc, row) => acc + (row.distrital || 0), 0),
    [partidosRows],
  );
  const sumEspecialesDistrital = useMemo(
    () => blancosDistrital + nulosDistrital + impugnadosDistrital,
    [blancosDistrital, nulosDistrital, impugnadosDistrital],
  );
  const sumaTotalCalculadaDistrital = sumPartidosDistrital + sumEspecialesDistrital;

  const sumPartidosProvincial = useMemo(
    () => partidosRows.reduce((acc, row) => acc + (row.provincial || 0), 0),
    [partidosRows],
  );
  const sumEspecialesProvincial = useMemo(
    () => blancosProvincial + nulosProvincial + impugnadosProvincial,
    [blancosProvincial, nulosProvincial, impugnadosProvincial],
  );
  const sumaTotalCalculadaProvincial = sumPartidosProvincial + sumEspecialesProvincial;

  const handlePartyChange = (index: number, field: 'distrital' | 'provincial', value: string) => {
    const parsed = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setPartidosRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: parsed };
      return next;
    });
  };

  const handleAutoSetTotals = () => {
    setTotalDistritalActa(sumaTotalCalculadaDistrital);
    setTotalProvincialActa(sumaTotalCalculadaProvincial);
    if (ciudadanosVotaron === '' || ciudadanosVotaron === 0) {
      setCiudadanosVotaron(sumaTotalCalculadaDistrital);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const mesaNumero = acta.mesa_numero || acta.mesa_id;
      const payload = {
        mesaId: mesaNumero,
        motivo: motivo.trim() || 'Modificación directa autorizada por Modo Dios en auditoría',
        resultados: partidosRows.map((p) => ({
          orden: p.orden,
          organizacion: p.nombre,
          distrital: p.distrital,
          provincial: p.provincial,
          confianza: 1,
        })),
        especiales: {
          blancos: { distrital: blancosDistrital, provincial: blancosProvincial },
          nulos: { distrital: nulosDistrital, provincial: nulosProvincial },
          impugnados: { distrital: impugnadosDistrital, provincial: impugnadosProvincial },
        },
        totalesEmitidos: {
          distrital: totalDistritalActa,
          provincial: totalProvincialActa,
        },
        electoresHabiles: electoresHabiles === '' ? null : electoresHabiles,
        ciudadanosVotaron: ciudadanosVotaron === '' ? null : ciudadanosVotaron,
        observaciones: observaciones.trim(),
      };

      await authenticatedPost('/api/electoral/actas/modify', payload);
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al modificar el acta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const mesaNum = acta.mesa_numero || acta.mesa_id || mesa?.numero || 'S/N';
  const localNombre = local?.nombre || 'Colegio Electoral Chaclacayo';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in-50 duration-200">
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-900 text-white shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl text-amber-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 rounded-full">
                  Modo Dios
                </span>
                <h2 className="text-base sm:text-lg font-bold">Modificación de Acta Electoral</h2>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Mesa <span className="font-mono font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">{mesaNum}</span> • {localNombre}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {acta.foto_url && (
              <button
                type="button"
                onClick={() => setShowPhoto(!showPhoto)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors"
                title="Mostrar u ocultar foto del acta para cotejo"
              >
                {showPhoto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPhoto ? 'Ocultar Foto' : 'Ver Foto'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CUERPO PRINCIPAL (Split View) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
          {/* COLUMNA IZQUIERDA: Visor de Evidencia Fotográfica (Cotejo) */}
          {acta.foto_url && showPhoto && (
            <div className="lg:col-span-5 flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner h-[380px] lg:h-[620px] sticky top-0">
              <div className="px-3 py-2 bg-slate-800/90 text-slate-200 text-xs font-semibold flex items-center justify-between border-b border-slate-700">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                  Evidencia Fotográfica Original
                </span>
                <a
                  href={acta.foto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-300 hover:underline flex items-center gap-1"
                >
                  Abrir en pestaña nueva ↗
                </a>
              </div>
              <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40">
                <Image
                  src={acta.foto_url}
                  alt={`Acta mesa ${mesaNum}`}
                  width={1000}
                  height={1400}
                  unoptimized
                  className="max-w-full max-h-full object-contain rounded"
                />
              </div>
            </div>
          )}

          {/* COLUMNA DERECHA: Formulario de Modificación de Datos */}
          <div className={acta.foto_url && showPhoto ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error al procesar la modificación:</p>
                    <p>{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Justificación obligatoria para auditoría inmutable */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                <label className="block text-xs font-bold text-amber-900">
                  Motivo o Justificación de la Modificación <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Corrección manual de cifra ilegible en casilla distrital según foto original"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-amber-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-amber-700/90">
                  Esta acción quedará registrada de forma inmutable en el historial de auditoría electoral con tu cuenta Modo Dios.
                </p>
              </div>

              {/* TABLA DE RESULTADOS POR PARTIDO */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Votos por Organización Política (12 Partidos Chaclacayo)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Suma distrital actual: <strong className="text-slate-800 font-bold">{sumPartidosDistrital}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50/80 text-slate-600 uppercase text-[10px] font-semibold sticky top-0 border-b border-slate-200 backdrop-blur-sm z-10">
                      <tr>
                        <th className="px-3 py-2 w-8 text-center">N°</th>
                        <th className="px-3 py-2">Organización Política</th>
                        <th className="px-3 py-2 text-center w-28">Voto Distrital</th>
                        <th className="px-3 py-2 text-center w-28">Voto Provincial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partidosRows.map((party, index) => (
                        <tr
                          key={party.orden}
                          className={`transition-colors ${
                            party.esPropio
                              ? 'bg-blue-50/70 hover:bg-blue-100/60 font-semibold'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="px-3 py-2 text-center font-mono text-slate-500">
                            {party.orden}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: party.color }}
                              />
                              <span className="truncate max-w-[220px] text-slate-800">
                                {party.alias}
                              </span>
                              {party.esPropio && (
                                <span className="ml-1.5 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white rounded">
                                  Karen
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="2000"
                              value={party.distrital}
                              onChange={(e) => handlePartyChange(index, 'distrital', e.target.value)}
                              className={`w-20 text-center text-xs font-bold py-1 px-1.5 rounded-md border focus:outline-none focus:ring-2 ${
                                party.esPropio
                                  ? 'border-blue-300 bg-white text-blue-900 focus:ring-blue-500'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-amber-500'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="2000"
                              value={party.provincial}
                              onChange={(e) => handlePartyChange(index, 'provincial', e.target.value)}
                              className="w-20 text-center text-xs font-medium py-1 px-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VOTOS ESPECIALES (Blancos, Nulos, Impugnados) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Votos Especiales de Mesa
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Votos en Blanco</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Distrital</span>
                        <input
                          type="number"
                          min="0"
                          value={blancosDistrital}
                          onChange={(e) => setBlancosDistrital(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-bold py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Provincial</span>
                        <input
                          type="number"
                          min="0"
                          value={blancosProvincial}
                          onChange={(e) => setBlancosProvincial(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-medium py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Votos Nulos</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Distrital</span>
                        <input
                          type="number"
                          min="0"
                          value={nulosDistrital}
                          onChange={(e) => setNulosDistrital(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-bold py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Provincial</span>
                        <input
                          type="number"
                          min="0"
                          value={nulosProvincial}
                          onChange={(e) => setNulosProvincial(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-medium py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Votos Impugnados</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Distrital</span>
                        <input
                          type="number"
                          min="0"
                          value={impugnadosDistrital}
                          onChange={(e) => setImpugnadosDistrital(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-bold py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Provincial</span>
                        <input
                          type="number"
                          min="0"
                          value={impugnadosProvincial}
                          onChange={(e) => setImpugnadosProvincial(parseInt(e.target.value, 10) || 0)}
                          className="w-full text-center text-xs font-medium py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TOTALES DE LA MESA Y CONCILIACIÓN */}
              <div className="bg-slate-100/90 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Totales Emitidos en Acta vs Suma Calculada
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoSetTotals}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Auto-igualar con Suma Física</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] font-semibold text-slate-500 block">Suma Distrital Calculada</span>
                    <span className="text-lg font-black text-slate-800">{sumaTotalCalculadaDistrital}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] font-semibold text-slate-500 block">Total Distrital en Acta</span>
                    <input
                      type="number"
                      min="0"
                      value={totalDistritalActa}
                      onChange={(e) => setTotalDistritalActa(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center text-base font-black py-0.5 text-blue-700 bg-transparent focus:outline-none"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] font-semibold text-slate-500 block">Ciudadanos que Votaron</span>
                    <input
                      type="number"
                      min="0"
                      value={ciudadanosVotaron}
                      onChange={(e) => setCiudadanosVotaron(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center text-base font-black py-0.5 text-slate-800 bg-transparent focus:outline-none"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] font-semibold text-slate-500 block">Electores Hábiles</span>
                    <input
                      type="number"
                      min="0"
                      value={electoresHabiles}
                      onChange={(e) => setElectoresHabiles(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center text-base font-black py-0.5 text-slate-800 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Badge de conciliación */}
                {totalDistritalActa === sumaTotalCalculadaDistrital ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cuadratura perfecta: la suma de organizaciones coincide exactamente con el total del acta.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      Diferencia de {Math.abs(totalDistritalActa - sumaTotalCalculadaDistrital)} votos entre la suma de partidos y el total consignado en el acta.
                    </span>
                  </div>
                )}
              </div>

              {/* OBSERVACIONES */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Observaciones adicionales del acta (opcional)
                </label>
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Anotaciones de los personeros o incidencias de la mesa..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* BOTONES DE CONFIRMACIÓN */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando Cambios...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-amber-200" />
                      <span>Guardar y Aplicar (Modo Dios)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
