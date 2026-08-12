'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import {
  SUPPORT_AREAS,
  TEAM_PROFILE_STATUSES,
  WEEK_DAYS,
  type TeamProfile,
  type TeamProfileStatus,
} from '@/lib/team-intake-types';

type Invitation = {
  token: string;
  active: boolean;
  version: number;
  submissions: number;
};

const statusLabels = {
  nuevo: 'Nuevo', revisado: 'Revisado', contactado: 'Contactado',
  incorporado: 'Incorporado', descartado: 'Descartado',
};
const statusStyles = {
  nuevo: 'bg-amber-50 text-amber-700 border-amber-200',
  revisado: 'bg-blue-50 text-blue-700 border-blue-200',
  contactado: 'bg-violet-50 text-violet-700 border-violet-200',
  incorporado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  descartado: 'bg-slate-100 text-slate-600 border-slate-200',
};
const areaLabels = {
  territorial: 'Territorial / Campo', tecnico: 'Técnico y propuestas',
  comunicaciones: 'Comunicaciones y prensa', logistica: 'Logística y operación',
  electoral: 'Electoral y legal', otra: 'Otra área',
};
const dayLabels = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const shiftLabels = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function TeamProfilesPage() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [selected, setSelected] = useState<TeamProfile | null>(null);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('todas');
  const [status, setStatus] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [invite, list] = await Promise.all([
        authenticatedPost<Invitation>('/api/team-intake/invitation', { action: 'get' }),
        authenticatedPost<{ profiles: TeamProfile[] }>('/api/team-intake/profiles', { action: 'list' }),
      ]);
      setInvitation(invite);
      setProfiles(list.profiles);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el módulo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const invitePath = invitation ? `/ficha-equipo/${invitation.token}` : '';
  const inviteDisplay = invitation
    ? `karenacevedo.com/ficha-equipo/${invitation.token}`
    : '';

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return profiles.filter((profile) => {
      if (area !== 'todas' && profile.areaApoyo !== area) return false;
      if (status !== 'todos' && profile.estado !== status) return false;
      if (!term) return true;
      return [profile.nombre, profile.dni, profile.telefono, profile.direccionZona, profile.carreraOficio, profile.otraHabilidad, profile.idiomas]
        .some((value) => String(value || '').toLocaleLowerCase('es').includes(term));
    });
  }, [area, profiles, search, status]);

  const copyLink = async () => {
    if (!invitePath) return;
    await navigator.clipboard.writeText(new URL(invitePath, window.location.origin).toString());
    setMessage('Enlace copiado. Ya puedes compartirlo en WhatsApp.');
  };

  const changeInvitation = async (action: 'regenerate' | 'set-active', active?: boolean) => {
    setBusy(action);
    setMessage('');
    try {
      const next = await authenticatedPost<Invitation>('/api/team-intake/invitation', { action, ...(typeof active === 'boolean' ? { active } : {}) });
      setInvitation(next);
      setMessage(action === 'regenerate' ? 'Se generó un enlace nuevo. El anterior dejó de funcionar.' : next.active ? 'El enlace está activo.' : 'El enlace fue cerrado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el enlace.');
    } finally { setBusy(''); }
  };

  const changeStatus = async (profile: TeamProfile, nextStatus: TeamProfileStatus) => {
    setBusy(profile.id);
    try {
      await authenticatedPost('/api/team-intake/profiles', { action: 'status', id: profile.id, status: nextStatus });
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, estado: nextStatus } : item));
      setSelected((current) => current?.id === profile.id ? { ...current, estado: nextStatus } : current);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el estado.'); }
    finally { setBusy(''); }
  };

  const exportCsv = () => {
    const headers = ['Nombre', 'DNI', 'WhatsApp', 'Correo', 'Nacimiento', 'Zona', 'Transporte', 'Grado', 'Profesión u oficio', 'Institución', 'Habilidades', 'Idiomas', 'Experiencia', 'Área principal', 'Horas semanales', 'Desplazamiento', 'Expectativas', 'Estado', 'Fecha de registro'];
    const rows = filtered.map((p) => [p.nombre, p.dni, p.telefono, p.correo, p.fechaNacimiento, p.direccionZona, p.transportePropio ? 'Sí' : 'No', p.gradoInstruccion, p.carreraOficio, p.institucion, [...p.habilidades, p.otraHabilidad].filter(Boolean).join('; '), p.idiomas, p.experienciaDetalle, areaLabels[p.areaApoyo] || p.areaOtra, p.horasSemanales, p.desplazamiento, p.expectativas, statusLabels[p.estado], new Date(p.fechaRegistro).toLocaleDateString('es-PE')]);
    const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
    link.download = `fichas-equipo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className='mx-auto max-w-[1500px] pb-20'>
      <header className='mb-6 rounded-3xl bg-gradient-to-br from-[#003d72] via-primary to-[#0798cf] p-6 text-white shadow-xl sm:p-8'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div><div className='mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20'><ShieldCheck size={15} className='text-yellow-300' /> Acceso exclusivo para administradores</div><h1 className='text-3xl font-black sm:text-4xl'>Fichas del equipo</h1><p className='mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base'>Recopila capacidades, experiencia y disponibilidad del equipo operativo sin crearles acceso al ERP.</p></div>
          <div className='grid grid-cols-2 gap-3'><div className='rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20'><p className='text-xs text-blue-100'>Fichas recibidas</p><p className='text-2xl font-black'>{profiles.length}</p></div><div className='rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20'><p className='text-xs text-blue-100'>Nuevas</p><p className='text-2xl font-black'>{profiles.filter((item) => item.estado === 'nuevo').length}</p></div></div>
        </div>
      </header>

      <section className='mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'><div><h2 className='flex items-center gap-2 text-lg font-black text-slate-900'><Link2 size={20} className='text-primary' /> Enlace para WhatsApp</h2><p className='mt-1 text-sm text-slate-500'>No requiere inicio de sesión y solo permite enviar una ficha.</p></div>{invitation && <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${invitation.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{invitation.active ? 'Enlace activo' : 'Enlace cerrado'}</span>}</div>
        <div className='mt-4 flex flex-col gap-2 lg:flex-row'><div className='min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'>{loading ? 'Preparando enlace...' : inviteDisplay}</div><button onClick={() => void copyLink()} disabled={!invitePath || !invitation?.active} className='flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50'><Copy size={17} /> Copiar</button>{invitePath && <a href={invitePath} target='_blank' rel='noreferrer' className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600'><ExternalLink size={17} /> Abrir</a>}<button onClick={() => void changeInvitation('set-active', !invitation?.active)} disabled={!invitation || Boolean(busy)} className='min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600'>{invitation?.active ? 'Cerrar enlace' : 'Activar enlace'}</button><button onClick={() => { if (window.confirm('El enlace anterior dejará de funcionar. ¿Deseas generar uno nuevo?')) void changeInvitation('regenerate'); }} disabled={Boolean(busy)} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800'><RefreshCw size={17} className={busy === 'regenerate' ? 'animate-spin' : ''} /> Renovar</button></div>
        {message && <p className='mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-primary-dark'>{message}</p>}
      </section>

      <section className='rounded-3xl border border-slate-200 bg-white shadow-sm'>
        <div className='border-b border-slate-100 p-4 sm:p-5'><div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px_auto]'><label className='relative'><Search size={17} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400' /><input value={search} onChange={(e) => setSearch(e.target.value)} className='min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none focus:border-primary' placeholder='Buscar nombre, DNI, zona, profesión...' /></label><select value={area} onChange={(e) => setArea(e.target.value)} className='min-h-11 rounded-xl border border-slate-200 px-3 text-sm'><option value='todas'>Todas las áreas</option>{SUPPORT_AREAS.map((item) => <option key={item} value={item}>{areaLabels[item]}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className='min-h-11 rounded-xl border border-slate-200 px-3 text-sm'><option value='todos'>Todos los estados</option>{TEAM_PROFILE_STATUSES.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select><button onClick={exportCsv} disabled={!filtered.length} className='flex min-h-11 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-black text-primary-dark disabled:opacity-50'><Download size={17} /> Exportar</button></div></div>
        {loading ? <div className='flex min-h-72 items-center justify-center'><Loader2 size={30} className='animate-spin text-primary' /></div> : filtered.length === 0 ? <div className='flex min-h-72 flex-col items-center justify-center px-5 text-center text-slate-400'><Users size={34} /><p className='mt-3 font-bold'>No hay fichas que coincidan con los filtros.</p></div> : <div className='grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3'>{filtered.map((profile) => <article key={profile.id} className='rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-md'><div className='flex items-start justify-between gap-3'><div className='min-w-0'><h3 className='truncate font-black text-slate-900'>{profile.nombre}</h3><p className='mt-1 text-xs text-slate-500'>DNI {profile.dni} · {profile.direccionZona}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles[profile.estado]}`}>{statusLabels[profile.estado]}</span></div><div className='mt-4 grid grid-cols-2 gap-2 text-xs'><div className='rounded-xl bg-slate-50 p-3'><p className='text-slate-400'>Área</p><p className='mt-1 font-bold text-slate-700'>{profile.areaApoyo === 'otra' ? profile.areaOtra : areaLabels[profile.areaApoyo]}</p></div><div className='rounded-xl bg-slate-50 p-3'><p className='text-slate-400'>Disponibilidad</p><p className='mt-1 font-bold text-slate-700'>{profile.horasSemanales} h/semana</p></div></div><div className='mt-4 flex gap-2'><button onClick={() => setSelected(profile)} className='min-h-10 flex-1 rounded-xl bg-primary px-3 text-xs font-bold text-white'>Ver ficha</button><a href={`https://wa.me/51${profile.telefono.replace(/\D/g, '').replace(/^51/, '')}`} target='_blank' rel='noreferrer' className='flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600'>WhatsApp</a></div></article>)}</div>}
      </section>

      {selected && <ProfileDetail profile={selected} busy={busy === selected.id} onClose={() => setSelected(null)} onStatus={(next) => void changeStatus(selected, next)} />}
    </div>
  );
}

function ProfileDetail({ profile, busy, onClose, onStatus }: { profile: TeamProfile; busy: boolean; onClose: () => void; onStatus: (status: TeamProfileStatus) => void }) {
  return <div className='fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-6' role='dialog' aria-modal='true'><button className='absolute inset-0' onClick={onClose} aria-label='Cerrar' /><section className='relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-7'><button onClick={onClose} className='absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100'><X size={20} /></button><div className='pr-10'><p className='text-xs font-extrabold uppercase tracking-wider text-primary'>Ficha del equipo</p><h2 className='mt-1 text-2xl font-black text-slate-900'>{profile.nombre}</h2><p className='mt-1 text-sm text-slate-500'>DNI {profile.dni} · {profile.telefono}</p></div><div className='mt-6 grid gap-4 sm:grid-cols-2'><Detail title='Datos personales'><p>Nacimiento: {profile.fechaNacimiento}</p><p>Zona: {profile.direccionZona}</p><p>Correo: {profile.correo || 'No indicado'}</p><p>Transporte: {profile.transportePropio ? 'Sí' : 'No'}</p></Detail><Detail title='Perfil profesional'><p>{profile.carreraOficio || 'Profesión no indicada'}</p><p>{profile.institucion || 'Institución no indicada'}</p><p>Idiomas: {profile.idiomas || 'No indicados'}</p></Detail><Detail title='Habilidades'><p>{[...profile.habilidades, profile.otraHabilidad].filter(Boolean).join(', ') || 'No indicadas'}</p></Detail><Detail title='Área de apoyo'><p>{profile.areaApoyo === 'otra' ? profile.areaOtra : areaLabels[profile.areaApoyo]}</p><p className='mt-2'>Experiencia: {profile.experienciaPrevia ? profile.experienciaDetalle || 'Sí' : 'No'}</p></Detail></div><Detail title='Disponibilidad semanal' className='mt-4'><div className='grid gap-2 sm:grid-cols-2'>{WEEK_DAYS.filter((day) => profile.disponibilidad[day].length).map((day) => <p key={day}><strong>{dayLabels[day]}:</strong> {profile.disponibilidad[day].map((shift) => shiftLabels[shift]).join(', ')}</p>)}</div><p className='mt-2 font-bold'>{profile.horasSemanales} horas por semana · Desplazamiento: {profile.desplazamiento}</p></Detail><Detail title='Expectativas' className='mt-4'><p className='whitespace-pre-wrap'>{profile.expectativas}</p></Detail><div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center'><select value={profile.estado} onChange={(e) => onStatus(e.target.value as TeamProfileStatus)} disabled={busy} className={`min-h-12 flex-1 rounded-xl border px-4 text-sm font-bold ${statusStyles[profile.estado]}`}>{TEAM_PROFILE_STATUSES.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select><button onClick={onClose} className='min-h-12 rounded-xl bg-primary px-6 text-sm font-bold text-white'>Cerrar</button></div></section></div>;
}

function Detail({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ${className}`}><h3 className='mb-2 font-black text-slate-900'>{title}</h3>{children}</div>;
}
