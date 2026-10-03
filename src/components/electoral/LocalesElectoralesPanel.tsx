'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, MapPin, School, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CHACLACAYO_ELECTORAL_LOCATIONS,
  CHACLACAYO_TOTAL_MESAS,
  googleMapsUrl,
} from '@/lib/electoral/locations';
import type { LocalVotacion, Mesa } from '@/lib/firebase/types';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function LocalesElectoralesPanel({
  locales,
  mesas,
}: {
  locales: LocalVotacion[];
  mesas: Mesa[];
}) {
  const [selectedCode, setSelectedCode] = useState(CHACLACAYO_ELECTORAL_LOCATIONS[0].code);
  const selected = CHACLACAYO_ELECTORAL_LOCATIONS.find((local) => local.code === selectedCode)
    ?? CHACLACAYO_ELECTORAL_LOCATIONS[0];

  const liveByCode = useMemo(() => {
    const entries = CHACLACAYO_ELECTORAL_LOCATIONS.map((reference) => {
      const targetName = normalize(reference.nombre);
      const local = locales.find((item) => {
        const currentName = normalize(item.nombre);
        return currentName.includes(reference.code) || currentName === targetName || currentName.includes(normalize(reference.shortName));
      });
      const localMesas = local ? mesas.filter((mesa) => mesa.local_id === local.id) : [];
      return [reference.code, { local, localMesas }] as const;
    });
    return new Map(entries);
  }, [locales, mesas]);

  const selectedLive = liveByCode.get(selected.code);
  const reportadas = selectedLive?.localMesas.filter((mesa) => mesa.estado === 'enviada').length ?? 0;
  const databaseAligned = CHACLACAYO_ELECTORAL_LOCATIONS.every((reference) => {
    const live = liveByCode.get(reference.code);
    return live?.local && live.localMesas.length === reference.mesas;
  });

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-white pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-blue-600" />
              Locales y recursos electorales
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">8 locales confirmados · {CHACLACAYO_TOTAL_MESAS} mesas asignadas</p>
          </div>
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${databaseAligned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            {databaseAligned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-amber-500" />}
            {databaseAligned ? 'Base sincronizada' : 'Pendiente de cargar en Configuración'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {CHACLACAYO_ELECTORAL_LOCATIONS.map((local) => {
            const active = local.code === selected.code;
            return (
              <button
                key={local.code}
                type="button"
                onClick={() => setSelectedCode(local.code)}
                className={`min-h-24 rounded-xl border p-3 text-left transition ${active ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-blue-600' : 'text-slate-400'}`}>I.E. {local.code}</span>
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">{local.mesas} mesas</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-bold leading-4 text-slate-800 sm:text-sm">{local.shortName}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-slate-900">{selected.nombre}</h3>
              {selected.coordinador && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">Coord. {selected.coordinador}</span>}
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{selected.direccion}{selected.referencia ? ` · ${selected.referencia}` : ''}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-slate-700 shadow-sm"><UsersRound className="h-3.5 w-3.5 text-blue-600" /> {selected.mesas} mesas habilitadas</span>
              <span className="rounded-lg bg-white px-3 py-2 text-slate-700 shadow-sm">{reportadas} actas reportadas</span>
            </div>
          </div>
          <a
            href={googleMapsUrl(selected.nombre, selected.direccion, selected.latitud, selected.longitud)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 sm:w-auto sm:text-sm"
          >
            <MapPin className="h-4 w-4" /> Abrir en Google Maps <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
