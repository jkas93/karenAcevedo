'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  MessageCircle,
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
  const [filterMode, setFilterMode] = useState<'todos' | 'asignados' | 'sin_asignar' | string>('todos');
  const [editing, setEditing] = useState<Personero | null>(null);
  const [form, setForm] = useState<Required<PersoneroInput>>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lista de locales disponibles para selector (Firestore o fallback de Chaclacayo)
  const availableLocalesList = useMemo(() => {
    if (locales.length > 0) {
      return [...locales].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return CHACLACAYO_ELECTORAL_LOCATIONS.map((seed) => ({
      id: `local-${seed.code}`,
      nombre: seed.nombre,
      direccion: [seed.direccion, seed.referencia].filter(Boolean).join(' · '),
      latitud: seed.latitud,
      longitud: seed.longitud,
      zona_id: seed.zona,
      total_mesas: seed.mesas,
    }));
  }, [locales]);

  // Resolución flexible del colegio para cada personero
  const resolveLocal = (localId?: string) => {
    if (!localId) return undefined;
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

  // Mesas disponibles para el colegio actualmente seleccionado en el formulario
  const availableMesasForForm = useMemo(() => {
    if (!form.local_id) return [];
    return mesas
      .filter((m) => m.local_id === form.local_id)
      .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }));
  }, [form.local_id, mesas]);

  // Conteo de personeros con y sin colegio
  const stats = useMemo(() => {
    const total = personeros.length;
    const conColegio = personeros.filter((p) => Boolean(p.local_id)).length;
    const sinColegio = total - conColegio;
    return { total, conColegio, sinColegio };
  }, [personeros]);

  // Filtrado y búsqueda
  const filteredPersoneros = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');

    return personeros
      .filter((p) => {
        if (filterMode === 'asignados') return Boolean(p.local_id);
        if (filterMode === 'sin_asignar') return !p.local_id;
        if (filterMode !== 'todos') return p.local_id === filterMode;
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
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {/* Header con título y botón de agregar */}
        <CardHeader className="border-b border-slate-100 bg-white pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                Lista completa de personeros: DNI, nombre, celular, colegio asignado y ubicación directa en Google Maps.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 sm:text-sm"
              >
                <Plus className="h-4 w-4" /> Agregar personero
              </button>
            )}
          </div>

          {/* Estadísticas rápidas */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              <strong className="text-slate-900">{stats.total}</strong> en total
            </span>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800 border border-emerald-200/60">
              <strong className="text-emerald-900">{stats.conColegio}</strong> con colegio asignado
            </span>
            {stats.sinColegio > 0 && (
              <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800 border border-amber-200/60">
                <strong className="text-amber-900">{stats.sinColegio}</strong> sin colegio (solo DNI)
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Barra de Filtros y Búsqueda */}
          <div className="grid gap-2.5 border-b border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-[1fr_auto] sm:p-4 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por DNI, nombre, celular, colegio o mesa..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              >
                <option value="todos">Todos los personeros</option>
                <option value="asignados">Con colegio asignado</option>
                <option value="sin_asignar">Sin colegio (por asignar)</option>
                <optgroup label="Filtrar por colegio:">
                  {availableLocalesList.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nombre}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Feedback general */}
          {feedback && !dialogOpen && (
            <div
              role="status"
              className={`m-3 flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold sm:m-4 sm:text-sm ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="rounded-md p-1 hover:bg-black/5"
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Contenido Principal: Tabla (Escritorio) y Tarjetas (Móvil) */}
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
                  ? 'Registra el primer personero ingresando únicamente su DNI. Los demás datos podrás completarlos en cualquier momento.'
                  : 'Intenta cambiar los términos de búsqueda o quitar los filtros de colegio.'}
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
              {/* VISTA ESCRITORIO (md y superior) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">DNI</th>
                      <th className="px-4 py-3">Nombre completo</th>
                      <th className="px-4 py-3">Celular</th>
                      <th className="px-4 py-3">Colegio asignado</th>
                      <th className="px-4 py-3 text-center">Ubicación Google Maps</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersoneros.map((personero) => {
                      const local = resolveLocal(personero.local_id);
                      const mapsUrl = local
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

                          {/* Celular */}
                          <td className="px-4 py-3">
                            {personero.telefono ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:+51${personero.telefono}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:underline"
                                  title="Llamar"
                                >
                                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{personero.telefono}</span>
                                </a>
                                <a
                                  href={`https://wa.me/51${personero.telefono}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50"
                                  title="Enviar WhatsApp"
                                  aria-label={`WhatsApp con ${personero.nombre_completo || personero.dni}`}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">Sin celular</span>
                            )}
                          </td>

                          {/* Colegio Asignado */}
                          <td className="px-4 py-3">
                            {local ? (
                              <div className="max-w-[260px]">
                                <p className="truncate font-semibold text-slate-800 text-xs">
                                  {local.nombre}
                                </p>
                                {personero.mesa_numero ? (
                                  <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                                    Mesa {personero.mesa_numero}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 inline-block text-[10px] text-slate-400">
                                    Mesa pendiente
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                                Sin colegio asignado
                              </span>
                            )}
                          </td>

                          {/* Botón Google Maps */}
                          <td className="px-4 py-3 text-center">
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Abrir ubicación de ${local?.nombre} en Google Maps`}
                                title={`Abrir ubicación de ${local?.nombre} en Google Maps`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100 hover:text-emerald-800 active:scale-95"
                              >
                                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Google Maps</span>
                                <ExternalLink className="h-3 w-3 text-emerald-500" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(personero)}
                                  aria-label={`Editar a ${personero.nombre_completo || personero.dni}`}
                                  title="Editar personero"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canManage && (
                                <button
                                  type="button"
                                  disabled={deletingId === personero.id}
                                  onClick={() => handleDelete(personero)}
                                  aria-label={`Eliminar a ${personero.nombre_completo || personero.dni}`}
                                  title="Eliminar personero"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISTA MÓVIL (Compacta, elegante, touch-friendly) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredPersoneros.map((personero) => {
                  const local = resolveLocal(personero.local_id);
                  const mapsUrl = local
                    ? googleMapsUrl(local.nombre, local.direccion, local.latitud, local.longitud)
                    : null;

                  return (
                    <article key={personero.id} className="p-3.5 sm:p-4">
                      {/* Cabecera de tarjeta: DNI y mesa */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                              DNI {personero.dni}
                            </span>
                            {personero.mesa_numero ? (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/50">
                                Mesa {personero.mesa_numero}
                              </span>
                            ) : null}
                          </div>

                          <h4 className="mt-1.5 font-bold text-slate-900 text-sm leading-snug">
                            {personero.nombre_completo || (
                              <span className="text-slate-400 font-normal italic text-xs">
                                (Nombre por completar)
                              </span>
                            )}
                          </h4>
                        </div>

                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(personero)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
                              aria-label={`Editar ${personero.nombre_completo || personero.dni}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === personero.id}
                              onClick={() => handleDelete(personero)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 disabled:opacity-50"
                              aria-label={`Eliminar ${personero.nombre_completo || personero.dni}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Info de Colegio */}
                      <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                        <div className="flex items-start gap-1.5">
                          <School className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 leading-tight">
                              {local?.nombre ?? (
                                <span className="text-amber-700 font-semibold">
                                  Sin colegio asignado todavía
                                </span>
                              )}
                            </p>
                            {local?.direccion && (
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {local.direccion}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botón prominente de Google Maps en móvil */}
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2.5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98]"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Ver local en Google Maps</span>
                            <ExternalLink className="h-3 w-3 opacity-80" />
                          </a>
                        )}
                      </div>

                      {/* Teléfono / WhatsApp en móvil */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {personero.telefono ? (
                          <>
                            <a
                              href={`tel:+51${personero.telefono}`}
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{personero.telefono}</span>
                            </a>
                            <a
                              href={`https://wa.me/51${personero.telefono}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] italic text-slate-400">
                            Sin celular registrado
                          </span>
                        )}
                      </div>
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
                  El único requisito indispensable es el DNI.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Aviso informativo de requisito único */}
            <div className="p-5 pb-0">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block text-blue-950 font-bold">
                    Requisito indispensable: solo el DNI
                  </strong>
                  Puedes guardar el personero únicamente con su DNI (8 dígitos). Los demás datos (nombre, celular, colegio y mesa) son opcionales y podrás completarlos o editarlos después.
                </div>
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
              {/* DNI (Único obligatorio) */}
              <div className="sm:col-span-2">
                <label htmlFor="form-dni" className="mb-1 block text-xs font-bold text-slate-700">
                  DNI <span className="text-red-500">* (Obligatorio e indispensable)</span>
                </label>
                <input
                  id="form-dni"
                  autoFocus
                  required
                  inputMode="numeric"
                  maxLength={8}
                  value={form.dni}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      dni: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="8 dígitos numéricos"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Ingresa los 8 números del DNI para registrar o buscar.
                </p>
              </div>

              {/* Nombre completo (Opcional) */}
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
                  placeholder="Nombres y apellidos (opcional)"
                />
              </div>

              {/* Celular (Opcional) */}
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
                  placeholder="9XXXXXXXX (opcional)"
                />
              </div>

              {/* Colegio (Opcional) */}
              <div className="sm:col-span-2">
                <label htmlFor="form-local" className="mb-1 block text-xs font-bold text-slate-700">
                  Colegio donde será personero <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <select
                  id="form-local"
                  value={form.local_id}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      local_id: e.target.value,
                      mesa_numero: '',
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Sin asignar colegio todavía (opcional) —</option>
                  {availableLocalesList.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nombre} {loc.total_mesas ? `(${loc.total_mesas} mesas)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mesa (Opcional) */}
              <div className="sm:col-span-2">
                <label htmlFor="form-mesa" className="mb-1 block text-xs font-bold text-slate-700">
                  Número de mesa <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <select
                  id="form-mesa"
                  disabled={!form.local_id || availableMesasForForm.length === 0}
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
              </div>

              {/* Error feedback */}
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
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 sm:text-sm"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar personero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
