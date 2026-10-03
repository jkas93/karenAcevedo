'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Plus,
  School,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CHACLACAYO_ELECTORAL_LOCATIONS,
  findElectoralLocation,
  googleMapsUrl,
} from '@/lib/electoral/locations';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import type { LocalVotacion, Mesa, Personero } from '@/lib/firebase/types';
import { validatePersoneroInput, type PersoneroInput } from '@/lib/validation/personero';

const EMPTY_FORM: Required<PersoneroInput> = {
  dni: '',
  nombre_completo: '',
  telefono: '',
  local_id: '',
  mesa_numero: '',
};

function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
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

export function PersonerosPanel({
  personeros,
  locales,
  mesas,
  canManage,
}: {
  personeros: Personero[];
  locales: LocalVotacion[];
  mesas: Mesa[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<
    'todos' | 'en_chaclacayo' | 'fuera_chaclacayo' | 'sin_asignar' | string
  >('todos');
  const [editing, setEditing] = useState<Personero | null>(null);
  const [form, setForm] = useState<Required<PersoneroInput>>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lista de colegios disponibles de Chaclacayo
  const availableLocalesList = useMemo(() => {
    if (locales.length > 0) {
      return [...locales].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return CHACLACAYO_ELECTORAL_LOCATIONS.map((seed) => ({
      id: `local_${seed.code.toLowerCase()}`,
      nombre: seed.nombre,
      direccion: [seed.direccion, seed.referencia].filter(Boolean).join(' · '),
      latitud: seed.latitud,
      longitud: seed.longitud,
      zona_id: seed.zona,
      total_mesas: seed.mesas,
    }));
  }, [locales]);

  // Resolución flexible del colegio/sede
  const resolveLocal = (localId?: string) => {
    if (!localId) return undefined;
    if (localId === 'fuera_chaclacayo') {
      return {
        id: 'fuera_chaclacayo',
        nombre: 'Fuera de Chaclacayo',
        direccion: 'Vota en otro distrito',
        latitud: 0,
        longitud: 0,
        zona_id: 'Externo',
        total_mesas: 0,
        isFuera: true,
      };
    }
    const fromFirestore = locales.find((l) => l.id === localId);
    if (fromFirestore) return fromFirestore;

    const fromList = availableLocalesList.find((l) => l.id === localId);
    if (fromList) return fromList;

    const seed = findElectoralLocation(localId);
    if (seed) {
      return {
        id: localId,
        nombre: seed.nombre,
        direccion: [seed.direccion, seed.referencia].filter(Boolean).join(' · '),
        latitud: seed.latitud,
        longitud: seed.longitud,
        zona_id: seed.zona,
        total_mesas: seed.mesas,
      };
    }
    return undefined;
  };

  // Mesas disponibles para el colegio seleccionado
  const availableMesasForForm = useMemo(() => {
    if (!form.local_id || form.local_id === 'fuera_chaclacayo') return [];
    return mesas
      .filter((m) => m.local_id === form.local_id)
      .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }));
  }, [form.local_id, mesas]);

  // Conteo inteligente de personeros
  const stats = useMemo(() => {
    const total = personeros.length;
    const fueraChaclacayo = personeros.filter((p) => p.local_id === 'fuera_chaclacayo').length;
    const enChaclacayo = personeros.filter(
      (p) => Boolean(p.local_id) && p.local_id !== 'fuera_chaclacayo',
    ).length;
    const sinAsignar = total - enChaclacayo - fueraChaclacayo;
    return { total, enChaclacayo, fueraChaclacayo, sinAsignar };
  }, [personeros]);

  // Filtrado y búsqueda
  const filteredPersoneros = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');

    return personeros
      .filter((p) => {
        if (filterMode === 'en_chaclacayo') {
          return Boolean(p.local_id) && p.local_id !== 'fuera_chaclacayo';
        }
        if (filterMode === 'fuera_chaclacayo') {
          return p.local_id === 'fuera_chaclacayo';
        }
        if (filterMode === 'sin_asignar') {
          return !p.local_id;
        }
        if (filterMode !== 'todos') {
          return p.local_id === filterMode;
        }
        return true;
      })
      .filter((p) => {
        if (!term) return true;
        const local = resolveLocal(p.local_id);
        return [
          p.dni,
          p.nombre_completo,
          p.telefono,
          p.mesa_numero,
          local?.nombre,
          local?.direccion,
        ].some((v) => (v || '').toLocaleLowerCase('es').includes(term));
      })
      .sort((a, b) => (a.nombre_completo || a.dni).localeCompare(b.nombre_completo || b.dni, 'es'));
  }, [personeros, filterMode, search, locales, availableLocalesList]);

  // Validación en tiempo real del DNI ingresado
  const dniCheck = useMemo(() => {
    const cleanDni = form.dni.trim().replace(/\D/g, '');
    if (!cleanDni) return null;
    if (cleanDni.length < 8) {
      return {
        status: 'typing' as const,
        message: `Faltan ${8 - cleanDni.length} dígito(s) (el DNI debe tener 8 números).`,
      };
    }
    if (editing && editing.dni === cleanDni) {
      return {
        status: 'same' as const,
        message: 'DNI actual de este personero (bloqueado para no alterar identidad).',
      };
    }
    const existing = personeros.find((p) => p.dni === cleanDni);
    if (existing) {
      const isFuera = existing.local_id === 'fuera_chaclacayo';
      const local = resolveLocal(existing.local_id);
      return {
        status: 'duplicate' as const,
        existing,
        message: `Este DNI (${cleanDni}) ya se encuentra registrado en el sistema.`,
        personeroName: existing.nombre_completo || '(Sin nombre registrado aún)',
        detail: isFuera
          ? 'Sede: Fuera de Chaclacayo (vota en otro distrito)'
          : local
          ? `Colegio: ${local.nombre} ${existing.mesa_numero ? `· Mesa ${existing.mesa_numero}` : ''}`
          : 'Sin colegio asignado aún.',
      };
    }
    return {
      status: 'available' as const,
      message: '✅ DNI disponible (no registrado previamente). Puedes continuar llenando los datos.',
    };
  }, [form.dni, personeros, editing, availableLocalesList, locales]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setDialogOpen(true);
  };

  const openEdit = (personero: Personero) => {
    setEditing(personero);
    setForm({
      dni: personero.dni || '',
      nombre_completo: personero.nombre_completo || '',
      telefono: personero.telefono || '',
      local_id: personero.local_id || '',
      mesa_numero: personero.mesa_numero || '',
    });
    setFeedback(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    let validated: Required<PersoneroInput>;
    try {
      validated = validatePersoneroInput(form);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Revisa los datos ingresados.',
      });
      return;
    }

    if (!editing && dniCheck?.status === 'duplicate') {
      setFeedback({
        type: 'error',
        text: `El DNI ${form.dni} ya está registrado a nombre de "${dniCheck.personeroName}". No se pueden duplicar personeros.`,
      });
      return;
    }

    setSaving(true);
    try {
      await authenticatedPost<{ success: boolean; id: string }>('/api/electoral/personeros', {
        action: editing ? 'update' : 'create',
        id: editing?.id,
        personero: validated,
      });

      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFeedback({
        type: 'success',
        text: editing
          ? `Personero DNI ${validated.dni} actualizado con éxito.`
          : `Personero DNI ${validated.dni} guardado exitosamente.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar el personero.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (personero: Personero) => {
    const ident = personero.nombre_completo || `DNI ${personero.dni}`;
    if (!window.confirm(`¿Estás seguro de eliminar al personero ${ident}?`)) return;

    setFeedback(null);
    setDeletingId(personero.id);
    try {
      await authenticatedPost<{ success: boolean; id: string }>('/api/electoral/personeros', {
        action: 'delete',
        id: personero.id,
      });
      setFeedback({
        type: 'success',
        text: `Personero ${ident} eliminado correctamente.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo eliminar el personero.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        {/* Cabecera del Panel */}
        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-black text-slate-900 sm:text-xl">
                Padrón de Personeros
              </CardTitle>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Lista completa de personeros: DNI, nombre, celular, sede y ubicación.
            </p>

            {/* Badges de estadísticas rápidas */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700">
                <strong>{stats.total}</strong> en total
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 border border-blue-100">
                <strong>{stats.enChaclacayo}</strong> en Chaclacayo
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 font-bold text-purple-700 border border-purple-100">
                <strong>{stats.fueraChaclacayo}</strong> fuera de Chaclacayo
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 border border-amber-100">
                <strong>{stats.sinAsignar}</strong> sin asignar
              </span>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-98 sm:text-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar personero</span>
            </button>
          )}
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {/* Barra de Filtros y Búsqueda */}
          <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por DNI, nombre, celular o colegio..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selector de Filtro de Sede */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              >
                <option value="todos">Todos los personeros ({stats.total})</option>
                <option value="en_chaclacayo">En Chaclacayo ({stats.enChaclacayo})</option>
                <option value="fuera_chaclacayo">Fuera de Chaclacayo ({stats.fueraChaclacayo})</option>
                <option value="sin_asignar">Sin asignar ({stats.sinAsignar})</option>
                <optgroup label="Por colegio de Chaclacayo">
                  {availableLocalesList.map((loc) => {
                    const countInLocal = personeros.filter((p) => p.local_id === loc.id).length;
                    return (
                      <option key={loc.id} value={loc.id}>
                        {loc.nombre} ({countInLocal})
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Feedback general */}
          {feedback && (
            <div
              role="alert"
              className={`mb-4 flex items-center justify-between rounded-xl border p-3 text-xs font-semibold sm:text-sm ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="rounded-md p-1 hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Lista Principal */}
          {filteredPersoneros.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <UserRound className="h-8 w-8" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800 sm:text-base">
                {personeros.length === 0
                  ? 'Aún no hay personeros registrados'
                  : 'No se encontraron resultados'}
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-500 sm:text-sm">
                {personeros.length === 0
                  ? 'Registra el primer personero ingresando únicamente su DNI.'
                  : 'Intenta cambiar el término de búsqueda o el filtro de sede.'}
              </p>
              {canManage && personeros.length === 0 && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Agregar personero con DNI
                </button>
              )}
            </div>
          ) : (
            <>
              {/* VISTA ESCRITORIO */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">DNI</th>
                      <th className="px-4 py-3">Nombre completo</th>
                      <th className="px-4 py-3">Contacto</th>
                      <th className="px-4 py-3">Sede / Colegio</th>
                      <th className="px-4 py-3 text-center">Ubicación</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersoneros.map((personero) => {
                      const isFuera = personero.local_id === 'fuera_chaclacayo';
                      const local = resolveLocal(personero.local_id);
                      const mapsUrl =
                        local && !isFuera
                          ? googleMapsUrl(local.nombre, local.direccion, local.latitud, local.longitud)
                          : null;

                      return (
                        <tr key={personero.id} className="transition hover:bg-blue-50/30">
                          {/* DNI */}
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-800">
                              {personero.dni}
                            </span>
                          </td>

                          {/* Nombre completo */}
                          <td className="px-4 py-3">
                            {personero.nombre_completo ? (
                              <span className="font-bold text-slate-800">
                                {personero.nombre_completo}
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-400">
                                (Por completar)
                              </span>
                            )}
                          </td>

                          {/* Celular con iconos compactos */}
                          <td className="px-4 py-3">
                            {personero.telefono ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:+51${personero.telefono}`}
                                  title={`Llamar al ${personero.telefono}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 shadow-2xs"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                                <a
                                  href={`https://wa.me/51${personero.telefono}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Abrir WhatsApp con ${personero.telefono}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#25D366] hover:bg-emerald-100 transition border border-emerald-200 shadow-2xs"
                                >
                                  <WhatsAppIcon className="h-4 w-4" />
                                </a>
                                <span className="font-mono text-xs font-semibold text-slate-700 ml-1">
                                  {personero.telefono}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">—</span>
                            )}
                          </td>

                          {/* Sede / Colegio */}
                          <td className="px-4 py-3">
                            {isFuera ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700 border border-purple-200">
                                <MapPin className="h-3 w-3 text-purple-600" />
                                Fuera de Chaclacayo
                              </span>
                            ) : local ? (
                              <div>
                                <span className="font-semibold text-slate-800 block text-xs">
                                  {local.nombre}
                                </span>
                                {personero.mesa_numero ? (
                                  <span className="text-[11px] font-bold text-blue-600">
                                    Mesa N° {personero.mesa_numero}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    Sin mesa específica
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                                Sin asignar
                              </span>
                            )}
                          </td>

                          {/* Ubicación Google Maps con icono compacto */}
                          <td className="px-4 py-3 text-center">
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={`Ver ubicación de ${local?.nombre} en Google Maps`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-2xs border border-slate-200"
                              >
                                <Navigation className="h-4 w-4" />
                              </a>
                            ) : isFuera ? (
                              <span
                                title="Vota fuera de Chaclacayo"
                                className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100"
                              >
                                Externo
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-300">—</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 text-right">
                            {canManage && (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(personero)}
                                  title="Editar personero"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(personero)}
                                  disabled={deletingId === personero.id}
                                  title="Eliminar personero"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                                >
                                  {deletingId === personero.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISTA MÓVIL (Tarjetas compactas) */}
              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {filteredPersoneros.map((personero) => {
                  const isFuera = personero.local_id === 'fuera_chaclacayo';
                  const local = resolveLocal(personero.local_id);
                  const mapsUrl =
                    local && !isFuera
                      ? googleMapsUrl(local.nombre, local.direccion, local.latitud, local.longitud)
                      : null;

                  return (
                    <article
                      key={personero.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-blue-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold rounded-md bg-slate-100 px-2 py-0.5 text-slate-800">
                              {personero.dni}
                            </span>
                            {isFuera ? (
                              <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                                Fuera de Chaclacayo
                              </span>
                            ) : local ? (
                              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                {local.nombre.replace(/^I\.E\.\s*/, '')}
                              </span>
                            ) : (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Sin colegio
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 font-bold text-sm text-slate-900 truncate">
                            {personero.nombre_completo || (
                              <span className="italic text-slate-400">Sin nombre registrado</span>
                            )}
                          </h4>
                          {personero.mesa_numero && !isFuera && (
                            <p className="text-[11px] font-semibold text-blue-600 mt-0.5">
                              Mesa N° {personero.mesa_numero}
                            </p>
                          )}
                        </div>

                        {/* Botones de acción compactos */}
                        <div className="flex items-center gap-1 shrink-0">
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver en Google Maps"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition border border-blue-200"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(personero)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(personero)}
                                disabled={deletingId === personero.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Contacto en móvil con botones compactos */}
                      {personero.telefono && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {personero.telefono}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:+51${personero.telefono}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 border border-blue-100"
                            >
                              <Phone className="h-3 w-3" />
                              <span>Llamar</span>
                            </a>
                            <a
                              href={`https://wa.me/51${personero.telefono}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-[#25D366] border border-emerald-100"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE AGREGAR / EDITAR PERSONERO */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="personero-dialog-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"
          >
            {/* Header Modal */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 id="personero-dialog-title" className="text-lg font-black text-slate-900">
                  {editing ? 'Editar personero' : 'Nuevo personero'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editing
                    ? 'El DNI está protegido. Puedes actualizar nombre, celular, sede y mesa.'
                    : 'El único requisito indispensable es el DNI.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
              {/* DNI */}
              <div className="sm:col-span-2">
                <label htmlFor="form-dni" className="mb-1 block text-xs font-bold text-slate-700">
                  DNI {editing ? <span className="text-slate-400 font-normal">(Bloqueado)</span> : <span className="text-red-500">* (Obligatorio)</span>}
                </label>
                <div className="relative">
                  <input
                    id="form-dni"
                    autoFocus={!editing}
                    required
                    disabled={Boolean(editing)}
                    readOnly={Boolean(editing)}
                    inputMode="numeric"
                    maxLength={8}
                    value={form.dni}
                    onChange={(e) =>
                      !editing &&
                      setForm((current) => ({
                        ...current,
                        dni: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className={`h-11 w-full rounded-xl border font-mono text-sm font-bold px-3 outline-none transition focus:ring-2 ${
                      editing
                        ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed pl-9'
                        : dniCheck?.status === 'duplicate'
                        ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500 focus:ring-amber-100'
                        : dniCheck?.status === 'available'
                        ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-100'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                    placeholder="8 dígitos numéricos"
                  />
                  {editing && (
                    <div className="absolute left-3 top-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {editing ? (
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Lock className="h-3 w-3 text-slate-400" />
                    El DNI no se puede modificar al editar un personero ya registrado.
                  </p>
                ) : (
                  dniCheck && (
                    <div className="mt-2">
                      {dniCheck.status === 'duplicate' && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 font-black text-amber-900">
                                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                                <span>{dniCheck.message}</span>
                              </div>
                              <p className="mt-1 text-slate-800">
                                <strong>Personero actual:</strong> {dniCheck.personeroName}
                              </p>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {dniCheck.detail}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEdit(dniCheck.existing)}
                              className="shrink-0 rounded-lg bg-amber-700 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-800 transition cursor-pointer"
                            >
                              Editar este personero ↗
                            </button>
                          </div>
                        </div>
                      )}

                      {dniCheck.status === 'available' && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{dniCheck.message}</span>
                        </div>
                      )}

                      {dniCheck.status === 'typing' && (
                        <p className="text-[11px] font-medium text-slate-500">
                          {dniCheck.message}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Nombre completo */}
              <div className="sm:col-span-2">
                <label htmlFor="form-nombre" className="mb-1 block text-xs font-bold text-slate-700">
                  Nombre completo <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <input
                  id="form-nombre"
                  value={form.nombre_completo}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      nombre_completo: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Nombres y apellidos completos"
                />
              </div>

              {/* Celular */}
              <div className="sm:col-span-2">
                <label htmlFor="form-telefono" className="mb-1 block text-xs font-bold text-slate-700">
                  Número de celular <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <input
                  id="form-telefono"
                  inputMode="tel"
                  maxLength={9}
                  value={form.telefono}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      telefono: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="9 dígitos (iniciando con 9)"
                />
              </div>

              {/* Colegio / Sede (con opción Fuera de Chaclacayo) */}
              <div className="sm:col-span-2">
                <label htmlFor="form-local" className="mb-1 block text-xs font-bold text-slate-700">
                  Sede / Colegio de votación <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <select
                  id="form-local"
                  value={form.local_id}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      local_id: e.target.value,
                      mesa_numero: e.target.value === 'fuera_chaclacayo' ? '' : current.mesa_numero,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Sin asignar (opcional) —</option>
                  <option value="fuera_chaclacayo">📍 Fuera de Chaclacayo (Vota en otro distrito)</option>
                  <optgroup label="Colegios oficiales de Chaclacayo">
                    {availableLocalesList.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.nombre} ({local.total_mesas} mesas)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Mesa */}
              <div className="sm:col-span-2">
                <label htmlFor="form-mesa" className="mb-1 block text-xs font-bold text-slate-700">
                  Mesa de sufragio{' '}
                  <span className="font-normal text-slate-400">
                    {form.local_id === 'fuera_chaclacayo' ? '(Opcional / Externa)' : '(Opcional)'}
                  </span>
                </label>
                {form.local_id === 'fuera_chaclacayo' ? (
                  <input
                    id="form-mesa"
                    maxLength={10}
                    value={form.mesa_numero}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        mesa_numero: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="Número de mesa externa (opcional)"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                ) : (
                  <select
                    id="form-mesa"
                    disabled={!form.local_id}
                    value={form.mesa_numero}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        mesa_numero: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {form.local_id
                        ? availableMesasForForm.length > 0
                          ? '— Sin mesa específica (opcional) —'
                          : 'No hay mesas creadas en este colegio'
                        : 'Primero selecciona un colegio arriba'}
                    </option>
                    {availableMesasForForm.map((mesa) => (
                      <option key={mesa.id} value={mesa.numero}>
                        Mesa N° {mesa.numero}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Feedback error */}
              {feedback?.type === 'error' && (
                <div
                  role="alert"
                  className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    saving || (!editing && dniCheck?.status === 'duplicate') || form.dni.length !== 8
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 sm:text-sm cursor-pointer"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? 'Guardando…'
                    : !editing && dniCheck?.status === 'duplicate'
                    ? 'DNI ya registrado'
                    : editing
                    ? 'Guardar cambios'
                    : 'Guardar personero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
