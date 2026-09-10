'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, Plus, RefreshCw, Search, X, ShieldCheck, Link2, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { STATE_LABELS, type Device, type DeviceAudit } from '@/lib/autoclicker/types';

const api = <T,>(body: Record<string, unknown>) => authenticatedPost<T>('/api/autoclicker/admin', body);
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const btnBase = 'rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50';
const date = (n: number | null) => n ? new Date(n).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación.';

function StateBadge({ device, now }: { device: Device; now: number }) {
  const expired = device.state === 'enabled' && device.expiresAt !== null && device.expiresAt <= now;
  const label = expired ? 'Expirado' : STATE_LABELS[device.state];
  const cls = device.state === 'enabled' && !expired
    ? 'bg-emerald-100 text-emerald-800'
    : device.state === 'revoked'
    ? 'bg-red-100 text-red-800'
    : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

/** Quick-action buttons shown inline in the device row */
function QuickActions({
  device, busy, now, onAction,
}: {
  device: Device; busy: string | null; now: number; onAction: (id: string, state: 'enabled' | 'suspended' | 'revoked') => void;
}) {
  const expired = device.state === 'enabled' && device.expiresAt !== null && device.expiresAt <= now;
  const isEnabled = device.state === 'enabled' && !expired;
  const isBusy = busy === device.id;

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Habilitar — shown when not enabled */}
      {device.state !== 'revoked' && !isEnabled && (
        <button
          className={`${btnBase} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          disabled={!!busy}
          onClick={() => onAction(device.id, 'enabled')}
          title="Habilitar ejecución"
        >
          {isBusy ? '…' : <span className="flex items-center gap-1"><CheckCircle2 size={13} />Habilitar</span>}
        </button>
      )}

      {/* Deshabilitar — shown when enabled */}
      {isEnabled && (
        <button
          className={`${btnBase} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100`}
          disabled={!!busy}
          onClick={() => onAction(device.id, 'suspended')}
          title="Suspender acceso"
        >
          {isBusy ? '…' : <span className="flex items-center gap-1"><PauseCircle size={13} />Suspender</span>}
        </button>
      )}

      {/* Revocar — not shown if already revoked */}
      {device.state !== 'revoked' && (
        <button
          className={`${btnBase} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
          disabled={!!busy}
          onClick={() => {
            if (window.confirm(`Revocar ${device.alias || device.owner} exige una nueva vinculación. ¿Continuar?`))
              onAction(device.id, 'revoked');
          }}
          title="Revocar acceso permanentemente"
        >
          {isBusy ? '…' : <span className="flex items-center gap-1"><XCircle size={13} />Revocar</span>}
        </button>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const { hasPermission } = useAccess();
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);  // device id being actioned
  const [busy, setBusy] = useState(false);
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

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cancelLoad = useCallback(() => { generation.current++; }, []);

  // ── Focus trap for dialogs ───────────────────────────────────────────
  useEffect(() => {
    if (!pairOpen && !selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[aria-labelledby="device-dialog-title"]');
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';
    dialog?.querySelector<HTMLElement>(selector)?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { setPairOpen(false); setSelected(null); setError(''); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [pairOpen, selected, busy]);

  const load = useCallback(async (next: string | null = null) => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await api<{ devices: Device[]; nextCursor: string | null }>({ action: 'list', search: search.trim(), state: filter, cursor: next });
      if (request !== generation.current) return;
      setDevices(prev => next ? [...prev, ...result.devices] : result.devices);
      setCursor(result.nextCursor); setError('');
    } catch (e) { if (request === generation.current) setError(errorText(e)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 300);
    return () => { clearTimeout(timer); cancelLoad(); };
  }, [load, cancelLoad]);

  async function perform(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  // ── Quick inline state change (no reason required) ───────────────────
  async function quickChange(deviceId: string, state: 'enabled' | 'suspended' | 'revoked') {
    setQuickBusy(deviceId); setError(''); setMessage('');
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return;
      await api<{ device: Device }>({
        action: 'authorize', deviceId, version: device.version,
        operationId: crypto.randomUUID(), state, reason: 'Cambio rápido desde panel',
        expiresAt: null,
      });
      setMessage(
        state === 'enabled' ? '✓ Equipo habilitado. El usuario debe pulsar Play en el teléfono.' :
        state === 'suspended' ? 'Equipo suspendido.' : 'Acceso revocado.'
      );
      await load();
    } catch (e) { setError(errorText(e)); } finally { setQuickBusy(null); }
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700">
            <ShieldCheck size={18} /> CONTROL DE ACCESO MÓVIL
          </div>
          <h1 className="text-3xl font-black text-slate-900">Dispositivos Auto Clicker</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">Vincula teléfonos y habilítalos con un clic. Sin trámites.</p>
        </div>
        {hasPermission('devices.manage') && (
          <button
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            onClick={() => { setPairOpen(true); setSelected(null); setPreview(null); setCode(''); setOwner(''); setAlias(''); setError(''); }}
          >
            <Plus size={17} /> Vincular teléfono
          </button>
        )}
      </header>

      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</p>}
      {error && !pairOpen && !selected && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {/* Device table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <label className="relative min-w-60 flex-1">
            <Search size={17} className="absolute left-3 top-3 text-slate-400" />
            <input
              className={`${input} pl-10`} value={search} maxLength={40}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, alias o modelo" aria-label="Buscar dispositivos"
            />
          </label>
          <select aria-label="Filtrar estado" className={`${input} !w-auto`} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(STATE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="rounded-xl border border-slate-200 bg-white p-2.5 transition hover:bg-slate-50 disabled:opacity-50" disabled={loading} onClick={() => void load()} aria-label="Actualizar">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {['Propietario', 'Teléfono', 'Estado', 'Última sesión', 'Acciones rápidas', ''].map((v, i) => (
                  <th key={i} className="px-5 py-4">{v}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900">{d.owner}</p>
                    <p className="text-xs text-slate-400">{d.alias || 'Sin alias'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p>{d.metadata.manufacturer} {d.metadata.model}</p>
                    <p className="text-xs text-slate-400">Android {d.metadata.android}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StateBadge device={d} now={now} />
                    {d.lastSeenAt && now - d.lastSeenAt < 35000 && (
                      <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-400" title="Activo ahora" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{date(d.lastSeenAt)}</td>
                  <td className="px-5 py-4">
                    {hasPermission('devices.authorize') && (
                      <QuickActions device={d} busy={quickBusy} now={now} onAction={quickChange} />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                      onClick={() => openDevice(d)}
                    >
                      Detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!devices.length && (
          <div className="p-12 text-center text-slate-500">
            <Smartphone className="mx-auto mb-3" size={32} />
            <p>{loading ? 'Consultando dispositivos…' : 'No hay dispositivos para esta búsqueda.'}</p>
          </div>
        )}
        {cursor && (
          <div className="p-4 text-center">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50" disabled={loading} onClick={() => void load(cursor)}>Cargar más</button>
          </div>
        )}
      </section>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      {(pairOpen || selected) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <section
            role="dialog" aria-modal="true" aria-labelledby="device-dialog-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="device-dialog-title" className="text-xl font-black">
                  {pairOpen ? 'Vincular teléfono' : selected?.owner}
                </h2>
                <p className="text-sm text-slate-500">
                  {pairOpen ? 'Introduce el código que muestra el teléfono.' : `${selected?.metadata.manufacturer} ${selected?.metadata.model}`}
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"
                disabled={busy} aria-label="Cerrar"
                onClick={() => { setPairOpen(false); setSelected(null); setError(''); }}
              >
                <X size={18} />
              </button>
            </div>

            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            {/* Pair flow */}
            {pairOpen && (
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); void perform(async () => {
                if (!preview) { setPreview(await api({ action: 'preview', code })); return; }
                await api({ action: 'claim', code, owner, alias });
                setPairOpen(false);
                setMessage('Teléfono vinculado. Usa los botones de la tabla para habilitarlo.');
                await load();
              }); }}>
                <label className="block text-sm font-bold">
                  Código del teléfono
                  <input
                    autoFocus className={`${input} mt-1 font-mono text-xl uppercase tracking-[.3em]`}
                    required minLength={6} maxLength={6} value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPreview(null); }}
                    placeholder="ABC234"
                  />
                </label>
                {preview && <>
                  <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                    <Link2 size={18} className="mb-2" />
                    {preview.metadata.manufacturer} {preview.metadata.model} · Android {preview.metadata.android}
                    <p>El código vence: {date(preview.expiresAt)}</p>
                  </div>
                  <label className="block text-sm font-bold">
                    Nombre del propietario
                    <input className={`${input} mt-1`} required maxLength={120} value={owner} onChange={e => setOwner(e.target.value)} />
                  </label>
                  <label className="block text-sm font-bold">
                    Alias (opcional)
                    <input className={`${input} mt-1`} maxLength={80} value={alias} onChange={e => setAlias(e.target.value)} />
                  </label>
                </>}
                <button className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition" disabled={busy}>
                  {busy ? 'Procesando…' : preview ? 'Confirmar vinculación' : 'Comprobar código'}
                </button>
              </form>
            )}

            {/* Device detail */}
            {selected && (
              <div className="space-y-5">
                {/* Status summary */}
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <StateBadge device={selected} now={now} />
                    {selected.lastSeenAt && now - selected.lastSeenAt < 35000 && (
                      <span className="text-xs font-semibold text-emerald-600">● Activo ahora</span>
                    )}
                  </div>
                  <dl className="space-y-1 text-sm text-slate-600">
                    <div>Última comunicación: {date(selected.lastSeenAt)}</div>
                    <div>Vencimiento: {date(selected.expiresAt)}</div>
                    <div className="break-all font-mono text-xs text-slate-400">ID: {selected.id}</div>
                  </dl>
                  <button
                    className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-white transition"
                    disabled={busy}
                    onClick={() => void perform(async () => { const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id }); openDevice(r.device); })}
                  >
                    Actualizar estado
                  </button>
                </div>

                {/* Quick actions inside dialog too */}
                {hasPermission('devices.authorize') && selected.state !== 'revoked' && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-bold uppercase text-slate-400">Autorización</p>
                    <QuickActions device={selected} busy={quickBusy} now={now} onAction={async (id, state) => {
                      await quickChange(id, state);
                      // refresh selected
                      const r = await api<{ device: Device }>({ action: 'detail', deviceId: id });
                      openDevice(r.device);
                    }} />
                  </div>
                )}

                {/* Edit owner/alias */}
                {hasPermission('devices.manage') && selected.state !== 'revoked' && (
                  <form className="space-y-3 border-t border-slate-100 pt-4"
                    onSubmit={e => { e.preventDefault(); void perform(async () => {
                      const result = await api<{ device: Device }>({ action: 'edit', deviceId: selected.id, version: selected.version, operationId: crypto.randomUUID(), owner, alias });
                      setSelected(result.device); setMessage('Datos del equipo actualizados.'); await load();
                    }); }}>
                    <p className="text-xs font-bold uppercase text-slate-400">Datos del equipo</p>
                    <input className={input} aria-label="Nombre del propietario" value={owner} onChange={e => setOwner(e.target.value)} required maxLength={120} />
                    <input className={input} aria-label="Alias" value={alias} onChange={e => setAlias(e.target.value)} maxLength={80} placeholder="Alias opcional" />
                    <button disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Guardar datos</button>
                  </form>
                )}

                {/* Audit */}
                {hasPermission('devices.audit') && (
                  <div className="border-t border-slate-100 pt-4">
                    <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50" disabled={busy} onClick={() => void perform(() => audit())}>Ver historial</button>
                    <ul className="mt-3 space-y-3">
                      {events.map(event => (
                        <li key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                          <p className="font-bold">{event.action === 'claim' ? 'Vinculación' : event.action === 'edit' ? 'Edición' : 'Cambio de autorización'} · {date(event.createdAt)}</p>
                          <p className="text-slate-500 text-xs">{event.actor}</p>
                        </li>
                      ))}
                    </ul>
                    {auditCursor && <button className="mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50" disabled={busy} onClick={() => void perform(() => audit(auditCursor))}>Más historial</button>}
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
