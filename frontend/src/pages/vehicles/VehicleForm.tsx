import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vehicleService } from "../../services/vehicleService";
import type { VehicleCreate, FuelType, Transmission, VehicleCondition } from "../../types/vehicle";

const CURRENT_YEAR = new Date().getFullYear();

const emptyForm: VehicleCreate = {
  brand: "",
  model: "",
  year: CURRENT_YEAR,
  version: "",
  color: "",
  mileage: 0,
  fuel_type: "gasoline",
  transmission: "manual",
  condition: "used",
  body_type: "",
  price_resale: 0,
  price_public: 0,
  description: "",
};

export function VehicleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<VehicleCreate>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    vehicleService.get(id).then((v) => {
      setForm({
        brand: v.brand,
        model: v.model,
        year: v.year,
        version: v.version ?? "",
        color: v.color,
        mileage: v.mileage,
        fuel_type: v.fuel_type,
        transmission: v.transmission,
        condition: v.condition,
        body_type: v.body_type ?? "",
        price_resale: v.price_resale,
        price_public: v.price_public,
        description: v.description ?? "",
      });
    }).catch(() => setError("No se pudo cargar el vehículo.")).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key: keyof VehicleCreate, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        version: form.version || undefined,
        body_type: form.body_type || undefined,
        description: form.description || undefined,
      };
      if (isEdit) {
        await vehicleService.update(id, payload);
        navigate(`/vehicles/${id}`);
      } else {
        const created = await vehicleService.create(payload);
        navigate(`/vehicles/${created.id}`);
      }
    } catch {
      setError("Error al guardar el vehículo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: "#6b7280", padding: 40 }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 0 60px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        {isEdit ? "Editar vehículo" : "Nuevo vehículo"}
      </h2>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", color: "#dc2626", marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={row}>
          <Field label="Marca *"><input required value={form.brand} onChange={(e) => set("brand", e.target.value)} style={input} /></Field>
          <Field label="Modelo *"><input required value={form.model} onChange={(e) => set("model", e.target.value)} style={input} /></Field>
        </div>
        <div style={row}>
          <Field label="Año *">
            <input required type="number" min={1900} max={CURRENT_YEAR + 1} value={form.year} onChange={(e) => set("year", Number(e.target.value))} style={input} />
          </Field>
          <Field label="Versión"><input value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} style={input} placeholder="XLE, SE, GT..." /></Field>
        </div>
        <div style={row}>
          <Field label="Color *"><input required value={form.color} onChange={(e) => set("color", e.target.value)} style={input} /></Field>
          <Field label="Kilometraje *">
            <input required type="number" min={0} value={form.mileage} onChange={(e) => set("mileage", Number(e.target.value))} style={input} />
          </Field>
        </div>
        <div style={row}>
          <Field label="Combustible *">
            <select required value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value as FuelType)} style={input}>
              <option value="gasoline">Nafta</option>
              <option value="diesel">Diesel</option>
              <option value="electric">Eléctrico</option>
              <option value="hybrid">Híbrido</option>
              <option value="gnc">GNC</option>
            </select>
          </Field>
          <Field label="Transmisión *">
            <select required value={form.transmission} onChange={(e) => set("transmission", e.target.value as Transmission)} style={input}>
              <option value="manual">Manual</option>
              <option value="automatic">Automático</option>
            </select>
          </Field>
        </div>
        <div style={row}>
          <Field label="Condición *">
            <select required value={form.condition} onChange={(e) => set("condition", e.target.value as VehicleCondition)} style={input}>
              <option value="new">Nuevo</option>
              <option value="used">Usado</option>
            </select>
          </Field>
          <Field label="Carrocería"><input value={form.body_type ?? ""} onChange={(e) => set("body_type", e.target.value)} placeholder="sedan, suv, pickup..." style={input} /></Field>
        </div>
        <div style={row}>
          <Field label="Precio reventa *">
            <input required type="number" min={0} step="0.01" value={form.price_resale} onChange={(e) => set("price_resale", Number(e.target.value))} style={input} />
          </Field>
          <Field label="Precio público *">
            <input required type="number" min={0} step="0.01" value={form.price_public} onChange={(e) => set("price_public", Number(e.target.value))} style={input} />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            style={{ ...input, resize: "vertical" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: "10px 24px", background: saving ? "#9ca3af" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}
          >
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear vehículo"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

const row: React.CSSProperties = { display: "flex", gap: 16 };
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
