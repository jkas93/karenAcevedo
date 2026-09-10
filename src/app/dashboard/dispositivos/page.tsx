'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone, Plus, RefreshCw, Search, X, ShieldCheck, Link2,
  CheckCircle2, PauseCircle, XCircle, CheckSquare, Square, Info,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Layers
} from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { STATE_LABELS, type Device, type DeviceAudit } from '@/lib/autoclicker/types';

const api = <T,>(body: Record<string, unknown>) => authenticatedPost<T>('/api/autoclicker/admin', body);
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const btnBase = 'rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
const date = (n: number | null) => n ? new Date(n).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación.';

function StateBadge({ device, now }: { device: Device; now: number }) {
  const expired = device.state === 'enabled' && device.expiresAt !== null && device.expiresAt <= now;
  const label = expired ? 'Expirado' : STATE_LABELS[device.state];
  const cls = device.state === 'enabled' && !expired
    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    : device.state === 'revoked'
    ? 'bg-red-100 text-red-800 border border-red-200'
    : 'bg-slate-100 text-slate-700 border border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {device.state === 'enabled' && !expired && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {label}
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
  const [showGuide, setShowGuide] = useState(false);
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

  // ── Keyboard trap for dialogs ──────────────────────────────────────────
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

  // ── Quick action for a single device ───────────────────────────────────
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

  // ── Bulk selection helpers ─────────────────────────────────────────────
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
    <div className="mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6 lg:p-8 pb-28">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-700 sm:text-sm">
            <ShieldCheck size={18} /> CONTROL DE ACCESO MÓVIL
          </div>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Dispositivos Auto Clicker</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Gestiona autorizaciones, habilita o suspende equipos en lote o de forma individual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(prev => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Info size={15} />
            <span className="hidden sm:inline">Guía de uso</span>
            {showGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {hasPermission('devices.manage') && (
            <button
              className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50"
              onClick={() => { setPairOpen(true); setSelected(null); setPreview(null); setCode(''); setOwner(''); setAlias(''); setError(''); }}
            >
              <Plus size={18} /> Vincular teléfono
            </button>
          )}
        </div>
      </header>

      {/* ── Collapsible usage guide ────────────────────────────────── */}
      {showGuide && (
        <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 transition-all">
          <div className="rounded-xl bg-white p-3.5 shadow-xs border border-blue-100">
            <span className="text-xs font-black text-blue-700">01 · VINCULACIÓN</span>
            <p className="mt-1 font-bold text-slate-800 text-sm">Código de 6 dígitos</p>
            <p className="mt-0.5 text-xs text-slate-500">Ingresa el código que muestra la app en el teléfono para vincularlo.</p>
          </div>
          <div className="rounded-xl bg-white p-3.5 shadow-xs border border-blue-100">
            <span className="text-xs font-black text-emerald-700">02 · AUTORIZACIÓN</span>
            <p className="mt-1 font-bold text-slate-800 text-sm">Habilitación instantánea</p>
            <p className="mt-0.5 text-xs text-slate-500">Usa los botones individuales o selecciona varios para habilitar en masa.</p>
          </div>
          <div className="rounded-xl bg-white p-3.5 shadow-xs border border-blue-100">
            <span className="text-xs font-black text-amber-700">03 · CONTROL TOTAL</span>
            <p className="mt-1 font-bold text-slate-800 text-sm">Suspensión remota</p>
            <p className="mt-0.5 text-xs text-slate-500">Suspende el acceso en cualquier momento. La barra flotante se cerrará sola.</p>
          </div>
        </div>
      )}

      {/* ── Status alerts ──────────────────────────────────────────── */}
      {message && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900 shadow-xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}
      {error && !pairOpen && !selected && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-900 shadow-xs">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main content card ──────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* Search, Filter and Selection bar */}
        <div className="flex flex-col gap-2.5 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Master Checkbox */}
            {hasPermission('devices.authorize') && selectableDevices.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos los activos'}
                className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                {allSelected ? <CheckSquare size={20} className="text-blue-700" /> : <Square size={20} className="text-slate-400" />}
              </button>
            )}

            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                className={`${input} pl-9`}
                value={search}
                maxLength={40}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por propietario, alias o modelo..."
                aria-label="Buscar dispositivos"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filtrar estado"
              className={`${input} !w-auto text-xs sm:text-sm`}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <button
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => void load()}
              aria-label="Actualizar"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Desktop & Tablet Large Table view (hidden on small screens) ── */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  {hasPermission('devices.authorize') && selectableDevices.length > 0 && (
                    <button type="button" onClick={toggleSelectAll} className="align-middle">
                      {allSelected ? <CheckSquare size={17} className="text-blue-700" /> : <Square size={17} className="text-slate-400" />}
                    </button>
                  )}
                </th>
                <th className="px-4 py-3.5">Propietario / Alias</th>
                <th className="px-4 py-3.5">Teléfono</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Última sesión</th>
                <th className="px-4 py-3.5 text-center">Acciones rápidas</th>
                <th className="px-4 py-3.5 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map(d => {
                const isSelected = selectedIds.has(d.id);
                const isOnline = d.lastSeenAt && now - d.lastSeenAt < 35000;
                return (
                  <tr key={d.id} className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3.5 text-center">
                      {d.state !== 'revoked' && hasPermission('devices.authorize') ? (
                        <button type="button" onClick={() => toggleSelect(d.id)} className="align-middle text-slate-500 hover:text-slate-900">
                          {isSelected ? <CheckSquare size={18} className="text-blue-700" /> : <Square size={18} className="text-slate-300" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{d.owner}</p>
                      <p className="text-xs text-slate-400">{d.alias || 'Sin alias'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-700">{d.metadata.manufacturer} {d.metadata.model}</p>
                      <p className="text-xs text-slate-400">Android {d.metadata.android} · {d.metadata.width}x{d.metadata.height}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <StateBadge device={d} now={now} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {isOnline ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Activo
                          </span>
                        ) : (
                          <span>{date(d.lastSeenAt)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {hasPermission('devices.authorize') && (
                        <div className="inline-flex justify-center gap-1.5">
                          {d.state !== 'revoked' && d.state !== 'enabled' && (
                            <button
                              className={`${btnBase} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                              disabled={!!quickBusy || bulkBusy}
                              onClick={() => quickChange(d.id, 'enabled')}
                              title="Habilitar"
                            >
                              {quickBusy === d.id ? '…' : <span className="flex items-center gap-1"><CheckCircle2 size={13} />Habilitar</span>}
                            </button>
                          )}
                          {d.state === 'enabled' && (
                            <button
                              className={`${btnBase} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                              disabled={!!quickBusy || bulkBusy}
                              onClick={() => quickChange(d.id, 'suspended')}
                              title="Suspender"
                            >
                              {quickBusy === d.id ? '…' : <span className="flex items-center gap-1"><PauseCircle size={13} />Suspender</span>}
                            </button>
                          )}
                          {d.state !== 'revoked' && (
                            <button
                              className={`${btnBase} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                              disabled={!!quickBusy || bulkBusy}
                              onClick={() => {
                                if (window.confirm(`Revocar ${d.alias || d.owner} exigirá una nueva vinculación. ¿Continuar?`)) {
                                  quickChange(d.id, 'revoked');
                                }
                              }}
                              title="Revocar"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                        onClick={() => openDevice(d)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile & Tablet Responsive Cards (visible below lg breakpoint) ── */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {devices.map(d => {
            const isSelected = selectedIds.has(d.id);
            const isOnline = d.lastSeenAt && now - d.lastSeenAt < 35000;
            return (
              <div
                key={d.id}
                className={`p-3.5 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}
              >
                {/* Header row: Checkbox, Owner, StateBadge */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {d.state !== 'revoked' && hasPermission('devices.authorize') && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(d.id)}
                        className="mt-0.5 text-slate-400 hover:text-slate-800"
                        aria-label={`Seleccionar ${d.owner}`}
                      >
                        {isSelected ? <CheckSquare size={19} className="text-blue-700" /> : <Square size={19} />}
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">{d.owner}</p>
                      <p className="text-xs text-slate-400 truncate">{d.alias || 'Sin alias'}</p>
                    </div>
                  </div>
                  <StateBadge device={d} now={now} />
                </div>

                {/* Device Info & Online Status */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-1 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Smartphone size={14} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{d.metadata.manufacturer} {d.metadata.model}</span>
                    <span className="text-slate-300">·</span>
                    <span>Android {d.metadata.android}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isOnline ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={12} /> {d.lastSeenAt ? date(d.lastSeenAt).split(',')[1] || date(d.lastSeenAt) : 'Sin sesión'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Full touch targets */}
                <div className="mt-3 flex items-center gap-2">
                  {hasPermission('devices.authorize') && d.state !== 'revoked' && (
                    <>
                      {d.state !== 'enabled' ? (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 py-2 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-[0.98] transition disabled:opacity-50"
                          disabled={!!quickBusy || bulkBusy}
                          onClick={() => quickChange(d.id, 'enabled')}
                        >
                          <CheckCircle2 size={15} />
                          {quickBusy === d.id ? 'Habilitando…' : 'Habilitar'}
                        </button>
                      ) : (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 active:scale-[0.98] transition disabled:opacity-50"
                          disabled={!!quickBusy || bulkBusy}
                          onClick={() => quickChange(d.id, 'suspended')}
                        >
                          <PauseCircle size={15} />
                          {quickBusy === d.id ? 'Suspendiendo…' : 'Suspender'}
                        </button>
                      )}

                      <button
                        className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 active:scale-[0.98] transition disabled:opacity-50"
                        disabled={!!quickBusy || bulkBusy}
                        onClick={() => {
                          if (window.confirm(`¿Revocar acceso a ${d.alias || d.owner}?`)) {
                            quickChange(d.id, 'revoked');
                          }
                        }}
                        title="Revocar acceso"
                        aria-label="Revocar acceso"
                      >
                        <XCircle size={17} />
                      </button>
                    </>
                  )}

                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition"
                    onClick={() => openDevice(d)}
                  >
                    Detalles
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
            <p className="font-medium">{loading ? 'Consultando dispositivos…' : 'No hay dispositivos registrados con este filtro.'}</p>
          </div>
        )}

        {/* Pagination cursor */}
        {cursor && (
          <div className="p-4 text-center border-t border-slate-100">
            <button
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition"
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Cargar más dispositivos
            </button>
          </div>
        )}
      </section>

      {/* ── Floating / Sticky Mass Actions Bar ──────────────────────── */}
      {selectedIds.size > 0 && hasPermission('devices.authorize') && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 z-40 max-w-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-slate-900/95 text-white p-3.5 shadow-2xl backdrop-blur-md border border-white/10">
            <div className="flex items-center justify-between sm:justify-start gap-2.5">
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-blue-400" />
                <span className="text-xs font-black tracking-wide sm:text-sm">
                  {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-400 hover:text-white underline sm:ml-2"
              >
                Limpiar
              </button>
            </div>

            {bulkProgress ? (
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <RefreshCw size={14} className="animate-spin" />
                <span>Procesando {bulkProgress.current} de {bulkProgress.total}…</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBulkAction('enabled')}
                  disabled={bulkBusy}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition shadow-xs"
                >
                  <CheckCircle2 size={14} /> Habilitar
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('suspended')}
                  disabled={bulkBusy}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 active:scale-95 transition shadow-xs"
                >
                  <PauseCircle size={14} /> Suspender
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('revoked')}
                  disabled={bulkBusy}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-xl bg-red-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 active:scale-95 transition shadow-xs"
                >
                  <XCircle size={14} /> Revocar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals: Responsive Bottom Sheet on Mobile / Centered Modal on Desktop ── */}
      {(pairOpen || selected) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-dialog-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 id="device-dialog-title" className="text-lg sm:text-xl font-black text-slate-900">
                  {pairOpen ? 'Vincular teléfono' : selected?.owner}
                </h2>
                <p className="text-xs text-slate-500">
                  {pairOpen ? 'Introduce el código que muestra la app en el celular.' : `${selected?.metadata.manufacturer} ${selected?.metadata.model}`}
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
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

            {/* Pair Form */}
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
                    setMessage('✓ Teléfono vinculado. Ahora puedes habilitarlo con el botón verde.');
                    await load();
                  });
                }}
              >
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700">
                    Código de 6 caracteres del teléfono
                    <input
                      autoFocus
                      className={`${input} mt-1.5 font-mono text-center text-2xl uppercase tracking-[.3em] font-bold text-blue-700`}
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
                  <p className="mt-1 text-[11px] text-slate-400">Abre la app en el teléfono y acepta los permisos para ver el código.</p>
                </div>

                {preview && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-3.5 text-xs text-blue-900">
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <Link2 size={16} /> Dispositivo detectado
                      </div>
                      <p>{preview.metadata.manufacturer} {preview.metadata.model} · Android {preview.metadata.android}</p>
                      <p className="text-[11px] text-blue-600 mt-1">Vence en: {date(preview.expiresAt)}</p>
                    </div>

                    <label className="block text-xs sm:text-sm font-bold text-slate-700">
                      Nombre del propietario
                      <input
                        className={`${input} mt-1`}
                        required
                        maxLength={120}
                        value={owner}
                        onChange={e => setOwner(e.target.value)}
                        placeholder="Ej. Juan Pérez (Coordinador)"
                      />
                    </label>

                    <label className="block text-xs sm:text-sm font-bold text-slate-700">
                      Alias o identificación del teléfono (opcional)
                      <input
                        className={`${input} mt-1`}
                        maxLength={80}
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                        placeholder="Ej. Teléfono 01 - Zona Sur"
                      />
                    </label>
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

            {/* Device Detail */}
            {selected && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <StateBadge device={selected} now={now} />
                    {selected.lastSeenAt && now - selected.lastSeenAt < 35000 && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> En línea
                      </span>
                    )}
                  </div>

                  <dl className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Última comunicación:</span>
                      <span className="font-medium text-slate-800">{date(selected.lastSeenAt)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Modelo:</span>
                      <span className="font-medium text-slate-800">{selected.metadata.manufacturer} {selected.metadata.model}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-400">Sistema operativo:</span>
                      <span className="font-medium text-slate-800">Android {selected.metadata.android}</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">ID criptográfico:</span>
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]">{selected.id}</span>
                    </div>
                  </dl>

                  <button
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                    disabled={busy}
                    onClick={() => void perform(async () => {
                      const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id });
                      openDevice(r.device);
                    })}
                  >
                    Actualizar estado
                  </button>
                </div>

                {/* Direct quick action inside modal */}
                {hasPermission('devices.authorize') && selected.state !== 'revoked' && (
                  <div className="rounded-2xl border border-slate-100 p-3.5 bg-white">
                    <p className="mb-2 text-xs font-black uppercase text-slate-400 tracking-wider">Acción directa</p>
                    <div className="flex items-center gap-2">
                      {selected.state !== 'enabled' ? (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                          disabled={busy}
                          onClick={async () => {
                            await quickChange(selected.id, 'enabled');
                            const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id });
                            openDevice(r.device);
                          }}
                        >
                          <CheckCircle2 size={15} /> Habilitar equipo
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
                          <PauseCircle size={15} /> Suspender equipo
                        </button>
                      )}

                      <button
                        className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-600 hover:bg-red-100 transition"
                        disabled={busy}
                        onClick={async () => {
                          if (window.confirm(`Revocar ${selected.alias || selected.owner} exigirá una nueva vinculación. ¿Continuar?`)) {
                            await quickChange(selected.id, 'revoked');
                            setSelected(null);
                          }
                        }}
                        title="Revocar permanentemente"
                      >
                        <XCircle size={17} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit owner/alias */}
                {hasPermission('devices.manage') && selected.state !== 'revoked' && (
                  <form
                    className="space-y-3 rounded-2xl border border-slate-100 p-3.5 bg-white"
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
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Modificar datos</p>
                    <input
                      className={input}
                      aria-label="Nombre del propietario"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      required
                      maxLength={120}
                      placeholder="Propietario"
                    />
                    <input
                      className={input}
                      aria-label="Alias"
                      value={alias}
                      onChange={e => setAlias(e.target.value)}
                      maxLength={80}
                      placeholder="Alias opcional"
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
