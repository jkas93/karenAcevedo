'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  Phone,
  School,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CHACLACAYO_ELECTORAL_LOCATIONS,
  findElectoralLocation,
  googleMapsUrl,
} from '@/lib/electoral/locations';
import type { Acta, LocalVotacion, Mesa, Personero } from '@/lib/firebase/types';

function WhatsAppIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
    </svg>
  );
}

interface ColegiosDetallePanelProps {
  locales: LocalVotacion[];
  mesas: Mesa[];
  personeros: Personero[];
  actas: Acta[];
  onSelectPersonero?: (personero: Personero) => void;
}

export function ColegiosDetallePanel({
  locales,
  mesas,
  personeros,
  actas,
  onSelectPersonero,
}: ColegiosDetallePanelProps) {
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);

  // Unificación de colegios (Firestore o catálogo de Chaclacayo)
  const colegios = useMemo(() => {
    return CHACLACAYO_ELECTORAL_LOCATIONS.map((seed, idx) => {
      const docId = `local_${seed.code.toLowerCase()}`;
      const firestoreLocal = locales.find(
        (l) => l.id === docId || l.id === seed.code || l.nombre.includes(seed.shortName),
      );

      // Mesas del colegio
      const mesasColegio = mesas
        .filter((m) => m.local_id === firestoreLocal?.id || m.local_id === docId)
        .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }));

      // Personeros asignados a este colegio
      const personerosColegio = personeros.filter(
        (p) =>
          p.local_id === firestoreLocal?.id ||
          p.local_id === docId ||
          p.local_id === seed.code ||
          (p.local_id && p.local_id.includes(seed.code.toLowerCase())),
      );

      // Mesas que tienen al menos un personero asignado
      const mesasConPersonero = mesasColegio.filter((m) =>
        personerosColegio.some((p) => p.mesa_numero === m.numero),
      );

      // Actas procesadas de este colegio
      const actasColegio = actas.filter((a) =>
        mesasColegio.some((m) => m.id === a.mesa_id || m.numero === a.mesa_id),
      );

      const totalMesas = seed.mesas;
      const coberturaPct =
        totalMesas > 0 ? Math.round((mesasConPersonero.length / totalMesas) * 100) : 0;
      const escrutinioPct =
        totalMesas > 0 ? Math.round((actasColegio.length / totalMesas) * 100) : 0;

      return {
        id: firestoreLocal?.id || docId,
        seedCode: seed.code,
        numero: idx + 1,
        nombre: seed.nombre,
        shortName: seed.shortName,
        direccion: [seed.direccion, seed.referencia].filter(Boolean).join(' · '),
        zona: seed.zona,
        latitud: seed.latitud,
        longitud: seed.longitud,
        coordinador: seed.coordinador,
        totalMesas,
        mesas: mesasColegio,
        personeros: personerosColegio,
        mesasConPersonero,
        actas: actasColegio,
        coberturaPct,
        escrutinioPct,
      };
    });
  }, [locales, mesas, personeros, actas]);

  // Resumen global de los 8 colegios
  const resumen = useMemo(() => {
    const totalColegios = colegios.length;
    const totalMesas = colegios.reduce((acc, c) => acc + c.totalMesas, 0);
    const totalPersonerosAsignados = colegios.reduce((acc, c) => acc + c.personeros.length, 0);
    const mesasCubiertas = colegios.reduce((acc, c) => acc + c.mesasConPersonero.length, 0);
    const coberturaGlobal = totalMesas > 0 ? Math.round((mesasCubiertas / totalMesas) * 100) : 0;

    return {
      totalColegios,
      totalMesas,
      totalPersonerosAsignados,
      mesasCubiertas,
      mesasDescubiertas: totalMesas - mesasCubiertas,
      coberturaGlobal,
    };
  }, [colegios]);

  return (
    <div className="space-y-6">
      {/* Tarjeta de Resumen de Cobertura */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-200">
                <School className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Despliegue Territorial Oficial
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black sm:text-2xl text-white">
                Los 8 Centros de Votación de Chaclacayo
              </h2>
              <p className="mt-1 text-xs text-blue-100/80 sm:text-sm">
                Control de cobertura de mesas, personeros adentro y avance de escrutinio en cada local.
              </p>
            </div>

            {/* Métricas destacadas responsivas */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="rounded-xl bg-white/10 px-2 sm:px-4 py-2 sm:py-2.5 backdrop-blur-xs text-center border border-white/10">
                <p className="text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase">Mesas</p>
                <p className="text-xl sm:text-2xl font-black text-white">{resumen.totalMesas}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 sm:px-4 py-2 sm:py-2.5 backdrop-blur-xs text-center border border-white/10">
                <p className="text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase">Personeros</p>
                <p className="text-xl sm:text-2xl font-black text-amber-300">{resumen.totalPersonerosAsignados}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 sm:px-4 py-2 sm:py-2.5 backdrop-blur-xs text-center border border-white/10">
                <p className="text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase">Cobertura</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-400">{resumen.coberturaGlobal}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de los 8 Colegios */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {colegios.map((col) => {
          const isSelected = selectedLocalId === col.id;
          const mapsUrl = googleMapsUrl(col.nombre, col.direccion, col.latitud, col.longitud);

          return (
            <Card
              key={col.id}
              className={`transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
                  : 'hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Encabezado del Colegio */}
              <CardHeader className="p-4 sm:p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-xs">
                      #{col.numero}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {col.zona}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {col.totalMesas} mesas oficiales
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold text-base text-slate-900 leading-snug">
                        {col.nombre}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                        {col.direccion}
                      </p>
                    </div>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`Abrir ubicación de ${col.shortName} en Google Maps`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-2xs border border-slate-200"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                </div>

                {/* Coordinador del colegio */}
                {col.coordinador && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs border border-slate-100">
                    <span className="text-slate-500 font-medium">
                      Coordinador: <strong className="text-slate-800">{col.coordinador}</strong>
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      En funciones
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0">
                {/* Barras de Estado */}
                <div className="space-y-2.5 border-t border-slate-100 pt-3">
                  {/* Cobertura de Personeros */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        Personeros en mesas:
                      </span>
                      <span className="font-bold text-slate-900">
                        {col.personeros.length} de {col.totalMesas}{' '}
                        <span className="text-slate-400 font-normal">
                          ({col.personeros.length >= col.totalMesas ? '100%' : `${col.coberturaPct}%`})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          col.personeros.length >= col.totalMesas
                            ? 'bg-emerald-500'
                            : col.personeros.length > 0
                            ? 'bg-blue-500'
                            : 'bg-amber-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            col.totalMesas > 0 ? (col.personeros.length / col.totalMesas) * 100 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Avance de Actas */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Actas escrutadas:
                      </span>
                      <span className="font-bold text-slate-900">
                        {col.actas.length} de {col.totalMesas}{' '}
                        <span className="text-slate-400 font-normal">({col.escrutinioPct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                        style={{ width: `${col.escrutinioPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botón para abrir / cerrar detalle de mesas */}
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {col.personeros.length} personeros asignados
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedLocalId(isSelected ? null : col.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>{isSelected ? 'Ocultar mesas y personal' : 'Ver detalle de mesas'}</span>
                    {isSelected ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* DETALLE EXPANDIDO: Cuadrícula de mesas y lista de personeros */}
                {isSelected && (
                  <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    {/* Cuadrícula visual de las mesas de este colegio */}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                        <span>Semáforo de Mesas ({col.totalMesas} mesas)</span>
                      </h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                        {col.mesas.length > 0
                          ? col.mesas.map((mesa) => {
                              const personeroMesa = col.personeros.find(
                                (p) => p.mesa_numero === mesa.numero,
                              );
                              const actaMesa = col.actas.find(
                                (a) => a.mesa_id === mesa.id || a.mesa_id === mesa.numero,
                              );

                              let bg = 'bg-white border-slate-200 text-slate-700';
                              if (actaMesa) {
                                bg = 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold';
                              } else if (personeroMesa) {
                                bg = 'bg-blue-100 border-blue-300 text-blue-900 font-bold';
                              } else {
                                bg = 'bg-amber-50 border-amber-200 text-amber-800';
                              }

                              return (
                                <div
                                  key={mesa.id}
                                  title={
                                    personeroMesa
                                      ? `Mesa ${mesa.numero} — Personero: ${personeroMesa.nombre_completo || 'Asignado'}`
                                      : `Mesa ${mesa.numero} — Sin personero asignado`
                                  }
                                  className={`rounded-lg border p-1.5 text-center text-[11px] transition shadow-2xs ${bg}`}
                                >
                                  <span className="font-mono block leading-none">{mesa.numero}</span>
                                  <span className="text-[9px] block mt-0.5 opacity-80">
                                    {actaMesa ? 'Acta OK' : personeroMesa ? 'Cubierta' : 'Libre'}
                                  </span>
                                </div>
                              );
                            })
                          : Array.from({ length: col.totalMesas }).map((_, i) => (
                              <div
                                key={i}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-center text-[11px] text-slate-500"
                              >
                                Mesa {i + 1}
                              </div>
                            ))}
                      </div>
                    </div>

                    {/* Personeros asignados en este colegio */}
                    <div className="pt-2 border-t border-slate-200">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Personeros asignados a este local ({col.personeros.length})
                      </h4>
                      {col.personeros.length === 0 ? (
                        <p className="text-xs italic text-slate-400 bg-white p-3 rounded-xl border border-slate-200 text-center">
                          Aún no hay personeros asignados a este colegio. Puedes asignarles este local desde el Padrón de Personeros.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {col.personeros.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs border border-slate-200 shadow-2xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {p.dni}
                                  </span>
                                  {p.mesa_numero ? (
                                    <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                      Mesa {p.mesa_numero}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px] italic">
                                      General
                                    </span>
                                  )}
                                </div>
                                <p className="font-bold text-slate-800 truncate mt-0.5">
                                  {p.nombre_completo || 'Sin nombre registrado'}
                                </p>
                              </div>

                              {p.telefono && (
                                <a
                                  href={`https://wa.me/51${p.telefono}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Contactar por WhatsApp"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-[#25D366] border border-emerald-200 shrink-0 hover:bg-emerald-100 transition shadow-2xs"
                                >
                                  <WhatsAppIcon className="h-3 w-3 shrink-0" />
                                  <span>{p.telefono}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
