'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Save, Loader2, Phone, Mail, Database, RefreshCw, Trash2, FileSpreadsheet, Clipboard, X, Check, AlertTriangle, AlertCircle } from "lucide-react";
import { useElectoral } from "@/lib/firebase/ElectoralContext";
import { seedColegiosChaclacayo, limpiarBaseElectoral, importarBaseElectoralPersonalizada, FilaImportacionElectoral } from "@/lib/firebase/seed-chaclacayo";

type RawRow = Record<string, unknown>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}

export default function ConfiguracionPage() {
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Electoral Context
  const { locales, mesas } = useElectoral();
  const [loadingDbAction, setLoadingDbAction] = useState(false);
  const [dbMessage, setDbMessage] = useState({ text: "", type: "" });

  // Modal de Carga Masiva
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'excel' | 'copy'>('excel');
  const [pastedText, setPastedText] = useState("");
  const [parsedData, setParsedData] = useState<FilaImportacionElectoral[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ locales: number; mesas: number }>({ locales: 0, mesas: 0 });
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, "config", "contacto"));
        if (docSnap.exists()) {
          setWhatsapp(docSnap.data().whatsapp || "");
          setCorreo(docSnap.data().correo || "");
        } else {
          setWhatsapp("51961858568");
          setCorreo("karen.alcaldesa2026@gmail.com");
        }
      } catch (error) {
        console.error("Error cargando configuración:", error);
      } finally {
        setLoadingConfig(false);
      }
    };

    void loadConfig();
  }, []);

  useEffect(() => {
    if (!showImportModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingDbAction) setShowImportModal(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [loadingDbAction, showImportModal]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      await setDoc(doc(db, "config", "contacto"), {
        whatsapp,
        correo,
      });
      setMessage({
        text: "✅ Configuración guardada. Los botones de contacto en la web pública se han actualizado.",
        type: "success",
      });
    } catch (error) {
      console.error("Error guardando configuración:", error);
      setMessage({ text: "❌ Hubo un error al guardar. Intenta de nuevo.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDatabase = async () => {
    if (locales.length > 0) {
      const confirm = window.confirm(
        "⚠️ ¡Atención! Al inicializar se borrarán todos los locales, mesas y asignaciones de personeros actuales para volver a cargarlos de cero. ¿Estás seguro de continuar?"
      );
      if (!confirm) return;
    }

    setLoadingDbAction(true);
    setDbMessage({ text: "", type: "" });

    try {
      await seedColegiosChaclacayo();
      setDbMessage({
        text: "✅ Base electoral estándar de Chaclacayo cargada exitosamente.",
        type: "success",
      });
    } catch (error: unknown) {
      setDbMessage({ text: "❌ Error al cargar colegios y mesas: " + getErrorMessage(error), type: "error" });
    } finally {
      setLoadingDbAction(false);
    }
  };

  const handleClearDatabase = async () => {
    const confirm = window.confirm(
      "⚠️ ¿Estás completamente seguro de borrar todos los locales, mesas, actas y asignaciones? Esta acción no se puede deshacer."
    );
    if (!confirm) return;

    setLoadingDbAction(true);
    setDbMessage({ text: "", type: "" });

    try {
      await limpiarBaseElectoral();
      setDbMessage({
        text: "🗑️ Datos electorales borrados correctamente.",
        type: "success",
      });
    } catch (error: unknown) {
      setDbMessage({ text: "❌ Error al borrar datos: " + getErrorMessage(error), type: "error" });
    } finally {
      setLoadingDbAction(false);
    }
  };

  // ─── LÓGICA DE IMPORTACIÓN Y ANÁLISIS DE COLUMNAS ────────────────────────

  /**
   * Mapea de forma inteligente las columnas leídas para asociarlas a los campos correctos.
   * Esto permite que carguen archivos con nombres de columnas variables.
   */
  const processRawRows = (rawRows: RawRow[]) => {
    if (rawRows.length === 0) {
      setParsedData([]);
      setPreviewSummary({ locales: 0, mesas: 0 });
      return;
    }

    // Buscar la fila de cabecera (normalmente la primera fila con nombres)
    const firstRow = rawRows[0];
    const headers = Object.keys(firstRow);

    // Mapeo inteligente (Key en el excel -> Campo en la app)
    let colMesa = "";
    let colLocal = "";
    let colDireccion = "";
    let colZona = "";
    let colLat = "";
    let colLng = "";

    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      // Remover tildes y caracteres especiales
      const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (normalized.includes("mesa") || normalized.includes("nro") || normalized.includes("numero")) colMesa = h;
      else if (normalized.includes("local") || normalized.includes("colegio") || normalized.includes("institucion")) colLocal = h;
      else if (normalized.includes("direccion") || normalized.includes("dir")) colDireccion = h;
      else if (normalized.includes("zona") || normalized.includes("distrito") || normalized.includes("sector")) colZona = h;
      else if (normalized.includes("lat") || normalized.includes("latitud")) colLat = h;
      else if (normalized.includes("long") || normalized.includes("longitud") || normalized.includes("lng")) colLng = h;
    });

    if (!colMesa || !colLocal) {
      setImportError("No se pudieron identificar las columnas obligatorias: 'Mesa' y 'Local/Colegio'. Revisa el archivo.");
      setParsedData([]);
      return;
    }

    setImportError("");

    // Mapear filas
    const filasMapeadas: FilaImportacionElectoral[] = rawRows.map((r) => ({
      mesa: String(r[colMesa] || "").trim(),
      local: String(r[colLocal] || "").trim(),
      direccion: colDireccion ? String(r[colDireccion] || "").trim() : undefined,
      zona: colZona ? String(r[colZona] || "").trim() : undefined,
      latitud: colLat && r[colLat] ? Number(r[colLat]) : undefined,
      longitud: colLng && r[colLng] ? Number(r[colLng]) : undefined,
    })).filter((f) => f.mesa && f.local); // Filtra vacíos

    setParsedData(filasMapeadas);

    // Calcular resumen de vista previa
    const localesUnicos = new Set(filasMapeadas.map(f => f.local.toUpperCase().trim()));
    setPreviewSummary({
      locales: localesUnicos.size,
      mesas: filasMapeadas.length
    });
  };

  // Procesar archivo Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = event.target?.result;
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("No se pudo leer el archivo.");
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
        processRawRows(rawJson);
      } catch (error: unknown) {
        setImportError("Error al procesar el archivo Excel: " + getErrorMessage(error));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePastedTextChange = (value: string) => {
    setPastedText(value);

    if (!value.trim()) {
      setParsedData([]);
      setPreviewSummary({ locales: 0, mesas: 0 });
      setImportError("");
      return;
    }

    try {
      const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const headers = lines[0].split('\t').map((header) => header.trim());
      const rawJson: RawRow[] = lines.slice(1).map((line) => {
        const cells = line.split('\t');
        const row: RawRow = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] || "";
        });
        return row;
      });

      processRawRows(rawJson);
    } catch (error: unknown) {
      setImportError("Error al procesar el texto pegado: " + getErrorMessage(error));
    }
  };

  // Ejecutar la importación masiva final a Firestore
  const executeMassImport = async () => {
    if (parsedData.length === 0) return;

    const confirm = window.confirm(
      `⚠️ ¿Confirmas importar ${previewSummary.mesas} mesas agrupadas en ${previewSummary.locales} locales? Esto reemplazará toda la estructura de locales y mesas actual.`
    );
    if (!confirm) return;

    setLoadingDbAction(true);
    setDbMessage({ text: "", type: "" });
    setShowImportModal(false);

    try {
      await importarBaseElectoralPersonalizada(parsedData);
      setDbMessage({
        text: `✅ Importación completada: se registraron ${previewSummary.locales} locales y ${previewSummary.mesas} mesas exitosamente.`,
        type: "success",
      });
      // Limpiar estados
      setPastedText("");
      setParsedData([]);
    } catch (error: unknown) {
      console.error(error);
      setDbMessage({
        text: "❌ Error durante la importación masiva: " + getErrorMessage(error),
        type: "error",
      });
    } finally {
      setLoadingDbAction(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-black text-dark mb-2">Configuración del Sistema</h1>
        <p className="text-text">
          Administra los datos de contacto público y la base de locales del Día D.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Panel 1: Contacto Público */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-dark mb-2">Contacto Público</h2>
            <p className="text-text mb-6 text-sm">
              Estos datos aparecen en el Footer y el botón de WhatsApp en la web pública.
            </p>

            {loadingConfig ? (
              <div className="py-8 flex justify-center">
                <Loader2 size={30} className="animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-5">
                {message.text && (
                  <div
                    className={`p-3 rounded-xl text-sm font-medium ${
                      message.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-dark mb-1">
                    WhatsApp de Recepción
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Phone size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                      placeholder="Ej. 51999888777"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-dark mb-1">
                    Correo Electrónico Oficial
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                      placeholder="karen.alcaldesa2026@gmail.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-all shadow-sm cursor-pointer"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Guardar Datos de Contacto
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Panel 2: Base de Datos Electoral */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-dark mb-2">Base de Datos Electoral</h2>
            <p className="text-text mb-6 text-sm">
              Carga, limpia o importa la lista de colegios y mesas de votación para el Día de la elección.
            </p>

            <div className="space-y-5">
              {dbMessage.text && (
                <div
                  className={`p-3 rounded-xl text-sm font-medium ${
                    dbMessage.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {dbMessage.text}
                </div>
              )}

              {/* Status de la Base de Datos */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 font-semibold">Estado base de datos:</span>
                  {locales.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      🟢 Inicializada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      ⚠️ Vacía
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-center mt-1 border-t border-slate-100 pt-3">
                  <div className="border-r border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Locales</p>
                    <p className="text-2xl font-black text-slate-800">{locales.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mesas</p>
                    <p className="text-2xl font-black text-slate-800">{mesas.length}</p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="space-y-3 pt-2">
                
                {/* Botón Importación Avanzada */}
                <button
                  type="button"
                  onClick={() => {
                    setImportError("");
                    setParsedData([]);
                    setPastedText("");
                    setShowImportModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={18} />
                  Carga Avanzada (Excel / Pegar)
                </button>

                <button
                  type="button"
                  disabled={loadingDbAction}
                  onClick={handleSeedDatabase}
                  className="w-full flex items-center justify-center gap-2 bg-dark text-white font-bold py-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-50 text-sm cursor-pointer"
                >
                  {loadingDbAction ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Cargar Base Estándar (Chaclacayo)
                </button>

                {locales.length > 0 && (
                  <button
                    type="button"
                    disabled={loadingDbAction}
                    onClick={handleClearDatabase}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50 text-sm cursor-pointer"
                  >
                    <Trash2 size={16} />
                    Limpiar Base Electoral
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal: Carga Avanzada */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 id="import-title" className="font-black text-xl text-dark">Carga Masiva de Locales y Mesas</h3>
                <p className="text-xs text-slate-500 mt-1">Crea tu estructura electoral arrastrando tu Excel o copiando celdas directamente.</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar carga masiva"
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-slate-50 px-6 pt-2 gap-2">
              <button
                type="button"
                aria-pressed={importTab === 'excel'}
                onClick={() => setImportTab('excel')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${importTab === 'excel' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <FileSpreadsheet size={16} />
                Subir Archivo Excel
              </button>
              <button
                type="button"
                aria-pressed={importTab === 'copy'}
                onClick={() => setImportTab('copy')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${importTab === 'copy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <Clipboard size={16} />
                Pegar Celdas de Excel
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              
              {/* Instrucción de columnas */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-xs text-blue-800 flex gap-2.5">
                <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Columnas recomendadas en tu Excel:</p>
                  <p className="text-slate-600 mb-2 leading-relaxed">
                    El sistema detectará automáticamente las columnas. Asegúrate de tener al menos:
                  </p>
                  <p className="font-semibold text-slate-700">
                    Mesa | Local o Colegio | Dirección (Opcional) | Zona (Opcional) | Latitud (Opcional) | Longitud (Opcional)
                  </p>
                </div>
              </div>

              {/* Errores de lectura */}
              {importError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-xs text-red-700 flex gap-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p>{importError}</p>
                </div>
              )}

              {/* Tab 1: Excel */}
              {importTab === 'excel' && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-blue-50/10 transition-all">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <FileSpreadsheet size={40} className="text-slate-400" />
                    <div className="text-center">
                      <span className="text-blue-600 font-bold text-sm block">Selecciona o arrastra tu archivo Excel</span>
                      <span className="text-xs text-slate-400 block mt-1">Formatos soportados: .xlsx, .xls, .csv</span>
                    </div>
                  </label>
                </div>
              )}

              {/* Tab 2: Copy Paste */}
              {importTab === 'copy' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Pega las celdas copiadas de tu Excel aquí:</label>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => handlePastedTextChange(e.target.value)}
                    placeholder="Mesa	Local	Dirección&#10;045001	I.E. Estenos	Av. Nicolás Ayllón&#10;045002	I.E. Estenos	Av. Nicolás Ayllón..."
                    className="w-full border rounded-2xl p-4 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-slate-50"
                  />
                </div>
              )}

              {/* Vista Previa de Datos a Importar */}
              {parsedData.length > 0 && (
                <div className="border border-slate-100 rounded-2xl overflow-hidden mt-6 shadow-sm">
                  <div className="bg-slate-50 p-4 flex items-center justify-between border-b">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Vista Previa (Primeros 5 registros)</span>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">🏢 {previewSummary.locales} Locales</span>
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">🗳️ {previewSummary.mesas} Mesas</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 text-slate-500 font-bold border-b">
                          <th className="p-3">Mesa</th>
                          <th className="p-3">Local / Colegio</th>
                          <th className="p-3">Dirección</th>
                          <th className="p-3">Zona</th>
                          <th className="p-3 text-right">Ubicación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.slice(0, 5).map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-blue-700">{d.mesa}</td>
                            <td className="p-3 font-semibold text-slate-800">{d.local}</td>
                            <td className="p-3 text-slate-500">{d.direccion || '—'}</td>
                            <td className="p-3 text-slate-500">{d.zona || '—'}</td>
                            <td className="p-3 text-slate-400 text-right">
                              {d.latitud && d.longitud ? `${d.latitud.toFixed(4)}, ${d.longitud.toFixed(4)}` : 'Auto (Desplazado)'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 5 && (
                    <div className="bg-slate-50/50 p-3 text-center text-xs text-slate-500 border-t">
                      y {parsedData.length - 5} filas más...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-5 py-2.5 bg-white border rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={parsedData.length === 0}
                onClick={executeMassImport}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check size={16} />
                Confirmar y Subir a Firestore
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Info extra */}
      <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl flex gap-3 text-sm text-blue-800">
        <Database size={24} className="shrink-0 text-blue-600 mt-0.5" />
        <div>
          <p className="font-bold mb-1">💡 Notas sobre Operación Electoral</p>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li>La carga estándar creará los 7 centros históricos de Chaclacayo y sus mesas correlativas.</li>
            <li>Si realizas un cambio de locales o mesas, la base de datos se actualizará y los Digitadores verán las nuevas mesas disponibles inmediatamente en el módulo de Ingreso de Actas.</li>
            <li>Los datos de los voluntarios no se verán alterados por estas operaciones de base de datos.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
