'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, Plus, RefreshCw, Search, X, ShieldCheck, Link2 } from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { STATE_LABELS, type Device, type DeviceAudit } from '@/lib/autoclicker/types';

const api = <T,>(body: Record<string, unknown>) => authenticatedPost<T>('/api/autoclicker/admin', body);
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const button = 'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50';
const primary = `${button} !border-blue-700 !bg-blue-700 text-white hover:!bg-blue-800`;
const date = (n: number | null) => n ? new Date(n).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación.';
function Badge({ device, now }: { device: Device; now: number }) {
  const expired = device.state === 'enabled' && device.expiresAt !== null && device.expiresAt <= now;
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${device.state === 'enabled' && !expired ? 'bg-emerald-100 text-emerald-800' : device.state === 'revoked' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{expired ? 'Expirado' : STATE_LABELS[device.state]}</span>;
}

export default function DevicesPage() {
  const { hasPermission } = useAccess();
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [pairOpen, setPairOpen] = useState(false); const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ metadata: Device['metadata']; expiresAt: number } | null>(null);
  const [owner, setOwner] = useState(''); const [alias, setAlias] = useState('');
  const [selected, setSelected] = useState<Device | null>(null);
  const [reason, setReason] = useState(''); const [expiry, setExpiry] = useState('');
  const [events, setEvents] = useState<DeviceAudit[]>([]); const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const generation = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const cancelLoad = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    if (!pairOpen && !selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[aria-labelledby="device-dialog-title"]');
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary';
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
      setDevices(previous => next ? [...previous, ...result.devices] : result.devices); setCursor(result.nextCursor); setError('');
    } catch (e) { if (request === generation.current) setError(errorText(e)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [search, filter]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 300); return () => { clearTimeout(timer); cancelLoad(); }; }, [load, cancelLoad]);
  async function perform(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  function openDevice(d: Device) {
    setSelected(d); setOwner(d.owner); setAlias(d.alias); setReason(''); setExpiry(''); setEvents([]); setAuditCursor(null); setError('');
  }
  async function audit(next: string | null = null) {
    if (!selected) return;
    const data = await api<{ events: DeviceAudit[]; nextCursor: string | null }>({ action: 'audit', deviceId: selected.id, cursor: next });
    setEvents(old => next ? [...old, ...data.events] : data.events); setAuditCursor(data.nextCursor);
  }
  async function change(state: 'enabled' | 'suspended' | 'revoked') {
    if (!selected) return;
    if (!reason.trim()) throw new Error('Escribe el motivo del cambio.');
    if (state === 'revoked' && !window.confirm(`Revocar ${selected.alias || selected.owner} exige una nueva vinculación. ¿Continuar?`)) return;
    const result = await api<{ device: Device }>({ action: 'authorize', deviceId: selected.id, version: selected.version,
      operationId: crypto.randomUUID(), state, reason, expiresAt: state === 'enabled' && expiry ? new Date(expiry).getTime() : null });
    setSelected(result.device); setMessage(state === 'enabled' ? 'Equipo habilitado. El usuario debe pulsar Play en el teléfono.' : 'Cambio registrado. La app dejará de enviar toques como máximo al vencer su permiso vigente (hasta 30 s).');
    await load();
  }
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700"><ShieldCheck size={18} /> CONTROL DE ACCESO MÓVIL</div><h1 className="text-3xl font-black text-slate-900">Dispositivos Auto Clicker</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Vincula cada teléfono con su propietario y decide cuándo puede ejecutar secuencias.</p></div>
      {hasPermission('devices.manage') && <button className={primary} onClick={() => { setPairOpen(true); setSelected(null); setPreview(null); setCode(''); setOwner(''); setAlias(''); setError(''); }}><Plus className="mr-2 inline" size={17} />Vincular teléfono</button>}
    </header>
    <div className="grid gap-3 sm:grid-cols-3">{[['01', 'Vincula', 'Introduce el código de seis caracteres que muestra el teléfono.'], ['02', 'Autoriza', 'Habilita el equipo después de comprobar a quién pertenece.'], ['03', 'Controla', 'El usuario inicia en su teléfono. Puedes retirar el acceso.']].map(([n, title, detail]) => <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-xs font-black text-blue-600">{n}</span><h2 className="mt-1 font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p></div>)}</div>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {error && !pairOpen && !selected && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4"><label className="relative min-w-60 flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className={`${input} pl-10`} value={search} maxLength={40} onChange={e => setSearch(e.target.value)} placeholder="Buscar por inicio de nombre, alias o modelo" aria-label="Buscar dispositivos" /></label><select aria-label="Filtrar estado" className={`${input} !w-auto`} value={filter} onChange={e => setFilter(e.target.value)}><option value="">Todos los estados</option>{Object.entries(STATE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button className={button} disabled={loading} onClick={() => void load()} aria-label="Actualizar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Propietario / alias', 'Teléfono', 'Autorización', 'Última sesión reportada', ''].map((v, i) => <th key={i} className="px-5 py-4">{v}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{devices.map(d => <tr key={d.id}><td className="px-5 py-4"><p className="font-bold text-slate-900">{d.owner}</p><p className="text-slate-500">{d.alias || 'Sin alias'}</p></td><td className="px-5 py-4"><p>{d.metadata.manufacturer} {d.metadata.model}</p><p className="text-xs text-slate-500">Android {d.metadata.android}</p></td><td className="px-5 py-4"><Badge device={d} now={now} /><p className="mt-1 text-xs text-slate-500">{d.expiresAt ? `Hasta ${date(d.expiresAt)}` : 'Sin vencimiento configurado'}</p></td><td className="px-5 py-4 text-slate-600">{date(d.lastSeenAt)}<p className="text-xs">{d.lastSeenAt && now - d.lastSeenAt < 35000 ? 'Comunicación reciente' : 'Sin confirmación reciente'}</p></td><td className="px-5 py-4"><button className={button} onClick={() => openDevice(d)}>Ver equipo</button></td></tr>)}</tbody></table></div>
      {!devices.length && <div className="p-12 text-center text-slate-500"><Smartphone className="mx-auto mb-3" size={32} /><p>{loading ? 'Consultando dispositivos…' : 'No hay dispositivos para esta búsqueda.'}</p></div>}
      {cursor && <div className="p-4 text-center"><button className={button} disabled={loading} onClick={() => void load(cursor)}>Cargar más</button></div>}
    </section>
    {(pairOpen || selected) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="device-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="device-dialog-title" className="text-xl font-black">{pairOpen ? 'Vincular teléfono' : selected?.owner}</h2><p className="text-sm text-slate-500">{pairOpen ? 'El registro inicial conserva la ejecución deshabilitada.' : `${selected?.metadata.manufacturer} ${selected?.metadata.model}`}</p></div><button className={button} disabled={busy} aria-label="Cerrar" onClick={() => { setPairOpen(false); setSelected(null); setError(''); }}><X size={18} /></button></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {pairOpen ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void perform(async () => { if (!preview) { setPreview(await api({ action: 'preview', code })); return; } await api({ action: 'claim', code, owner, alias }); setPairOpen(false); setMessage('Teléfono vinculado. Todavía está deshabilitado; un operador con permiso debe autorizarlo.'); await load(); }); }}>
        <label className="block text-sm font-bold">Código del teléfono<input autoFocus className={`${input} mt-1 font-mono text-xl uppercase tracking-[.3em]`} required minLength={6} maxLength={6} value={code} onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPreview(null); }} placeholder="ABC234" /></label>
        {preview && <><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><Link2 size={18} className="mb-2" />{preview.metadata.manufacturer} {preview.metadata.model} · Android {preview.metadata.android}<p>El código vence: {date(preview.expiresAt)}</p></div><label className="block text-sm font-bold">Nombre del propietario<input className={`${input} mt-1`} required maxLength={120} value={owner} onChange={e => setOwner(e.target.value)} /></label><label className="block text-sm font-bold">Alias (opcional)<input className={`${input} mt-1`} maxLength={80} value={alias} onChange={e => setAlias(e.target.value)} /></label></>}
        <button className={primary} disabled={busy}>{busy ? 'Procesando…' : preview ? 'Confirmar vinculación' : 'Comprobar código'}</button>
      </form> : selected && <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4"><Badge device={selected} now={now} /><dl className="mt-3 space-y-1 text-sm text-slate-600"><div>Vencimiento: {date(selected.expiresAt)}</div><div>Última comunicación: {date(selected.lastSeenAt)}</div><div>Último permiso emitido hasta: {date(selected.leaseExpiresAt)}</div><div>Estado reportado: {selected.reportedState === 'stopped' ? 'Detenido' : selected.reportedState === 'running' ? 'Ejecución reportada; no implica presencia actual' : 'Sin reporte'}</div><div className="break-all font-mono text-xs">ID: {selected.id}</div></dl><button className={`${button} mt-3`} disabled={busy} onClick={() => void perform(async () => { const r = await api<{ device: Device }>({ action: 'detail', deviceId: selected.id }); openDevice(r.device); })}>Actualizar estado</button></div>
        {hasPermission('devices.manage') && selected.state !== 'revoked' && <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={e => { e.preventDefault(); void perform(async () => { const result = await api<{ device: Device }>({ action: 'edit', deviceId: selected.id, version: selected.version, operationId: crypto.randomUUID(), owner, alias }); setSelected(result.device); setMessage('Datos del equipo actualizados.'); await load(); }); }}><h3 className="font-bold">Propietario</h3><input className={input} aria-label="Nombre del propietario" value={owner} onChange={e => setOwner(e.target.value)} required maxLength={120} /><input className={input} aria-label="Alias" value={alias} onChange={e => setAlias(e.target.value)} maxLength={80} placeholder="Alias opcional" /><button disabled={busy} className={button}>Guardar datos</button></form>}
        {hasPermission('devices.authorize') && selected.state !== 'revoked' && <div className="space-y-3 border-t border-slate-200 pt-4"><h3 className="font-bold">Autorización de ejecución</h3><label className="block text-sm">Vencimiento opcional (hora de este navegador)<input type="datetime-local" className={`${input} mt-1`} value={expiry} onChange={e => setExpiry(e.target.value)} /></label><textarea className={input} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Motivo obligatorio del cambio" aria-label="Motivo del cambio" /><div className="flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={() => void perform(() => change('enabled'))}>Habilitar</button><button className={button} disabled={busy} onClick={() => void perform(() => change('suspended'))}>Suspender</button><button className={`${button} text-red-700`} disabled={busy} onClick={() => void perform(() => change('revoked'))}>Revocar</button></div><p className="text-xs text-slate-500">Habilitar no inicia toques. Suspender conserva el registro; revocar exige una nueva vinculación.</p></div>}
        {hasPermission('devices.audit') && <div className="border-t border-slate-200 pt-4"><button className={button} disabled={busy} onClick={() => void perform(() => audit())}>Consultar historial</button><ul className="mt-3 space-y-3">{events.map(event => <li key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{event.action === 'claim' ? 'Vinculación' : event.action === 'edit' ? 'Edición de datos' : 'Cambio de autorización'} · {date(event.createdAt)}</p><p>{event.reason}</p><p className="text-xs text-slate-500">{event.actor}</p><details className="mt-2 text-xs"><summary>Cambio registrado</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify({ antes: event.before, después: event.after }, null, 2)}</pre></details></li>)}</ul>{auditCursor && <button className={`${button} mt-3`} disabled={busy} onClick={() => void perform(() => audit(auditCursor))}>Más historial</button>}</div>}
      </div>}
    </section></div>}
  </div>;
}
