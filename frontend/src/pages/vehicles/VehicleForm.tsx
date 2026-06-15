import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleCreate, FuelType, Transmission, VehicleCondition } from "@/types/vehicle";

const CURRENT_YEAR = new Date().getFullYear();

const emptyForm: VehicleCreate = {
  brand: "", model: "", year: CURRENT_YEAR, version: "", color: "",
  mileage: 0, fuel_type: "gasoline", transmission: "manual", condition: "used",
  body_type: "", price_resale: 0, price_public: 0, description: "",
};

export function VehicleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<VehicleCreate>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    vehicleService.get(id).then((v) => {
      setForm({
        brand: v.brand, model: v.model, year: v.year, version: v.version ?? "",
        color: v.color, mileage: v.mileage, fuel_type: v.fuel_type,
        transmission: v.transmission, condition: v.condition, body_type: v.body_type ?? "",
        price_resale: v.price_resale, price_public: v.price_public, description: v.description ?? "",
      });
    }).catch(() => toast.error("No se pudo cargar el vehículo.")).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key: keyof VehicleCreate, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Marca *" required value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          <Input label="Modelo *" required value={form.model} onChange={(e) => set("model", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Año *" type="number" required min={1900} max={CURRENT_YEAR + 1}
            value={form.year} onChange={(e) => set("year", Number(e.target.value))} />
          <Input label="Versión" value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="XLE, SE, GT..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Color *" required value={form.color} onChange={(e) => set("color", e.target.value)} />
          <Input label="Kilometraje *" type="number" required min={0}
            value={form.mileage} onChange={(e) => set("mileage", Number(e.target.value))} />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Condición *" required value={form.condition} onChange={(e) => set("condition", e.target.value as VehicleCondition)}>
            <option value="new">Nuevo</option>
            <option value="used">Usado</option>
          </Select>
          <Input label="Carrocería" value={form.body_type ?? ""} onChange={(e) => set("body_type", e.target.value)} placeholder="sedan, suv, pickup..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Precio reventa *" type="number" required min={0} step="0.01"
            value={form.price_resale} onChange={(e) => set("price_resale", Number(e.target.value))} />
          <Input label="Precio público *" type="number" required min={0} step="0.01"
            value={form.price_public} onChange={(e) => set("price_public", Number(e.target.value))} />
        </div>
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
