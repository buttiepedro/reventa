import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { catalogService, type CatalogMake, type CatalogModel, type CatalogTrim } from "@/services/catalogService";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleCreate, FuelType, Transmission, VehicleCondition, VehicleStatus } from "@/types/vehicle";

const CURRENT_YEAR = new Date().getFullYear();
const CUSTOM = "__custom__";

const emptyForm: VehicleCreate = {
  brand: "", model: "", year: CURRENT_YEAR, version: "", color: "",
  mileage: 0, fuel_type: "gasoline", transmission: "manual", condition: "used",
  body_type: "", plate: "", price_resale: 0, price_public: 0, description: "", status: "available",
};

export function VehicleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<VehicleCreate>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Catalog state
  const [makes, setMakes] = useState<CatalogMake[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [trims, setTrims] = useState<CatalogTrim[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTrims, setLoadingTrims] = useState(false);

  // Selected catalog IDs (for cascading)
  const [selectedMakeId, setSelectedMakeId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  // "Otro" free-text fallback
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customTrim, setCustomTrim] = useState("");

  const set = (key: keyof VehicleCreate, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Load makes on mount
  useEffect(() => {
    catalogService.getMakes()
      .then(setMakes)
      .catch(() => {})
      .finally(() => { if (!isEdit) setLoading(false); });
  }, [isEdit]);

  // Load vehicle in edit mode, then pre-select catalog values
  useEffect(() => {
    if (!isEdit) return;
    vehicleService.get(id).then(async (v) => {
      setForm({
        brand: v.brand, model: v.model, year: v.year, version: v.version ?? "",
        color: v.color, mileage: v.mileage, fuel_type: v.fuel_type,
        transmission: v.transmission, condition: v.condition, body_type: v.body_type ?? "",
        plate: v.plate ?? "", price_resale: v.price_resale, price_public: v.price_public,
        description: v.description ?? "", status: v.status,
      });

      // Try to pre-select catalog entries
      try {
        const makeList = await catalogService.getMakes();
        setMakes(makeList);
        const foundMake = makeList.find((m) => m.name.toLowerCase() === v.brand.toLowerCase());
        if (foundMake) {
          setSelectedMakeId(foundMake.id);
          const modelList = await catalogService.getModels(foundMake.id);
          setModels(modelList);
          const foundModel = modelList.find((m) => m.name.toLowerCase() === v.model.toLowerCase());
          if (foundModel) {
            setSelectedModelId(foundModel.id);
            const trimList = await catalogService.getTrims(foundModel.id);
            setTrims(trimList);
            if (!trimList.find((t) => t.name.toLowerCase() === (v.version ?? "").toLowerCase())) {
              setCustomTrim(v.version ?? "");
            }
          } else {
            setCustomModel(v.model);
            setCustomTrim(v.version ?? "");
          }
        } else {
          setCustomBrand(v.brand);
          setCustomModel(v.model);
          setCustomTrim(v.version ?? "");
        }
      } catch { /* catalog errors don't block form */ }
    }).catch(() => toast.error("No se pudo cargar el vehículo.")).finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleMakeChange = async (value: string) => {
    setSelectedMakeId(value);
    setSelectedModelId("");
    setModels([]);
    setTrims([]);
    setCustomModel("");
    setCustomTrim("");
    if (value === CUSTOM) {
      set("brand", customBrand);
      set("model", "");
      set("version", "");
      return;
    }
    const make = makes.find((m) => m.id === value);
    if (make) {
      set("brand", make.name);
      set("model", "");
      set("version", "");
      setLoadingModels(true);
      try { setModels(await catalogService.getModels(value)); }
      catch { toast.error("Error al cargar modelos."); }
      finally { setLoadingModels(false); }
    }
  };

  const handleModelChange = async (value: string) => {
    setSelectedModelId(value);
    setTrims([]);
    setCustomTrim("");
    if (value === CUSTOM) {
      set("model", customModel);
      set("version", "");
      return;
    }
    const model = models.find((m) => m.id === value);
    if (model) {
      set("model", model.name);
      set("version", "");
      setLoadingTrims(true);
      try { setTrims(await catalogService.getTrims(value)); }
      catch { toast.error("Error al cargar motorizaciones."); }
      finally { setLoadingTrims(false); }
    }
  };

  const handleTrimChange = (value: string) => {
    if (value === CUSTOM) {
      set("version", customTrim);
    } else {
      const trim = trims.find((t) => t.id === value);
      if (trim) set("version", trim.name);
    }
  };

  const activeMakeSelect = selectedMakeId || (customBrand ? CUSTOM : "");
  const activeModelSelect = selectedModelId || (customModel ? CUSTOM : "");
  const activeTrimSelect = trims.find((t) => t.name === form.version)?.id
    || (form.version && !trims.find((t) => t.name === form.version) ? CUSTOM : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        version: form.version || undefined,
        body_type: form.body_type || undefined,
        description: form.description || undefined,
      };
      if (isEdit) {
        await vehicleService.update(id, payload);
        toast.success("Vehículo actualizado.");
        navigate(`/vehicles/${id}`);
      } else {
        const created = await vehicleService.create(payload);
        toast.success("Vehículo creado.");
        navigate(`/vehicles/${created.id}`);
      }
    } catch {
      toast.error("Error al guardar el vehículo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {isEdit ? "Editar vehículo" : "Nuevo vehículo"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

        {/* Brand */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Marca <span className="text-red-500">*</span></label>
          <select
            required
            value={activeMakeSelect}
            onChange={(e) => handleMakeChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Seleccioná una marca —</option>
            {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={CUSTOM}>Otro (especificar...)</option>
          </select>
          {activeMakeSelect === CUSTOM && (
            <Input
              placeholder="Escribí la marca"
              value={customBrand}
              onChange={(e) => { setCustomBrand(e.target.value); set("brand", e.target.value); }}
              required
            />
          )}
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Modelo <span className="text-red-500">*</span></label>
          <select
            required
            value={activeModelSelect}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!activeMakeSelect}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{activeMakeSelect ? (loadingModels ? "Cargando..." : "— Seleccioná un modelo —") : "— Primero elegí una marca —"}</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            {activeMakeSelect && <option value={CUSTOM}>Otro (especificar...)</option>}
          </select>
          {activeModelSelect === CUSTOM && (
            <Input
              placeholder="Escribí el modelo"
              value={customModel}
              onChange={(e) => { setCustomModel(e.target.value); set("model", e.target.value); }}
              required
            />
          )}
        </div>

        {/* Year */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Año *" type="number" required min={1900} max={CURRENT_YEAR + 1}
            value={form.year} onChange={(e) => set("year", Number(e.target.value))} />

          {/* Version / Motorización */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Motorización / Versión</label>
            {trims.length > 0 ? (
              <>
                <select
                  value={activeTrimSelect}
                  onChange={(e) => handleTrimChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{loadingTrims ? "Cargando..." : "— Seleccioná (opcional) —"}</option>
                  {trims.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value={CUSTOM}>Otro (especificar...)</option>
                </select>
                {activeTrimSelect === CUSTOM && (
                  <Input
                    placeholder="Ej: 1.6 XEI AT"
                    value={customTrim}
                    onChange={(e) => { setCustomTrim(e.target.value); set("version", e.target.value); }}
                  />
                )}
              </>
            ) : (
              <Input
                value={form.version ?? ""}
                onChange={(e) => set("version", e.target.value)}
                placeholder={loadingTrims ? "Cargando..." : "XLE, SE, GT, 1.6 Confort..."}
                disabled={loadingTrims}
              />
            )}
          </div>
        </div>

        {/* Color + Mileage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Color *" required value={form.color} onChange={(e) => set("color", e.target.value)} />
          <Input label="Kilometraje *" type="number" required min={0}
            value={form.mileage} onChange={(e) => set("mileage", Number(e.target.value))} />
        </div>

        {/* Fuel + Transmission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Combustible *" required value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value as FuelType)}>
            <option value="gasoline">Nafta</option>
            <option value="diesel">Diesel</option>
            <option value="electric">Eléctrico</option>
            <option value="hybrid">Híbrido</option>
            <option value="gnc">GNC</option>
          </Select>
          <Select label="Transmisión *" required value={form.transmission} onChange={(e) => set("transmission", e.target.value as Transmission)}>
            <option value="manual">Manual</option>
            <option value="automatic">Automático</option>
          </Select>
        </div>

        {/* Condition + Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Condición *" required value={form.condition} onChange={(e) => set("condition", e.target.value as VehicleCondition)}>
            <option value="new">Nuevo</option>
            <option value="used">Usado</option>
          </Select>
          <Input label="Carrocería" value={form.body_type ?? ""} onChange={(e) => set("body_type", e.target.value)} placeholder="sedan, suv, pickup..." />
        </div>

        {/* Plate */}
        <Input
          label="Patente"
          value={form.plate ?? ""}
          onChange={(e) => set("plate", e.target.value.toUpperCase())}
          placeholder="Ej: AB 123 CD"
          maxLength={10}
        />

        {/* Status */}
        <div className="flex flex-col gap-1">
          <Select
            label="Estado"
            value={form.status ?? "available"}
            onChange={(e) => set("status", e.target.value as VehicleStatus)}
          >
            <option value="available">Disponible (visible en la red)</option>
            <option value="reserved">Reservado</option>
            <option value="sold">Vendido</option>
            <option value="pre_toma">Pre Toma (solo visible para tus conectadas)</option>
          </Select>
          {form.status === "pre_toma" && (
            <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
              Este vehículo solo será visible para las concesionarias con las que estás conectado. Si ninguna acepta, podés publicarlo en la red más adelante.
            </p>
          )}
        </div>

        {/* Prices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Precio reventa *" type="number" required min={0} step="0.01"
            value={form.price_resale} onChange={(e) => set("price_resale", Number(e.target.value))} />
          <Input label="Precio público *" type="number" required min={0} step="0.01"
            value={form.price_public} onChange={(e) => set("price_public", Number(e.target.value))} />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? "Guardar cambios" : "Crear vehículo"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
