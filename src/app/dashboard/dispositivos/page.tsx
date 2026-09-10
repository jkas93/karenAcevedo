'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone, Plus, RefreshCw, Search, X, ShieldCheck, Link2,
  CheckCircle2, PauseCircle, XCircle, CheckSquare, Square,
  Clock, AlertTriangle, Layers, ChevronRight, MoreVertical,
  User, Check, PhoneCall
} from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { STATE_LABELS, type Device, type DeviceAudit } from '@/lib/autoclicker/types';

const api = <T,>(body: Record<string, unknown>) => authenticatedPost<T>('/api/autoclicker/admin', body);
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100';
const date = (n: number | null) => n ? new Date(n).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación.';

function StateBadge({ device, now }: { device: Device; now: number }) {
  const expired = device.state === 'enabled' && device.expiresAt !== null && device.expiresAt <= now;
  const isOnline = device.lastSeenAt && now - device.lastSeenAt < 35000;

  if (device.state === 'enabled' && !expired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/80">
        <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isOnline ? 'animate-pulse' : ''}`} />
        Habilitado
      </span>
    );
  }
  if (device.state === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Suspendido
      </span>
    );
  }
  if (device.state === 'revoked') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200/80">
        Revocado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
      {expired ? 'Expirado' : STATE_LABELS[device.state] || 'Deshabilitado'}
    </span>
  );
}

export default function DevicesPage() {
  const { hasPermission } = useAccess();
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pairOpen, setPairOpen] = useState(false);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ metadata: Device['metadata']; expiresAt: number } | null>(null);
  const [owner, setOwner] = useState('');
  const [alias, setAlias] = useState('');
  const [selected, setSelected] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceAudit[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const generation = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const cancelLoad = useCallback(() => { generation.current++; }, []);

  // ── Keyboard accessibility for modals ──────────────────────────────────
  useEffect(() => {
    if (!pairOpen && !selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[aria-labelledby="device-dialog-title"]');
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';
    dialog?.querySelector<HTMLElement>(selector)?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !bulkBusy) { setPairOpen(false); setSelected(null); setError(''); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [pairOpen, selected, busy, bulkBusy]);

  const load = useCallback(async (next: string | null = null) => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await api<{ devices: Device[]; nextCursor: string | null }>({
        action: 'list', search: search.trim(), state: filter, cursor: next
      });
      if (request !== generation.current) return;
      setDevices(prev => next ? [...prev, ...result.devices] : result.devices);
      setCursor(result.nextCursor); setError('');
    } catch (e) {
      if (request === generation.current) setError(errorText(e));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 300);
    return () => { clearTimeout(timer); cancelLoad(); };
  }, [load, cancelLoad]);

  async function perform(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  // ── Quick action for single device ─────────────────────────────────────
  async function quickChange(deviceId: string, state: 'enabled' | 'suspended' | 'revoked') {
    setQuickBusy(deviceId); setError(''); setMessage('');
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return;
      await api<{ device: Device }>({
        action: 'authorize', deviceId, version: device.version,
        operationId: crypto.randomUUID(), state, reason: 'Acción rápida desde panel',
        expiresAt: null,
      });
      setMessage(
        state === 'enabled' ? `✓ ${device.alias || device.owner} habilitado.` :
        state === 'suspended' ? `Equipo ${device.alias || device.owner} suspendido.` :
        `Acceso de ${device.alias || device.owner} revocado.`
      );
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setQuickBusy(null);
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────
  const selectableDevices = devices.filter(d => d.state !== 'revoked');
  const allSelected = selectableDevices.length > 0 && selectableDevices.every(d => selectedIds.has(d.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableDevices.map(d => d.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Bulk state change action ───────────────────────────────────────────
  async function handleBulkAction(state: 'enabled' | 'suspended' | 'revoked') {
    const targets = devices.filter(d => selectedIds.has(d.id) && d.state !== 'revoked');
    if (targets.length === 0) return;

    if (state === 'revoked') {
      const confirmMsg = `¿Seguro que deseas REVOCAR el acceso a ${targets.length} equipo(s)? Esta acción exigirá una nueva vinculación física.`;
      if (!window.confirm(confirmMsg)) return;
    }

    setBulkBusy(true);
    setError('');
    setMessage('');
    setBulkProgress({ current: 0, total: targets.length });

    let successes = 0;
    let errors = 0;

    for (let i = 0; i < targets.length; i++) {
      const device = targets[i];
      try {
        await api<{ device: Device }>({
          action: 'authorize',
          deviceId: device.id,
          version: device.version,
          operationId: crypto.randomUUID(),
          state,
          reason: `Acción masiva: ${state}`,
          expiresAt: null,
        });
        successes++;
      } catch {
        errors++;
      }
      setBulkProgress({ current: i + 1, total: targets.length });
    }

    const stateLabel = state === 'enabled' ? 'habilitado(s)' : state === 'suspended' ? 'suspendido(s)' : 'revocado(s)';
    if (errors === 0) {
      setMessage(`✓ ${successes} equipo(s) ${stateLabel} correctamente.`);
    } else {
      setMessage(`Proceso terminado: ${successes} ${stateLabel}, ${errors} con error.`);
    }

    setSelectedIds(new Set());
    setBulkBusy(false);
    setBulkProgress(null);
    await load();
  }

  function openDevice(d: Device) {
    setSelected(d); setOwner(d.owner); setAlias(d.alias); setEvents([]); setAuditCursor(null); setError('');
  }

  async function audit(next: string | null = null) {
    if (!selected) return;
    const data = await api<{ events: DeviceAudit[]; nextCursor: string | null }>({ action: 'audit', deviceId: selected.id, cursor: next });
    setEvents(old => next ? [...old, ...data.events] : data.events); setAuditCursor(data.nextCursor);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8 pb-32">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-700">
            <ShieldCheck size={16} /> Control de Acceso Móvil
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl mt-0.5">
            Dispositivos Auto Clicker
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm mt-0.5">
            Autoriza, suspende o gestiona los teléfonos vinculados al equipo de campaña.
          </p>
        </div>

        {hasPermission('devices.manage') && (
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50"
            onClick={() => { setPairOpen(true); setSelected(null); setPreview(null); setCode(''); setOwner(''); setAlias(''); setError(''); }}
          >
            <Plus size={18} />
            <span>Vincular teléfono</span>
          </button>
        )}
      </header>

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {message && (
        <div role="status" className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-xs animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}
      {error && !pairOpen && !selected && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 shadow-xs animate-in fade-in">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Container ─────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Unified Toolbar (Clean, no weird checkboxes) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 p-3 sm:p-4 bg-slate-50/40">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              className={`${input} pl-9`}
              value={search}
              maxLength={40}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por propietario, alias o modelo…"
              aria-label="Buscar dispositivos"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filtrar por estado"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            {/* Mobile multi-select toggle */}
            {hasPermission('devices.authorize') && selectableDevices.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="lg:hidden flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {allSelected ? <CheckSquare size={16} className="text-blue-700" /> : <Square size={16} className="text-slate-400" />}
                <span>{allSelected ? 'Todos' : 'Marcar'}</span>
              </button>
            )}

            <button
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => void load()}
              aria-label="Actualizar"
              title="Actualizar lista"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── DESKTOP VIEW: Clean, Spacious, Well-aligned Table ──────── */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/70 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="w-12 px-4 py-3.5 text-center">
                  {hasPermission('devices.authorize') && selectableDevices.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos los activos'}
                      className="align-middle text-slate-400 hover:text-blue-700 transition"
                    >
                      {allSelected ? <CheckSquare size={18} className="text-blue-700" /> : <Square size={18} />}
                    </button>
                  )}
                </th>
                <th className="px-4 py-3.5">Propietario / Alias</th>
                <th className="px-4 py-3.5">Dispositivo</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Última sesión</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map(d => {
                const isSelected = selectedIds.has(d.id);
                const isOnline = d.lastSeenAt && now - d.lastSeenAt < 35000;
                return (
                  <tr
                    key={d.id}
                    className={`transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}
                  >
                    {/* Checkbox column */}
                    <td className="px-4 py-3.5 text-center">
                      {d.state !== 'revoked' && hasPermission('devices.authorize') ? (
                        <button
                          type="button"
                          onClick={() => toggleSelect(d.id)}
                          className="align-middle text-slate-300 hover:text-blue-700 transition"
                        >
                          {isSelected ? <CheckSquare size={18} className="text-blue-700" /> : <Square size={18} />}
                        </button>
                      ) : null}
                    </td>

                    {/* Owner column */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase shrink-0">
                          {d.owner.charAt(0) || 'D'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm leading-snug">{d.owner}</p>
                          <p className="text-xs text-slate-400">{d.alias || 'Sin alias registrado'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Device column */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800 text-sm">{d.metadata.manufacturer} {d.metadata.model}</p>
                      <p className="text-xs text-slate-400">Android {d.metadata.android} · {d.metadata.width}×{d.metadata.height}</p>
                    </td>

                    {/* State column */}
                    <td className="px-4 py-3.5">
                      <StateBadge device={d} now={now} />
                    </td>

                    {/* Last session column */}
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {isOnline ? (
                        <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          En línea ahora
                        </span>
                      ) : (
                        <span>{date(d.lastSeenAt)}</span>
                      )}
                    </td>

                    {/* Action column (Right-aligned, single clean button group) */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {hasPermission('devices.authorize') && d.state !== 'revoked' && (
                          <>
                            {d.state !== 'enabled' ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 transition shadow-2xs"
                                disabled={!!quickBusy || bulkBusy}
                                onClick={() => quickChange(d.id, 'enabled')}
                                title="Habilitar equipo"
                              >
                                <CheckCircle2 size={14} />
                                <span>{quickBusy === d.id ? '…' : 'Habilitar'}</span>
                              </button>
                            ) : (
                              <button
                                className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 active:scale-95 transition shadow-2xs"
                                disabled={!!quickBusy || bulkBusy}
                                onClick={() => quickChange(d.id, 'suspended')}
                                title="Suspender equipo"
                              >
                                <PauseCircle size={14} />
                                <span>{quickBusy === d.id ? '…' : 'Suspender'}</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                          onClick={() => openDevice(d)}
                        >
                          Detalles
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── MOBILE & TABLET VIEW: Minimalist, Uncluttered Cards ───── */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {devices.map(d => {
            const isSelected = selectedIds.has(d.id);
            const isOnline = d.lastSeenAt && now - d.lastSeenAt < 35000;
            return (
              <div
                key={d.id}
                className={`p-4 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/40'}`}
              >
                {/* Top Row: Checkbox + Owner + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {d.state !== 'revoked' && hasPermission('devices.authorize') && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(d.id)}
                        className="mt-0.5 text-slate-300 hover:text-blue-700 transition"
                        aria-label={`Seleccionar ${d.owner}`}
                      >
                        {isSelected ? <CheckSquare size={20} className="text-blue-700" /> : <Square size={20} />}
                      </button>
                    )}

                    <div className="min-w-0 cursor-pointer" onClick={() => openDevice(d)}>
                      <p className="font-bold text-slate-900 text-sm truncate">{d.owner}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{d.alias || 'Sin alias'}</p>
                    </div>
                  </div>

                  <StateBadge device={d} now={now} />
                </div>

                {/* Subtitle Info: Device model and status */}
                <div
                  className="mt-2 flex items-center justify-between text-xs text-slate-500 cursor-pointer pl-8"
                  onClick={() => openDevice(d)}
                >
                  <span className="truncate">{d.metadata.manufacturer} {d.metadata.model}</span>
                  {isOnline ? (
                    <span className="font-bold text-emerald-600 shrink-0 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> En línea
                    </span>
                  ) : (
                    <span className="text-slate-400 shrink-0 text-[11px]">
                      {d.lastSeenAt ? date(d.lastSeenAt).split(',')[1] || date(d.lastSeenAt) : 'Sin sesión'}
                    </span>
                  )}
                </div>

                {/* Bottom Row: ONE primary action button + tap to view details */}
                <div className="mt-3.5 flex items-center gap-2 pl-8">
                  {hasPermission('devices.authorize') && d.state !== 'revoked' ? (
                    d.state !== 'enabled' ? (
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-98 transition"
                        disabled={!!quickBusy || bulkBusy}
                        onClick={() => quickChange(d.id, 'enabled')}
                      >
                        <CheckCircle2 size={14} />
                        <span>{quickBusy === d.id ? 'Habilitando…' : 'Habilitar equipo'}</span>
                      </button>
                    ) : (
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-800 shadow-2xs hover:bg-amber-100 active:scale-98 transition"
                        disabled={!!quickBusy || bulkBusy}
                        onClick={() => quickChange(d.id, 'suspended')}
                      >
                        <PauseCircle size={14} />
                        <span>{quickBusy === d.id ? 'Suspendiendo…' : 'Suspender equipo'}</span>
                      </button>
                    )
                  ) : null}

                  <button
                    className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    onClick={() => openDevice(d)}
                  >
                    <span>Ver</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {!devices.length && (
          <div className="p-8 text-center text-slate-500 sm:p-12">
            <Smartphone className="mx-auto mb-2 text-slate-300" size={36} />
            <p className="font-medium text-sm text-slate-600">{loading ? 'Consultando dispositivos…' : 'No hay dispositivos registrados con este filtro.'}</p>
          </div>
        )}

        {/* Pagination cursor */}
        {cursor && (
          <div className="p-4 text-center border-t border-slate-100 bg-slate-50/50">
            <button
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Cargar más dispositivos
            </button>
          </div>
        )}
      </section>

      {/* ── Sleek Floating Bulk Action Bar ─────────────────────────── */}
      {selectedIds.size > 0 && hasPermission('devices.authorize') && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-8 z-40 max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/95 text-white px-4 py-3 shadow-2xl backdrop-blur-md border border-white/10">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black">
                {selectedIds.size}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Limpiar
              </button>
            </div>

            {bulkProgress ? (
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <RefreshCw size={13} className="animate-spin" />
                <span>{bulkProgress.current} de {bulkProgress.total}…</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBulkAction('enabled')}
                  disabled={bulkBusy}
                  className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition"
                >
                  <CheckCircle2 size={13} />
                  <span>Habilitar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('suspended')}
                  disabled={bulkBusy}
                  className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 active:scale-95 transition"
                >
                  <PauseCircle size={13} />
                  <span>Suspender</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('revoked')}
                  disabled={bulkBusy}
                  className="flex items-center gap-1 rounded-xl bg-red-600/90 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-500 active:scale-95 transition"
                >
                  <XCircle size={13} />
                  <span>Revocar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals: Responsive Bottom Sheet / Centered Modal ─────────── */}
      {(pairOpen || selected) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-dialog-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 id="device-dialog-title" className="text-lg sm:text-xl font-black text-slate-900">
                  {pairOpen ? 'Vincular teléfono' : selected?.owner}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pairOpen ? 'Introduce el código que muestra la app en el celular.' : `${selected?.metadata.manufacturer} ${selected?.metadata.model}`}
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition"
                disabled={busy}
                aria-label="Cerrar"
                onClick={() => { setPairOpen(false); setSelected(null); setError(''); }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Pair Modal Form */}
            {pairOpen && (
              <form
                className="space-y-4"
                onSubmit={e => {
                  e.preventDefault();
                  void perform(async () => {
                    if (!preview) {
                      setPreview(await api({ action: 'preview', code }));
                      return;
                    }
                    await api({ action: 'claim', code, owner, alias });
                    setPairOpen(false);
                    setMessage('✓ Teléfono vinculado correctamente.');
                    await load();
                  });
                }}
              >
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700">
                    Código del teléfono
                    <input
                      autoFocus
                      className={`${input} mt-1.5 font-mono text-center text-2xl uppercase tracking-[.3em] font-black text-blue-700`}
                      required
                      minLength={6}
                      maxLength={6}
                      value={code}
                      onChange={e => {
                        setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        setPreview(null);
                      }}
                      placeholder="ABC234"
                    />
                  </label>
                  <p className="mt-1.5 text-center text-xs text-slate-400">Introduce el código de 6 caracteres que muestra la app en el teléfono.</p>
                </div>

                {preview && (
                  <div className="space-y-3 rounded-2xl bg-blue-50/70 border border-blue-100 p-3.5 text-xs text-blue-900 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Link2 size={16} className="text-blue-700" />
                      <span>{preview.metadata.manufacturer} {preview.metadata.model}</span>
                    </div>
                    <p className="text-slate-600">Android {preview.metadata.android} · Pantalla: {preview.metadata.width}×{preview.metadata.height}</p>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mt-2">
                        Nombre del propietario
                        <input
                          className={`${input} mt-1`}
                          required
                          maxLength={120}
                          value={owner}
                          onChange={e => setOwner(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Alias del teléfono (opcional)
                        <input
                          className={`${input} mt-1`}
                          maxLength={80}
                          value={alias}
                          onChange={e => setAlias(e.target.value)}
                          placeholder="Ej. Teléfono 01"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <button
                  className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 transition"
                  disabled={busy}
                >
                  {busy ? 'Procesando…' : preview ? 'Confirmar vinculación' : 'Comprobar código'}
                </button>
              </form>
            )}

            {/* Device Detail Modal */}
            {selected && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <StateBadge device={selected} now={now} />
                    {selected.lastSeenAt && now - selected.lastSeenAt < 35000 && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> En línea ahora
                      </span>
                    )}
                  </div>

                  <dl className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Última sesión:</span>
                      <span className="font-medium text-slate-800">{date(selected.lastSeenAt)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Modelo:</span>
                      <span className="font-medium text-slate-800">{selected.metadata.manufacturer} {selected.metadata.model}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Sistema:</span>
                      <span className="font-medium text-slate-800">Android {selected.metadata.android}</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">ID:</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]">{selected.id}</span>
                    </div>
                  </dl>
                </div>

                {/* Direct Action inside modal */}
                {hasPermission('devices.authorize') && selected.state !== 'revoked' && (
                  <div className="rounded-2xl border border-slate-100 p-3.5 bg-white space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Control de acceso</p>
                    <div className="flex items-center gap-2">
                      {selected.state !== 'enabled' ? (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                          disabled={busy}
                          onClick={async () => {
                            await quickChange(selected.id, 'enabled');
                            const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id });
                            openDevice(r.device);
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Habilitar equipo</span>
                        </button>
                      ) : (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                          disabled={busy}
                          onClick={async () => {
                            await quickChange(selected.id, 'suspended');
                            const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id });
                            openDevice(r.device);
                          }}
                        >
                          <PauseCircle size={15} />
                          <span>Suspender equipo</span>
                        </button>
                      )}

                      <button
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition flex items-center gap-1"
                        disabled={busy}
                        onClick={async () => {
                          if (window.confirm(`¿Revocar acceso permanentemente a ${selected.alias || selected.owner}? Exigirá vincularlo nuevamente.`)) {
                            await quickChange(selected.id, 'revoked');
                            setSelected(null);
                          }
                        }}
                      >
                        <XCircle size={15} />
                        <span>Revocar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit owner/alias */}
                {hasPermission('devices.manage') && selected.state !== 'revoked' && (
                  <form
                    className="space-y-2.5 rounded-2xl border border-slate-100 p-3.5 bg-white"
                    onSubmit={e => {
                      e.preventDefault();
                      void perform(async () => {
                        const result = await api<{ device: Device }>({
                          action: 'edit',
                          deviceId: selected.id,
                          version: selected.version,
                          operationId: crypto.randomUUID(),
                          owner,
                          alias
                        });
                        setSelected(result.device);
                        setMessage('✓ Datos actualizados.');
                        await load();
                      });
                    }}
                  >
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Editar datos</p>
                    <input
                      className={input}
                      aria-label="Nombre del propietario"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      required
                      maxLength={120}
                      placeholder="Nombre del propietario"
                    />
                    <input
                      className={input}
                      aria-label="Alias"
                      value={alias}
                      onChange={e => setAlias(e.target.value)}
                      maxLength={80}
                      placeholder="Alias (opcional)"
                    />
                    <button
                      disabled={busy}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Guardar cambios
                    </button>
                  </form>
                )}

                {/* Audit history */}
                {hasPermission('devices.audit') && (
                  <div className="rounded-2xl border border-slate-100 p-3.5 bg-white">
                    <button
                      className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      disabled={busy}
                      onClick={() => void perform(() => audit())}
                    >
                      Ver historial de auditoría
                    </button>
                    {events.length > 0 && (
                      <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {events.map(event => (
                          <li key={event.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                            <p className="font-bold text-slate-800">
                              {event.action === 'claim' ? 'Vinculación' : event.action === 'edit' ? 'Edición' : 'Autorización'} · {date(event.createdAt)}
                            </p>
                            <p className="text-slate-500 text-[11px]">{event.actor}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {auditCursor && (
                      <button
                        className="mt-2 text-xs text-blue-600 underline font-semibold"
                        disabled={busy}
                        onClick={() => void perform(() => audit(auditCursor))}
                      >
                        Ver más eventos
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
