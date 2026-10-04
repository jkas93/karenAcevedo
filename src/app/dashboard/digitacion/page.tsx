'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileCheck2,
  ImageUp,
  Loader2,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  Trash2,
} from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ACTAS_ESPERADAS,
  normalizeActaExtraction,
  validateFinalActa,
  type ConteoDoble,
  type ExtraccionActa,
} from '@/lib/electoral/acta-schema';
import { authenticatedFormPost, authenticatedPost } from '@/lib/firebase/authenticated-request';
import { useElectoral } from '@/lib/firebase/ElectoralContext';

type AnalyzeResponse = {
  success: true;
  draftId: string;
  extraction: ExtraccionActa;
  imageUrl: string;
  reused?: boolean;
};

type Stage = 'capture' | 'analyzing' | 'review' | 'saving' | 'success';

const SPECIAL_LABELS = {
  blancos: 'Votos en blanco',
  nulos: 'Votos nulos',
  impugnados: 'Votos impugnados',
} as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

function numberValue(value: number | null) {
  return value === null ? '' : String(value);
}

function parsedCount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default function DigitacionCentralPage() {
  const { hasPermission } = useAccess();
  const canManage = hasPermission('actas.manage');
  const { locales, actas, loading } = useElectoral();
  const [localId, setLocalId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [stage, setStage] = useState<Stage>('capture');
  const [draftId, setDraftId] = useState('');
  const [extraction, setExtraction] = useState<ExtraccionActa | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedLocal = locales.find((local) => local.id === localId);
  const confirmedHere = actas.filter((acta) => acta.local_id === localId).length;
  const validation = useMemo(
    () => extraction ? validateFinalActa(extraction) : null,
    [extraction],
  );

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl('');
    setStage('capture');
    setDraftId('');
    setExtraction(null);
    setError('');
  };

  const chooseImage = (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Usa una fotografía JPG, PNG o WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La fotografía no debe superar los 10 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setExtraction(null);
    setDraftId('');
    setStage('capture');
  };

  const analyze = async (manual = false) => {
    if (!canManage || !localId || !imageFile) return;
    setStage('analyzing');
    setError('');
    try {
      const form = new FormData();
      form.set('localId', localId);
      form.set('image', imageFile);
      if (manual) form.set('manual', 'true');
      const response = await authenticatedFormPost<AnalyzeResponse>('/api/electoral/actas/analyze', form);
      setDraftId(response.draftId);
      setExtraction(normalizeActaExtraction(response.extraction));
      setStage('review');
    } catch (analyzeError) {
      setError(errorMessage(analyzeError));
      setStage('capture');
    }
  };

  const updatePair = (
    group: 'especiales' | 'totalesEmitidos',
    key: keyof ExtraccionActa['especiales'] | null,
    column: keyof ConteoDoble,
    value: string,
  ) => {
    setExtraction((current) => {
      if (!current) return current;
      if (group === 'totalesEmitidos') {
        return { ...current, totalesEmitidos: { ...current.totalesEmitidos, [column]: parsedCount(value) } };
      }
      const specialKey = key as keyof ExtraccionActa['especiales'];
      return {
        ...current,
        especiales: {
          ...current.especiales,
          [specialKey]: { ...current.especiales[specialKey], [column]: parsedCount(value) },
        },
      };
    });
  };

  const finalize = async () => {
    if (!extraction || !draftId || !localId || !validation || validation.errors.length > 0) return;
    setStage('saving');
    setError('');
    try {
      await authenticatedPost('/api/electoral/actas/finalize', { draftId, localId, extraction });
      setStage('success');
    } catch (saveError) {
      setError(errorMessage(saveError));
      setStage('review');
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Ingreso inteligente de actas</h1>
          <p className="mt-1 text-slate-500">Selecciona el colegio, fotografía el acta y verifica la lectura antes de confirmarla.</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-right">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Avance general</p>
          <p className="text-2xl font-black text-blue-900">{actas.length} / {ACTAS_ESPERADAS}</p>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Tu rol solo puede consultar actas. La captura y confirmación permanecen deshabilitadas.
        </div>
      )}

      {stage === 'success' ? (
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
          <CardContent className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-600" />
            <h2 className="text-2xl font-black text-emerald-950">Acta confirmada correctamente</h2>
            <p className="mt-2 max-w-lg text-emerald-800">La imagen quedó guardada como WebP y la mesa {extraction?.mesaNumero} fue creada a partir de esta acta.</p>
            <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
              <RotateCcw size={18} /> Cargar otra acta
            </button>
          </CardContent>
        </Card>
      ) : (
        <fieldset disabled={!canManage || stage === 'analyzing' || stage === 'saving'} className={!canManage ? 'opacity-60' : ''}>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-white">1</span> Colegio</CardTitle>
                  <CardDescription>La mesa será reconocida desde la fotografía; ya no se selecciona previamente.</CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="mb-1 block text-sm font-bold text-slate-700" htmlFor="local-acta">Centro de votación</label>
                  <select
                    id="local-acta"
                    value={localId}
                    onChange={(event) => {
                      const nextLocalId = event.target.value;
                      reset();
                      setLocalId(nextLocalId);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Seleccionar colegio</option>
                    {locales.map((local) => <option key={local.id} value={local.id}>{local.nombre}</option>)}
                  </select>
                  {selectedLocal && (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {confirmedHere} de {selectedLocal.total_mesas} actas confirmadas en este colegio.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={!localId ? 'pointer-events-none opacity-50' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-white">2</span> Fotografía del acta</CardTitle>
                  <CardDescription>El servidor conserva una copia WebP de alta calidad para auditoría.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="relative flex min-h-[360px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-primary hover:bg-blue-50/40">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="Vista previa del acta" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <div className="p-8">
                        <Camera className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                        <p className="font-bold text-slate-700">Tomar foto o seleccionar imagen</p>
                        <p className="mt-1 text-xs text-slate-500">JPG, PNG o WebP · máximo 10 MB</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(event) => chooseImage(event.target.files?.[0])}
                    />
                  </label>
                  <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
                    Incluye la hoja completa, evita reflejos y procura que los números manuscritos estén enfocados.
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!imageFile || !localId || stage === 'analyzing'}
                      onClick={() => analyze(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-black text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {stage === 'analyzing' ? <><Loader2 className="animate-spin" size={20} /> Analizando fotografía...</> : <><ScanLine size={20} /> Reconocer con IA (Google AI)</>}
                    </button>
                    <button
                      type="button"
                      disabled={!imageFile || !localId || stage === 'analyzing'}
                      onClick={() => analyze(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <PenLine size={15} /> Digitar manualmente a partir de la foto
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card className={`h-full ${stage !== 'review' && stage !== 'saving' ? 'opacity-60' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-white">3</span> Revisión y confirmación</CardTitle>
                  <CardDescription>Todo dato reconocido es editable. Nada se contabiliza hasta guardar.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!extraction ? (
                    <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-slate-400">
                      {stage === 'analyzing' ? <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" /> : <ImageUp className="mb-4 h-12 w-12" />}
                      <p className="max-w-sm font-medium">{stage === 'analyzing' ? 'Leyendo mesa, organizaciones y votos...' : 'La lectura aparecerá aquí después de procesar la fotografía.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mesa
                          <input value={extraction.mesaNumero} onChange={(event) => setExtraction({ ...extraction, mesaNumero: event.target.value.replace(/\D/g, '').slice(0, 10) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-black text-slate-900" />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Electores hábiles
                          <input type="number" min="0" value={numberValue(extraction.electoresHabiles)} onChange={(event) => setExtraction({ ...extraction, electoresHabiles: parsedCount(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-bold" />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ciudadanos que votaron
                          <input type="number" min="0" value={numberValue(extraction.ciudadanosVotaron)} onChange={(event) => setExtraction({ ...extraction, ciudadanosVotaron: parsedCount(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-bold" />
                        </label>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[600px] text-sm">
                          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                            <tr><th className="px-3 py-2 text-left">Organización política</th><th className="w-28 px-3 py-2">Provincial</th><th className="w-28 px-3 py-2">Distrital</th><th className="w-10" /></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extraction.resultados.map((result, index) => (
                              <tr key={`${result.orden}-${index}`}>
                                <td className="p-2"><input value={result.organizacion} onChange={(event) => setExtraction({ ...extraction, resultados: extraction.resultados.map((item, itemIndex) => itemIndex === index ? { ...item, organizacion: event.target.value } : item) })} className="w-full rounded-md border border-slate-200 px-2 py-2 font-semibold" /></td>
                                {(['provincial', 'distrital'] as const).map((column) => <td key={column} className="p-2"><input type="number" min="0" value={numberValue(result[column])} onChange={(event) => setExtraction({ ...extraction, resultados: extraction.resultados.map((item, itemIndex) => itemIndex === index ? { ...item, [column]: parsedCount(event.target.value) } : item) })} className="w-full rounded-md border border-slate-200 px-2 py-2 text-center font-black" /></td>)}
                                <td className="p-2"><button type="button" onClick={() => setExtraction({ ...extraction, resultados: extraction.resultados.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${result.organizacion}`}><Trash2 size={16} /></button></td>
                              </tr>
                            ))}
                            {(Object.keys(SPECIAL_LABELS) as Array<keyof typeof SPECIAL_LABELS>).map((key) => (
                              <tr key={key} className="bg-slate-50/70">
                                <td className="px-3 py-2 font-bold text-slate-700">{SPECIAL_LABELS[key]}</td>
                                {(['provincial', 'distrital'] as const).map((column) => <td key={column} className="p-2"><input type="number" min="0" value={numberValue(extraction.especiales[key][column])} onChange={(event) => updatePair('especiales', key, column, event.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-center font-black" /></td>)}
                                <td />
                              </tr>
                            ))}
                            <tr className="bg-blue-50 text-blue-950">
                              <td className="px-3 py-3 font-black">TOTAL DE VOTOS EMITIDOS</td>
                              {(['provincial', 'distrital'] as const).map((column) => <td key={column} className="p-2"><input type="number" min="0" value={numberValue(extraction.totalesEmitidos[column])} onChange={(event) => updatePair('totalesEmitidos', null, column, event.target.value)} className="w-full rounded-md border border-blue-200 px-2 py-2 text-center text-lg font-black" /></td>)}
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <button type="button" onClick={() => setExtraction({ ...extraction, resultados: [...extraction.resultados, { orden: extraction.resultados.length + 1, organizacion: '', provincial: null, distrital: null, confianza: null }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Plus size={15} /> Añadir organización</button>

                      {extraction.advertencias.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="mb-1 font-black">Revisar lectura</p>
                          <ul className="list-disc space-y-1 pl-5">{extraction.advertencias.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                        </div>
                      )}
                      {validation && validation.errors.length > 0 && (
                        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                          <p className="mb-1 font-black">Hay inconsistencias antes de guardar:</p>
                          <ul className="list-disc space-y-1 pl-5">{validation.errors.map((message) => <li key={message}>{message}</li>)}</ul>
                        </div>
                      )}
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Observaciones
                        <textarea value={extraction.observaciones} onChange={(event) => setExtraction({ ...extraction, observaciones: event.target.value.slice(0, 1000) })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal" />
                      </label>
                      <button type="button" onClick={finalize} disabled={!validation || validation.errors.length > 0 || stage === 'saving'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-4 font-black text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {stage === 'saving' ? <><Loader2 className="animate-spin" size={20} /> Guardando acta...</> : <><Save size={20} /> Confirmar y guardar acta</>}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </fieldset>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1"><p>{error}</p></div>
          </div>
          {imageFile && localId && stage === 'capture' && (
            <button
              type="button"
              onClick={() => analyze(true)}
              className="shrink-0 rounded-xl bg-red-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-900 transition flex items-center gap-1.5"
            >
              <PenLine size={14} /> Continuar con digitación manual
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { number: '1', title: 'Captura', description: 'Colegio y foto completa', Icon: Camera },
          { number: '2', title: 'Reconocimiento', description: 'Mesa y resultados', Icon: ScanLine },
          { number: '3', title: 'Confirmación', description: 'Revisión humana obligatoria', Icon: FileCheck2 },
        ].map(({ number, title, description, Icon }) => (
          <div key={number} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <Icon className="h-5 w-5 text-primary" />
            <div><p className="text-sm font-black text-slate-800">{number}. {title}</p><p className="text-xs text-slate-500">{description}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
