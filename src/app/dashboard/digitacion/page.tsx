'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  PenLine,
  RotateCcw,
  Save,
  ScanLine,
} from 'lucide-react';
import { useAccess } from '@/components/access/AccessContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ACTAS_ESPERADAS,
  normalizeActaExtraction,
  normalizeMesaNumber,
  validateFinalActa,
  type ConteoDoble,
  type ExtraccionActa,
} from '@/lib/electoral/acta-schema';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';
import { authenticatedFormPost, authenticatedPost } from '@/lib/firebase/authenticated-request';
import { useElectoral } from '@/lib/firebase/ElectoralContext';

type AnalyzeResponse = {
  success: true;
  draftId: string;
  extraction: ExtraccionActa;
  imageUrl: string;
  reused?: boolean;
  iaFailed?: boolean;
  iaErrorMessage?: string;
};

type WizardStep = 1 | 2 | 3;

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
  const { role, hasPermission } = useAccess();
  const canManage = hasPermission('actas.manage');
  const isAdminOrSuper = role === 'superusuario' || role === 'administrador';
  const { locales, actas, loading } = useElectoral();

  // ─── Estado del Wizard por Pasos ──────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Paso 1: Colegio y Mesa previa
  const [localId, setLocalId] = useState('');
  const [mesaDigitada, setMesaDigitada] = useState('');

  // Paso 2: Foto y captura
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [iaError, setIaError] = useState('');

  // Paso 3: Revisión y confirmación
  const [draftId, setDraftId] = useState('');
  const [extraction, setExtraction] = useState<ExtraccionActa | null>(null);
  const [mesaLeidaPorIA, setMesaLeidaPorIA] = useState<string | null>(null);
  const [columnMode, setColumnMode] = useState<'distrital' | 'completo'>('distrital');
  const [rectificar, setRectificar] = useState(false);
  const [showPhotoInReview, setShowPhotoInReview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedLocal = locales.find((local) => local.id === localId);
  const confirmedHere = actas.filter((acta) => acta.local_id === localId).length;

  // Verificar si la mesa ingresada ya cuenta con acta registrada
  const normalizedMesaDigitada = normalizeMesaNumber(mesaDigitada);
  const mesaExiste = Boolean(
    normalizedMesaDigitada &&
    actas.some((a) => (a.mesa_numero || a.mesa_id) === normalizedMesaDigitada),
  );

  // Validación estricta con el nuevo soporte de columnMode
  const validation = useMemo(
    () => extraction ? validateFinalActa(extraction, columnMode) : null,
    [extraction, columnMode],
  );

  // Suma distrital calculada en vivo
  const sumaDistritalCalculada = useMemo(() => {
    if (!extraction) return 0;
    const orgs = extraction.resultados.reduce((acc, curr) => acc + (curr.distrital || 0), 0);
    const esp = (extraction.especiales.blancos.distrital || 0) +
                (extraction.especiales.nulos.distrital || 0) +
                (extraction.especiales.impugnados.distrital || 0);
    return orgs + esp;
  }, [extraction]);

  const aplicarSumaDistrital = () => {
    if (!extraction) return;
    setExtraction({
      ...extraction,
      totalesEmitidos: {
        ...extraction.totalesEmitidos,
        distrital: sumaDistritalCalculada,
      },
      ciudadanosVotaron: extraction.ciudadanosVotaron ?? sumaDistritalCalculada,
    });
  };

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCurrentStep(1);
    setLocalId('');
    setMesaDigitada('');
    setImageFile(null);
    setPreviewUrl('');
    setIsAnalyzing(false);
    setIaError('');
    setDraftId('');
    setExtraction(null);
    setMesaLeidaPorIA(null);
    setRectificar(false);
    setIsSaving(false);
    setSaveSuccess(false);
    setGeneralError('');
  };

  const handleChooseImage = (file?: File) => {
    setIaError('');
    setGeneralError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGeneralError('Usa una fotografía JPG, PNG o WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGeneralError('La fotografía no debe superar los 10 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // ─── Proceso de Análisis / Entrada Manual ─────────────────────────────────
  const processImage = async (manual = false) => {
    if (!canManage || !localId || !imageFile) return;
    setIsAnalyzing(true);
    setIaError('');
    setGeneralError('');

    try {
      const form = new FormData();
      form.set('localId', localId);
      form.set('image', imageFile);
      if (manual) form.set('manual', 'true');

      const response = await authenticatedFormPost<AnalyzeResponse>('/api/electoral/actas/analyze', form);
      const rawExtraccion = normalizeActaExtraction(response.extraction);

      // Asegurar que contenga los 12 partidos oficiales de Chaclacayo
      const completeResultados = PARTIDOS_CHACLACAYO.map((p, idx) => {
        const found = rawExtraccion.resultados.find((r) =>
          r.organizacion.toLowerCase().includes(p.alias.toLowerCase()) ||
          r.organizacion.toLowerCase().includes(p.nombre.toLowerCase()),
        );
        return {
          orden: idx + 1,
          organizacion: p.nombre,
          alias: p.alias,
          color: p.color,
          esPropio: p.esPropio,
          distrital: found?.distrital ?? null,
          provincial: found?.provincial ?? null,
          confianza: found?.confianza ?? 1,
        };
      });

      // Si la IA reconoció un número de mesa, guardarlo para comparar
      const recognizedMesa = rawExtraccion.mesaNumero || null;
      setMesaLeidaPorIA(recognizedMesa);

      // Usar la mesa digitada en el paso 1 si la IA vino vacía
      const finalMesaNumero = recognizedMesa || normalizedMesaDigitada;

      setDraftId(response.draftId);
      setExtraction({
        ...rawExtraccion,
        mesaNumero: finalMesaNumero,
        resultados: completeResultados,
      });

      if (response.iaFailed && response.iaErrorMessage) {
        setIaError(response.iaErrorMessage);
      }

      // Pasar inmediatamente al Paso 3
      setCurrentStep(3);
    } catch (err) {
      setIaError(errorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Actualizar votos especiales o totales
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

  // Confirmar y guardar acta
  const handleFinalize = async () => {
    if (!extraction || !draftId || !localId || !validation || validation.errors.length > 0) return;
    if (mesaExiste && !rectificar) {
      setGeneralError(`La mesa ${extraction.mesaNumero} ya está confirmada. Activa la opción de rectificación para actualizarla.`);
      return;
    }
    setIsSaving(true);
    setGeneralError('');
    try {
      await authenticatedPost('/api/electoral/actas/finalize', {
        draftId,
        localId,
        extraction,
        rectificar,
        columnMode,
      });
      setSaveSuccess(true);
    } catch (saveError) {
      setGeneralError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-in fade-in-50 duration-200">
      {/* ENCABEZADO Y PROGRESO GENERAL */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Ingreso de Actas Electorales
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Flujo paso a paso con verificación de mesa y conciliación distrital estricta.
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-right self-start sm:self-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Avance General</p>
          <p className="text-xl font-black text-blue-900">{actas.length} / {ACTAS_ESPERADAS} actas</p>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm font-bold text-amber-800">
          Tu rol tiene permisos de solo lectura. La captura y confirmación de actas están deshabilitadas.
        </div>
      )}

      {/* STEPPER NAVEGADOR (Paso 1, 2, 3) */}
      {!saveSuccess && (
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            disabled={isAnalyzing || isSaving}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              currentStep === 1
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              1
            </span>
            <span className="hidden sm:inline">Colegio y Mesa</span>
            <span className="sm:hidden">Mesa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (localId && normalizedMesaDigitada) setCurrentStep(2);
            }}
            disabled={!localId || !normalizedMesaDigitada || isAnalyzing || isSaving}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              currentStep === 2
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : !localId || !normalizedMesaDigitada
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              2
            </span>
            <span className="hidden sm:inline">Fotografía</span>
            <span className="sm:hidden">Foto</span>
          </button>

          <button
            type="button"
            disabled={!extraction || isAnalyzing || isSaving}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              currentStep === 3
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : !extraction
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </span>
            <span className="hidden sm:inline">Revisión y Votos</span>
            <span className="sm:hidden">Votos</span>
          </button>
        </div>
      )}

      {/* PANTALLA DE ÉXITO FINAL */}
      {saveSuccess ? (
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
          <CardContent className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 animate-in zoom-in-75 duration-300" />
            <h2 className="text-2xl font-black text-emerald-950">
              Acta de la Mesa {extraction?.mesaNumero} confirmada exitosamente
            </h2>
            <p className="max-w-md text-sm text-emerald-800">
              Los votos fueron integrados al cómputo distrital en tiempo real y la evidencia fotográfica quedó respaldada para auditoría.
            </p>
            <button
              type="button"
              onClick={resetAll}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 shadow-sm transition"
            >
              <RotateCcw size={18} /> Ingresar otra acta
            </button>
          </CardContent>
        </Card>
      ) : (
        <fieldset disabled={!canManage || isAnalyzing || isSaving} className={!canManage ? 'opacity-60' : ''}>
          {/* ═══════════════════════════════════════════════════════════════════════
              PASO 1: SELECCIONAR COLEGIO Y NÚMERO DE MESA
             ═══════════════════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <Card className="border-slate-200 shadow-sm animate-in fade-in-50 duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">1</span>
                  Paso 1: Identificación de Colegio y Mesa
                </CardTitle>
                <CardDescription className="text-xs">
                  Indica manualmente el centro de votación y el número de mesa que vas a ingresar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Selector manual de colegio */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="local-select">
                      Centro de Votación (Colegio) <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="local-select"
                      value={localId}
                      onChange={(e) => setLocalId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Seleccionar colegio</option>
                      {locales.map((local) => (
                        <option key={local.id} value={local.id}>
                          {local.nombre} ({local.total_mesas} mesas)
                        </option>
                      ))}
                    </select>
                    {selectedLocal && (
                      <p className="mt-1 text-[11px] text-slate-500 font-medium">
                        {confirmedHere} de {selectedLocal.total_mesas} actas recibidas en este colegio.
                      </p>
                    )}
                  </div>

                  {/* Número de Mesa */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="mesa-input">
                      Número de Mesa <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mesa-input"
                      type="text"
                      inputMode="numeric"
                      value={mesaDigitada}
                      onChange={(e) => setMesaDigitada(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Ej: 041295"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono font-bold text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Ingresa el número de mesa tal como figura en el encabezado del acta (4 a 10 dígitos).
                    </p>
                  </div>
                </div>

                {/* Comprobación si la mesa ya existe */}
                {mesaExiste && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      La mesa {normalizedMesaDigitada} ya cuenta con un acta confirmada en el sistema.
                    </p>
                    {isAdminOrSuper ? (
                      <div className="flex items-center gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
                          <input
                            type="checkbox"
                            checked={rectificar}
                            onChange={(e) => setRectificar(e.target.checked)}
                            className="h-4 w-4 rounded text-primary focus:ring-primary"
                          />
                          <span>Autorizar rectificación de esta mesa (Modo Dios / Admin)</span>
                        </label>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-800">
                        Solo un Administrador o Modo Dios tiene autorización para rectificar actas ya confirmadas.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!localId || normalizedMesaDigitada.length < 4 || (mesaExiste && !rectificar && !isAdminOrSuper)}
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary-dark transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Siguiente: Capturar Fotografía</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              PASO 2: FOTOGRAFÍA Y OPCIÓN DE IA O MANUAL
             ═══════════════════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <Card className="border-slate-200 shadow-sm animate-in fade-in-50 duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">2</span>
                    Paso 2: Fotografía del Acta Electoral
                  </CardTitle>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    Mesa: {normalizedMesaDigitada} • {selectedLocal?.nombre}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Captura el acta con buena luz. Luego elige si deseas reconocerla automáticamente o digitarla a mano.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Zona de captura o subida */}
                <label className="relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-primary hover:bg-blue-50/30">
                  {previewUrl ? (
                    <div className="relative w-full h-[340px] flex items-center justify-center bg-slate-900/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Vista previa del acta" className="max-h-full max-w-full object-contain" />
                      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Foto lista (haz clic para cambiar)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8">
                      <Camera className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                      <p className="font-bold text-slate-700 text-sm">Tomar foto o cargar imagen del acta</p>
                      <p className="mt-1 text-xs text-slate-400">JPG, PNG o WebP · hasta 10 MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => handleChooseImage(e.target.files?.[0])}
                  />
                </label>

                {/* Mensaje de fallo de IA si ocurrió */}
                {iaError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Aviso sobre la IA:</p>
                      <p>{iaError}</p>
                      <p className="mt-1 font-semibold text-amber-800">
                        No te preocupes: puedes pulsar el botón <strong>&quot;Digitar manualmente con esta foto&quot;</strong> para continuar de inmediato.
                      </p>
                    </div>
                  </div>
                )}

                {/* Botones de acción del paso 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={!imageFile || isAnalyzing}
                    onClick={() => processImage(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-white shadow-sm hover:bg-primary-dark transition disabled:cursor-not-allowed disabled:opacity-40 text-xs sm:text-sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Analizando con IA...</span>
                      </>
                    ) : (
                      <>
                        <ScanLine size={18} />
                        <span>Reconocer con IA (Google AI)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!imageFile || isAnalyzing}
                    onClick={() => processImage(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition disabled:cursor-not-allowed disabled:opacity-40 text-xs sm:text-sm"
                  >
                    <PenLine size={18} />
                    <span>Digitar manualmente con esta foto</span>
                  </button>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    <ChevronLeft size={16} /> Volver a Colegio y Mesa
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              PASO 3: REVISIÓN, COTEJO Y DIGITACIÓN FINAL DE VOTOS
             ═══════════════════════════════════════════════════════════════════════ */}
          {currentStep === 3 && extraction && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Barra de verificación de mesa (simple y compacta) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Mesa Electoral:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={extraction.mesaNumero}
                    onChange={(e) =>
                      setExtraction({
                        ...extraction,
                        mesaNumero: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    className="w-24 text-center font-mono font-black text-sm py-1 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
                    ({selectedLocal?.nombre})
                  </span>

                  {/* Validación compacta entre la mesa digitada y la leída por IA */}
                  {mesaLeidaPorIA && (
                    mesaLeidaPorIA === extraction.mesaNumero ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                        <Check size={12} /> Mesa verificada con IA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300">
                        <AlertTriangle size={13} className="text-amber-600" />
                        <span>IA leyó {mesaLeidaPorIA}. Verifica el número manuscrito.</span>
                        <button
                          type="button"
                          onClick={() => setExtraction({ ...extraction, mesaNumero: mesaLeidaPorIA })}
                          className="underline text-blue-700 hover:text-blue-900 ml-1"
                        >
                          Usar {mesaLeidaPorIA}
                        </button>
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => setShowPhotoInReview(!showPhotoInReview)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                      title="Mostrar u ocultar fotografía para cotejo"
                    >
                      {showPhotoInReview ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showPhotoInReview ? 'Ocultar Foto' : 'Ver Foto'}</span>
                    </button>
                  )}
                  {/* Selector de modo distrital / completo */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setColumnMode('distrital')}
                      className={`px-2 py-1 rounded-md transition ${
                        columnMode === 'distrital' ? 'bg-white text-primary shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Distrital (Karen)
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnMode('completo')}
                      className={`px-2 py-1 rounded-md transition ${
                        columnMode === 'completo' ? 'bg-white text-primary shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Completo (+Provincial)
                    </button>
                  </div>
                </div>
              </div>

              {/* GRID PRINCIPAL: Split View (Foto al lado en pantallas grandes si está activa) */}
              <div className={`grid grid-cols-1 ${showPhotoInReview && previewUrl ? 'lg:grid-cols-12' : ''} gap-4`}>
                {/* Panel de Foto para Cotejo */}
                {showPhotoInReview && previewUrl && (
                  <div className="lg:col-span-5 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner h-[400px] lg:h-[620px] sticky top-4 flex flex-col">
                    <div className="px-3 py-2 bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-between border-b border-slate-700">
                      <span className="flex items-center gap-1.5">
                        <FileCheck2 size={14} className="text-amber-400" />
                        Cotejo del Acta Física
                      </span>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-300 hover:underline"
                      >
                        Ampliar ↗
                      </a>
                    </div>
                    <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Acta original"
                        className="max-w-full max-h-full object-contain rounded"
                      />
                    </div>
                  </div>
                )}

                {/* Panel de Formulario y Votos */}
                <div className={showPhotoInReview && previewUrl ? 'lg:col-span-7' : 'w-full'}>
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Métricas de padrón: Electores y Ciudadanos */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Electores Hábiles
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={numberValue(extraction.electoresHabiles)}
                            onChange={(e) =>
                              setExtraction({
                                ...extraction,
                                electoresHabiles: parsedCount(e.target.value.replace(/\D/g, '')),
                              })
                            }
                            placeholder="300"
                            className="mt-1 w-full text-base font-black text-slate-800 bg-transparent focus:outline-none"
                          />
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Ciudadanos que Votaron <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={numberValue(extraction.ciudadanosVotaron)}
                            onChange={(e) =>
                              setExtraction({
                                ...extraction,
                                ciudadanosVotaron: parsedCount(e.target.value.replace(/\D/g, '')),
                              })
                            }
                            placeholder="0"
                            className="mt-1 w-full text-base font-black text-blue-900 bg-transparent focus:outline-none"
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex flex-col justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                            Suma Calculada
                          </span>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-black text-blue-950">{sumaDistritalCalculada}</span>
                            <button
                              type="button"
                              onClick={aplicarSumaDistrital}
                              className="px-2 py-1 bg-primary text-white font-bold rounded-md hover:bg-primary-dark transition text-[10px] shadow-xs"
                              title="Copiar la suma física al Total de Votos y Ciudadanos"
                            >
                              Copiar Total
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* TABLA DE LOS 12 PARTIDOS POLÍTICOS FIJOS (sin flechas ni borrado) */}
                      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Organizaciones Políticas (12 Oficiales Chaclacayo)</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Digita directamente los números en las casillas
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-50/80 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-200">
                              <tr>
                                <th className="px-2.5 py-2 w-8 text-center">N°</th>
                                <th className="px-3 py-2">Partido Político</th>
                                {columnMode === 'completo' && (
                                  <th className="px-2 py-2 text-center w-24">Provincial</th>
                                )}
                                <th className="px-2 py-2 text-center w-28">
                                  {columnMode === 'distrital' ? 'Votos Distrital' : 'Distrital'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {extraction.resultados.map((result, index) => {
                                const isPropio = result.organizacion.toLowerCase().includes('fuerza ciudadana');
                                return (
                                  <tr
                                    key={result.orden || index}
                                    className={`transition-colors ${
                                      isPropio ? 'bg-blue-50/70 hover:bg-blue-100/60 font-semibold' : 'hover:bg-slate-50/60'
                                    }`}
                                  >
                                    <td className="px-2.5 py-2 text-center font-mono text-slate-400">
                                      {result.orden || index + 1}
                                    </td>
                                    {/* Nombre fijo del partido, NO input editable */}
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800 text-xs">
                                          {result.organizacion}
                                        </span>
                                        {isPropio && (
                                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white rounded">
                                            Karen Acevedo · Propio
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    {/* Casilla Provincial (sin flechitas) */}
                                    {columnMode === 'completo' && (
                                      <td className="px-2 py-1.5 text-center">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={numberValue(result.provincial)}
                                          onChange={(e) => {
                                            const val = parsedCount(e.target.value.replace(/\D/g, ''));
                                            setExtraction({
                                              ...extraction,
                                              resultados: extraction.resultados.map((item, i) =>
                                                i === index ? { ...item, provincial: val } : item,
                                              ),
                                            });
                                          }}
                                          className="w-20 text-center text-xs font-bold py-1 px-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </td>
                                    )}
                                    {/* Casilla Distrital (sin flechitas) */}
                                    <td className="px-2 py-1.5 text-center">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={numberValue(result.distrital)}
                                        onChange={(e) => {
                                          const val = parsedCount(e.target.value.replace(/\D/g, ''));
                                          setExtraction({
                                            ...extraction,
                                            resultados: extraction.resultados.map((item, i) =>
                                              i === index ? { ...item, distrital: val } : item,
                                            ),
                                          });
                                        }}
                                        className={`w-20 text-center text-xs font-black py-1 px-1.5 rounded-md border focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                          isPropio
                                            ? 'border-blue-400 bg-white text-blue-900 focus:ring-blue-500 ring-1 ring-blue-200'
                                            : 'border-slate-200 bg-white text-slate-800 focus:ring-primary'
                                        }`}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* VOTOS ESPECIALES (sin flechitas) */}
                              {(Object.keys(SPECIAL_LABELS) as Array<keyof typeof SPECIAL_LABELS>).map((key) => (
                                <tr key={key} className="bg-slate-50/70 font-medium">
                                  <td className="px-2.5 py-2 text-center text-slate-400 font-mono">—</td>
                                  <td className="px-3 py-2 text-slate-700 text-xs">
                                    {SPECIAL_LABELS[key]}
                                  </td>
                                  {columnMode === 'completo' && (
                                    <td className="px-2 py-1.5 text-center">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={numberValue(extraction.especiales[key].provincial)}
                                        onChange={(e) =>
                                          updatePair('especiales', key, 'provincial', e.target.value.replace(/\D/g, ''))
                                        }
                                        className="w-20 text-center text-xs font-bold py-1 px-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </td>
                                  )}
                                  <td className="px-2 py-1.5 text-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={numberValue(extraction.especiales[key].distrital)}
                                      onChange={(e) =>
                                        updatePair('especiales', key, 'distrital', e.target.value.replace(/\D/g, ''))
                                      }
                                      className="w-20 text-center text-xs font-bold py-1 px-1.5 rounded-md border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                </tr>
                              ))}

                              {/* FILA DE TOTALES */}
                              <tr className="bg-blue-50/90 text-blue-950 font-black border-t-2 border-blue-200">
                                <td className="px-2.5 py-2.5 text-center">—</td>
                                <td className="px-3 py-2.5 uppercase tracking-wide text-xs">
                                  TOTAL DE VOTOS EMITIDOS
                                </td>
                                {columnMode === 'completo' && (
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={numberValue(extraction.totalesEmitidos.provincial)}
                                      onChange={(e) =>
                                        updatePair('totalesEmitidos', null, 'provincial', e.target.value.replace(/\D/g, ''))
                                      }
                                      className="w-20 text-center text-xs font-black py-1 px-1.5 rounded-md border border-blue-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                )}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={numberValue(extraction.totalesEmitidos.distrital)}
                                    onChange={(e) =>
                                      updatePair('totalesEmitidos', null, 'distrital', e.target.value.replace(/\D/g, ''))
                                    }
                                    className="w-20 text-center text-sm font-black py-1 px-1.5 rounded-md border border-blue-400 bg-white text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* INCONSISTENCIAS / ERRORES MATEMÁTICOS DE CUADRATURA */}
                      {validation && validation.errors.length > 0 && (
                        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            Inconsistencias que impiden guardar el acta:
                          </p>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {validation.errors.map((msg) => (
                              <li key={msg}>{msg}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Observaciones opcionales */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          Observaciones manuscritas del acta (opcional)
                        </label>
                        <textarea
                          rows={2}
                          value={extraction.observaciones}
                          onChange={(e) => setExtraction({ ...extraction, observaciones: e.target.value.slice(0, 1000) })}
                          placeholder="Anotaciones de los miembros de mesa o personeros..."
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {generalError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                          {generalError}
                        </div>
                      )}

                      {/* BOTONES FINALES DE CONFIRMACIÓN */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
                        >
                          <ChevronLeft size={16} /> Volver a Fotografía
                        </button>

                        <button
                          type="button"
                          onClick={handleFinalize}
                          disabled={!validation || validation.errors.length > 0 || isSaving}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 px-6 py-3 font-bold text-white text-xs sm:text-sm shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="animate-spin" size={18} />
                              <span>Guardando acta...</span>
                            </>
                          ) : (
                            <>
                              <Save size={18} />
                              <span>Confirmar y guardar acta</span>
                            </>
                          )}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
