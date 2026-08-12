'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import {
  DAY_SHIFTS,
  EDUCATION_LEVELS,
  EMPTY_AVAILABILITY,
  SUPPORT_AREAS,
  TEAM_SKILLS,
  TRAVEL_OPTIONS,
  WEEK_DAYS,
  type DayShift,
  type TeamIntakePayload,
  type WeekDay,
} from '@/lib/team-intake-types';

const educationLabels = {
  secundaria: 'Secundaria completa',
  tecnico: 'Técnico (en curso o egresado)',
  universitario: 'Universitario (estudiante, bachiller o titulado)',
  posgrado: 'Posgrado o maestría',
};

const skillLabels = {
  redaccion: 'Redacción y comunicación',
  redes_sociales: 'Redes sociales y edición',
  diseno: 'Diseño',
  analisis_datos: 'Análisis de datos / Excel',
  oratoria: 'Oratoria y manejo de grupos',
  conduccion: 'Conducción (licencia vigente)',
  logistica: 'Logística y protocolo',
  primeros_auxilios: 'Primeros auxilios',
};

const areaLabels = {
  territorial: 'Territorial / Campo',
  tecnico: 'Técnico y propuestas',
  comunicaciones: 'Comunicaciones y prensa',
  logistica: 'Logística y operación',
  electoral: 'Electoral y legal',
  otra: 'Otra área',
};

const dayLabels = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

const shiftLabels = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
const travelLabels = { si: 'Sí', no: 'No', aviso_previo: 'Con aviso previo' };

const initialData: TeamIntakePayload = {
  nombre: '', dni: '', telefono: '', fechaNacimiento: '', direccionZona: '',
  transportePropio: false, correo: '', gradoInstruccion: 'secundaria',
  carreraOficio: '', institucion: '', habilidades: [], otraHabilidad: '', idiomas: '',
  experienciaPrevia: false, experienciaDetalle: '', areaApoyo: 'territorial', areaOtra: '',
  disponibilidad: EMPTY_AVAILABILITY, horasSemanales: 1, desplazamiento: 'aviso_previo',
  expectativas: '',
};

const steps = ['Datos personales', 'Perfil', 'Experiencia', 'Disponibilidad', 'Expectativas'];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className='block'>
      <span className='mb-1.5 block text-sm font-extrabold text-slate-700'>
        {label}{required && <span className='ml-1 text-red-500'>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass = 'min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-50';

export function TeamIntakeForm({ token }: { token: string }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<TeamIntakePayload>(initialData);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `team-intake-draft:${token}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(draftKey);
        if (stored) setData({ ...initialData, ...JSON.parse(stored) as TeamIntakePayload });
      } catch {
        window.sessionStorage.removeItem(draftKey);
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || submitted) return;
    window.sessionStorage.setItem(draftKey, JSON.stringify(data));
  }, [data, draftKey, draftReady, submitted]);

  const selectedShifts = useMemo(
    () => Object.values(data.disponibilidad).reduce((total, shifts) => total + shifts.length, 0),
    [data.disponibilidad],
  );

  const update = <K extends keyof TeamIntakePayload>(key: K, value: TeamIntakePayload[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const toggleSkill = (skill: TeamIntakePayload['habilidades'][number]) => {
    update('habilidades', data.habilidades.includes(skill)
      ? data.habilidades.filter((item) => item !== skill)
      : [...data.habilidades, skill]);
  };

  const toggleShift = (day: WeekDay, shift: DayShift) => {
    const current = data.disponibilidad[day];
    update('disponibilidad', {
      ...data.disponibilidad,
      [day]: current.includes(shift) ? current.filter((item) => item !== shift) : [...current, shift],
    });
  };

  const validateStep = () => {
    if (step === 0 && (!data.nombre.trim() || !/^\d{8}$/.test(data.dni) || !/^\+?\d{9,15}$/.test(data.telefono.replace(/\s/g, '')) || !data.fechaNacimiento || !data.direccionZona.trim())) {
      return 'Completa los datos personales obligatorios con formatos válidos.';
    }
    if (step === 0 && data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
      return 'Ingresa un correo válido o deja el campo vacío.';
    }
    if (step === 2 && data.areaApoyo === 'otra' && !data.areaOtra.trim()) return 'Especifica el área donde puedes apoyar.';
    if (step === 3 && selectedShifts === 0) return 'Selecciona al menos un turno disponible.';
    if (step === 4 && data.expectativas.trim().length < 10) return 'Escribe al menos 10 caracteres sobre tus expectativas.';
    return '';
  };

  const next = () => {
    const nextError = validateStep();
    if (nextError) return setError(nextError);
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    const nextError = validateStep();
    if (nextError) return setError(nextError);
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/team-intake/submit/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, website }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo enviar la ficha.');
      window.sessionStorage.removeItem(draftKey);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la ficha.');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className='rounded-[2rem] bg-white p-7 text-center shadow-xl ring-1 ring-slate-100 sm:p-10'>
        <div className='mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60'>
          <CheckCircle2 size={42} />
        </div>
        <h2 className='mt-6 text-2xl font-black text-slate-900 sm:text-3xl'>Ficha enviada correctamente</h2>
        <p className='mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base'>
          Gracias por completar tu información. El equipo administrativo podrá revisarla para organizar mejor las actividades de la campaña.
        </p>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-100'>
      <div className='border-b border-slate-100 px-5 py-5 sm:px-8'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-xs font-extrabold uppercase tracking-[0.15em] text-primary'>Paso {step + 1} de {steps.length}</p>
            <h2 className='mt-1 text-xl font-black text-slate-900 sm:text-2xl'>{steps[step]}</h2>
          </div>
          <span className='rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-primary'>{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div className='mt-4 h-2 overflow-hidden rounded-full bg-slate-100' role='progressbar' aria-label='Progreso del formulario' aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          <div className='h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all' style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className='p-5 sm:p-8'>
        {step === 0 && (
          <div className='grid gap-5 md:grid-cols-2'>
            <Field label='Nombres y apellidos' required><input className={inputClass} value={data.nombre} onChange={(e) => update('nombre', e.target.value)} autoComplete='name' /></Field>
            <Field label='DNI' required><input className={inputClass} value={data.dni} onChange={(e) => update('dni', e.target.value.replace(/\D/g, '').slice(0, 8))} inputMode='numeric' maxLength={8} /></Field>
            <Field label='Celular / WhatsApp' required><input className={inputClass} value={data.telefono} onChange={(e) => update('telefono', e.target.value.replace(/[^\d+\s]/g, '').slice(0, 16))} inputMode='tel' autoComplete='tel' /></Field>
            <Field label='Fecha de nacimiento' required><input type='date' className={inputClass} value={data.fechaNacimiento} onChange={(e) => update('fechaNacimiento', e.target.value)} /></Field>
            <div className='md:col-span-2'><Field label='Dirección / Zona' required><input className={inputClass} value={data.direccionZona} onChange={(e) => update('direccionZona', e.target.value)} autoComplete='street-address' /></Field></div>
            <Field label='Correo electrónico (opcional)'><input type='email' className={inputClass} value={data.correo} onChange={(e) => update('correo', e.target.value)} autoComplete='email' /></Field>
            <label className='flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700'>
              <input type='checkbox' checked={data.transportePropio} onChange={(e) => update('transportePropio', e.target.checked)} className='h-5 w-5 accent-primary' /> Cuento con transporte propio
            </label>
          </div>
        )}

        {step === 1 && (
          <div className='space-y-6'>
            <Field label='Máximo grado de instrucción' required>
              <select className={inputClass} value={data.gradoInstruccion} onChange={(e) => update('gradoInstruccion', e.target.value as TeamIntakePayload['gradoInstruccion'])}>
                {EDUCATION_LEVELS.map((item) => <option key={item} value={item}>{educationLabels[item]}</option>)}
              </select>
            </Field>
            <div className='grid gap-5 md:grid-cols-2'>
              <Field label='Carrera, profesión u oficio'><input className={inputClass} value={data.carreraOficio} onChange={(e) => update('carreraOficio', e.target.value)} /></Field>
              <Field label='Institución educativa / Universidad'><input className={inputClass} value={data.institucion} onChange={(e) => update('institucion', e.target.value)} /></Field>
            </div>
            <fieldset><legend className='mb-3 text-sm font-extrabold text-slate-700'>Habilidades y herramientas</legend><div className='grid gap-2 sm:grid-cols-2'>
              {TEAM_SKILLS.map((skill) => <button key={skill} type='button' aria-pressed={data.habilidades.includes(skill)} onClick={() => toggleSkill(skill)} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${data.habilidades.includes(skill) ? 'border-primary bg-blue-50 text-primary-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${data.habilidades.includes(skill) ? 'border-primary bg-primary text-white' : 'border-slate-300'}`}>{data.habilidades.includes(skill) && <Check size={14} />}</span>{skillLabels[skill]}</button>)}
            </div></fieldset>
            <div className='grid gap-5 md:grid-cols-2'><Field label='Otra habilidad'><input className={inputClass} value={data.otraHabilidad} onChange={(e) => update('otraHabilidad', e.target.value)} /></Field><Field label='Idiomas / Lenguas adicionales'><input className={inputClass} value={data.idiomas} onChange={(e) => update('idiomas', e.target.value)} /></Field></div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-6'>
            <fieldset><legend className='mb-3 text-sm font-extrabold text-slate-700'>¿Has participado en campañas políticas, voluntariados o trabajo comunitario?</legend><div className='grid grid-cols-2 gap-3'>
              {[true, false].map((value) => <button key={String(value)} type='button' aria-pressed={data.experienciaPrevia === value} onClick={() => update('experienciaPrevia', value)} className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-bold ${data.experienciaPrevia === value ? 'border-primary bg-blue-50 text-primary-dark' : 'border-slate-200 text-slate-600'}`}>{value ? 'Sí' : 'No'}</button>)}
            </div></fieldset>
            {data.experienciaPrevia && <Field label='Detalla brevemente tu rol o proyecto'><textarea className={`${inputClass} min-h-28 resize-y`} value={data.experienciaDetalle} onChange={(e) => update('experienciaDetalle', e.target.value)} /></Field>}
            <Field label='Área donde puedes apoyar con mayor impacto' required><select className={inputClass} value={data.areaApoyo} onChange={(e) => update('areaApoyo', e.target.value as TeamIntakePayload['areaApoyo'])}>{SUPPORT_AREAS.map((area) => <option key={area} value={area}>{areaLabels[area]}</option>)}</select></Field>
            {data.areaApoyo === 'otra' && <Field label='Especifica el área' required><input className={inputClass} value={data.areaOtra} onChange={(e) => update('areaOtra', e.target.value)} /></Field>}
          </div>
        )}

        {step === 3 && (
          <div className='space-y-6'>
            <div><p className='mb-3 text-sm font-extrabold text-slate-700'>Selecciona tus turnos disponibles</p><div className='space-y-3'>
              {WEEK_DAYS.map((day) => <div key={day} className='rounded-2xl border border-slate-200 p-3 sm:grid sm:grid-cols-[110px_1fr] sm:items-center sm:gap-3'><p className='mb-2 text-sm font-black text-slate-800 sm:mb-0'>{dayLabels[day]}</p><div className='grid grid-cols-3 gap-2'>{DAY_SHIFTS.map((shift) => { const selected = data.disponibilidad[day].includes(shift); return <button key={shift} type='button' aria-pressed={selected} onClick={() => toggleShift(day, shift)} className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition ${selected ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{shiftLabels[shift]}</button>; })}</div></div>)}
            </div></div>
            <div className='grid gap-5 md:grid-cols-2'><Field label='Horas estimadas por semana' required><input type='number' min={1} max={80} className={inputClass} value={data.horasSemanales} onChange={(e) => update('horasSemanales', Number(e.target.value))} /></Field><Field label='Disponibilidad para viajes / desplazamientos' required><select className={inputClass} value={data.desplazamiento} onChange={(e) => update('desplazamiento', e.target.value as TeamIntakePayload['desplazamiento'])}>{TRAVEL_OPTIONS.map((option) => <option key={option} value={option}>{travelLabels[option]}</option>)}</select></Field></div>
          </div>
        )}

        {step === 4 && (
          <div className='space-y-5'>
            <div className='rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-primary-dark'>Cuéntanos qué esperas aportar, aprender o desarrollar como parte del equipo de campaña.</div>
            <Field label='Expectativas' required><textarea className={`${inputClass} min-h-44 resize-y`} value={data.expectativas} onChange={(e) => update('expectativas', e.target.value)} maxLength={1200} placeholder='Escribe aquí tus expectativas...' /></Field>
            <p className='text-right text-xs text-slate-400'>{data.expectativas.length}/1200</p>
            <input tabIndex={-1} autoComplete='off' className='absolute -left-[9999px]' aria-hidden='true' value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        )}

        {error && <div role='alert' className='mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700'>{error}</div>}

        <div className='mt-8 flex gap-3'>
          {step > 0 && <button type='button' onClick={() => setStep((current) => current - 1)} disabled={busy} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50'><ArrowLeft size={17} /> Atrás</button>}
          {step < steps.length - 1 ? <button type='button' onClick={next} className='flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-100 hover:bg-primary-dark'>Continuar <ArrowRight size={17} /></button> : <button type='button' onClick={() => void submit()} disabled={busy || !draftReady} className='flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-100 hover:bg-primary-dark disabled:opacity-60'>{busy ? <Loader2 size={18} className='animate-spin' /> : <Send size={18} />} Enviar ficha</button>}
        </div>
      </div>
    </div>
  );
}
