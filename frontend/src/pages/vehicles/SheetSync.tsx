import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sheetService, type SheetConfig, type SheetPreviewResponse, type SyncResult } from "@/services/sheetService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { ApiError } from "@/types";

const VEHICLE_FIELDS: { key: string; label: string; required: boolean; hint?: string }[] = [
  { key: "brand", label: "Marca", required: true },
  { key: "model", label: "Modelo", required: true },
  { key: "year", label: "Año", required: true },
  { key: "color", label: "Color", required: true },
  { key: "mileage", label: "Kilometraje", required: true },
  { key: "fuel_type", label: "Combustible", required: true, hint: "nafta / diesel / eléctrico / híbrido / gnc" },
  { key: "transmission", label: "Transmisión", required: true, hint: "manual / automático" },
  { key: "condition", label: "Condición", required: true, hint: "nuevo / usado" },
  { key: "price_resale", label: "Precio reventa", required: true },
  { key: "price_public", label: "Precio público", required: true },
  { key: "version", label: "Versión", required: false },
  { key: "body_type", label: "Carrocería", required: false },
  { key: "description", label: "Descripción", required: false },
  { key: "status", label: "Estado", required: false, hint: "disponible / reservado / vendido" },
  { key: "external_id", label: "Identificador único", required: false, hint: "Recomendado: patente, código interno. Permite actualizar en vez de duplicar." },
];

export function SheetSync() {
  const navigate = useNavigate();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savedConfig, setSavedConfig] = useState<SheetConfig | null>(null);

  const [url, setUrl] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<SheetPreviewResponse | null>(null);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  useEffect(() => {
    sheetService.getConfig()
      .then((cfg) => {
        if (cfg) {
          setSavedConfig(cfg);
          setUrl(cfg.sheet_url);
          setHasHeader(cfg.has_header_row);
          setMapping(cfg.column_mapping);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  const handlePreview = async () => {
    if (!url.trim()) {
      toast.error("Pegá la URL de la hoja primero.");
      return;
    }
    setPreviewing(true);
    setPreview(null);
    setSyncResult(null);
    try {
      const result = await sheetService.preview(url.trim(), hasHeader);
      setPreview(result);
    } catch (err) {
      toast.error((err as ApiError).detail ?? "No se pudo acceder a la hoja.");
    } finally {
      setPreviewing(false);
    }
  };

  const colLabel = (col: string) => {
    if (!preview) return col;
    const idx = col.charCodeAt(0) - 65 + (col.length > 1 ? (col.charCodeAt(0) - 65 + 1) * 26 : 0);
    const header = preview.headers[idx];
    return header ? `${col} — ${header}` : col;
  };

  const handleSaveAndSync = async () => {
    const missingRequired = VEHICLE_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Faltan campos requeridos: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await sheetService.saveConfig({ sheet_url: url.trim(), column_mapping: mapping, has_header_row: hasHeader });
      toast.success("Configuración guardada.");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al guardar la configuración.");
      setSaving(false);
      return;
    }

    setSyncing(true);
    setSaving(false);
    setSyncResult(null);
    try {
      const result = await sheetService.sync();
      setSyncResult(result);
      const parts = [];
      if (result.created) parts.push(`${result.created} creados`);
      if (result.updated) parts.push(`${result.updated} actualizados`);
      if (result.skipped) parts.push(`${result.skipped} omitidos`);
      if (result.errors.length === 0) {
        toast.success(`Sincronización completa: ${parts.join(" · ") || "sin cambios"}`);
      } else {
        toast.warning(`Sincronización con errores: ${parts.join(" · ")} · ${result.errors.length} error(es)`);
      }
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await sheetService.sync();
      setSyncResult(result);
      const parts = [];
      if (result.created) parts.push(`${result.created} creados`);
      if (result.updated) parts.push(`${result.updated} actualizados`);
      if (result.skipped) parts.push(`${result.skipped} omitidos`);
      if (result.errors.length === 0) {
        toast.success(`Sincronización completa: ${parts.join(" · ") || "sin cambios"}`);
      } else {
        toast.warning(`Sincronización con errores: ${parts.join(" · ")} · ${result.errors.length} error(es)`);
      }
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  if (loadingConfig) {
    return <div className="flex justify-center py-24"><Spinner /></div>;
  }

  const colOptions = preview?.columns ?? (savedConfig ? Object.values(savedConfig.column_mapping).filter(Boolean) : []);
  const hasPreview = !!preview;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/vehicles/my")} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Vincular hoja de cálculo</h1>
      </div>

      {savedConfig?.last_synced_at && (
        <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700">
            Última sincronización: {new Date(savedConfig.last_synced_at).toLocaleString("es-AR")}
          </p>
          <Button size="sm" variant="secondary" loading={syncing} onClick={handleQuickSync}>
            Sincronizar ahora
          </Button>
        </div>
      )}

      {/* Step 1 — URL */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1">1. URL de la hoja</h2>
        <p className="text-sm text-gray-500 mb-4">
          La hoja debe ser <strong>pública</strong> ("Cualquiera con el link puede ver"). Pegá la URL completa de Google Sheets.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            label="URL de Google Sheets"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setPreview(null); }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={hasHeader}
              onChange={(e) => { setHasHeader(e.target.checked); setPreview(null); }}
            />
            La primera fila tiene encabezados de columna
          </label>
          <Button variant="secondary" loading={previewing} onClick={handlePreview} className="self-start">
            Previsualizar hoja
          </Button>
        </div>

        {hasPreview && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-gray-50">
                <tr>
                  {preview.columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">
                      {col}{preview.headers[preview.columns.indexOf(col)] ? ` — ${preview.headers[preview.columns.indexOf(col)]}` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.sample_rows.map((row, ri) => (
                  <tr key={ri}>
                    {preview.columns.map((col, ci) => (
                      <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Step 2 — Column mapping */}
      {(hasPreview || savedConfig) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-1">2. Mapeo de columnas</h2>
          <p className="text-sm text-gray-500 mb-4">
            Indicá en qué columna de la hoja se encuentra cada dato. Los campos con <span className="text-red-500">*</span> son obligatorios.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VEHICLE_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.hint && <p className="text-xs text-gray-400">{field.hint}</p>}
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No mapear —</option>
                  {colOptions.map((col) => (
                    <option key={col} value={col}>
                      {hasPreview ? colLabel(col) : col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!mapping["external_id"] && (
            <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Sin "Identificador único" cada sincronización crea vehículos nuevos en vez de actualizar los existentes.
            </p>
          )}

          <div className="mt-6">
            <Button loading={saving || syncing} onClick={handleSaveAndSync}>
              Guardar y sincronizar
            </Button>
          </div>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`rounded-xl border p-4 ${syncResult.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <p className="font-semibold text-sm text-gray-800 mb-1">Resultado de la sincronización</p>
          <div className="flex gap-4 text-sm">
            <span className="text-green-700">{syncResult.created} creados</span>
            <span className="text-blue-700">{syncResult.updated} actualizados</span>
            <span className="text-gray-500">{syncResult.skipped} omitidos</span>
          </div>
          {syncResult.errors.length > 0 && (
            <div className="mt-2">
              <button
                className="text-xs text-amber-700 underline"
                onClick={() => setErrorsExpanded((v) => !v)}
              >
                {errorsExpanded ? "Ocultar" : "Ver"} {syncResult.errors.length} error(es)
              </button>
              {errorsExpanded && (
                <ul className="mt-2 space-y-1">
                  {syncResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-700">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
