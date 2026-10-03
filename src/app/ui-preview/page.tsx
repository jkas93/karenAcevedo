'use client';

import { LocalesElectoralesPanel } from '@/components/electoral/LocalesElectoralesPanel';
import { PersonerosPanel } from '@/components/electoral/PersonerosPanel';
import { CHACLACAYO_ELECTORAL_LOCATIONS } from '@/lib/electoral/locations';
import type { LocalVotacion, Mesa, Personero } from '@/lib/firebase/types';

const locales: LocalVotacion[] = CHACLACAYO_ELECTORAL_LOCATIONS.map((local) => ({
  id: `local-${local.code}`,
  nombre: local.nombre,
  direccion: local.direccion,
  latitud: local.latitud,
  longitud: local.longitud,
  zona_id: local.zona,
  total_mesas: local.mesas,
}));

let mesaNumber = 41158;
const mesas: Mesa[] = locales.flatMap((local) => Array.from({ length: local.total_mesas }, () => {
  const numero = String(mesaNumber++).padStart(6, '0');
  return { id: `mesa-${numero}`, numero, local_id: local.id, estado: 'pendiente' as const };
}));

const personeros: Personero[] = [
  { id: '1', dni: '71260540', nombre_completo: 'Ana Pérez Flores', telefono: '987654321', local_id: 'local-1192', mesa_numero: '041295' },
  { id: '2', dni: '70000001', nombre_completo: 'Luis Torres Rojas', telefono: '912345678', local_id: 'local-1218', mesa_numero: '041174' },
  { id: '3', dni: '73456789', nombre_completo: '', telefono: '', local_id: '', mesa_numero: '' },
];

export default function UiPreviewPage() {
  return <main className="mx-auto min-h-screen max-w-[1500px] space-y-5 bg-slate-50 p-4 md:p-8"><LocalesElectoralesPanel locales={locales} mesas={mesas} /><PersonerosPanel personeros={personeros} locales={locales} mesas={mesas} canManage /></main>;
}
